
-- 1. Enums
ALTER TYPE public.rsvp_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.rsvp_status ADD VALUE IF NOT EXISTS 'waitlisted';

DO $$ BEGIN
  CREATE TYPE public.host_member_role AS ENUM ('owner','manager','checker');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. hosts + host_members
CREATE TABLE IF NOT EXISTS public.hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hosts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.host_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.host_member_role NOT NULL DEFAULT 'manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (host_id, user_id)
);
ALTER TABLE public.host_members ENABLE ROW LEVEL SECURITY;

-- 3. events: add host_org_id BEFORE creating functions that reference it
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS host_org_id UUID REFERENCES public.hosts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS events_host_org_id_idx ON public.events(host_org_id);
CREATE INDEX IF NOT EXISTS events_status_visibility_idx ON public.events(status, visibility);

DROP TRIGGER IF EXISTS hosts_updated_at ON public.hosts;
CREATE TRIGGER hosts_updated_at BEFORE UPDATE ON public.hosts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Helper functions (plpgsql to avoid early binding issues)
CREATE OR REPLACE FUNCTION public.is_host_member(_user_id UUID, _host_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.host_members
    WHERE host_id = _host_id AND user_id = _user_id
  );
END $$;

CREATE OR REPLACE FUNCTION public.is_host_member_for_event(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.host_members hm ON hm.host_id = e.host_org_id
    WHERE e.id = _event_id AND hm.user_id = _user_id
  );
END $$;

CREATE OR REPLACE FUNCTION public.is_event_checker(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.host_members hm ON hm.host_id = e.host_org_id
    WHERE e.id = _event_id AND hm.user_id = _user_id
      AND hm.role IN ('owner','manager','checker')
  ) OR public.has_role(_user_id, 'checker');
END $$;

-- 5. checkins
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL UNIQUE REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  checked_in_by UUID NOT NULL REFERENCES auth.users(id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS checkins_event_id_idx ON public.checkins(event_id);

-- 6. RSVP capacity + waitlist
CREATE OR REPLACE FUNCTION public.tg_rsvp_assign_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capacity INT;
  v_confirmed_count INT;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT capacity INTO v_capacity FROM public.events WHERE id = NEW.event_id FOR UPDATE;
  SELECT count(*) INTO v_confirmed_count
    FROM public.rsvps
    WHERE event_id = NEW.event_id AND status IN ('confirmed','going');

  IF NEW.status IN ('confirmed','going') THEN
    IF v_confirmed_count >= v_capacity THEN
      NEW.status := 'waitlisted';
    ELSE
      NEW.status := 'confirmed';
    END IF;
  ELSIF NEW.status = 'waitlist' THEN
    NEW.status := 'waitlisted';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rsvps_assign_status ON public.rsvps;
CREATE TRIGGER rsvps_assign_status
  BEFORE INSERT ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_rsvp_assign_status();

DROP TRIGGER IF EXISTS on_rsvp_created ON public.rsvps;

CREATE OR REPLACE FUNCTION public.handle_new_rsvp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('confirmed','going') THEN
    INSERT INTO public.tickets (rsvp_id, event_id, user_id)
    VALUES (NEW.id, NEW.event_id, NEW.user_id)
    ON CONFLICT (rsvp_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_rsvp_created
  AFTER INSERT ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_rsvp();

CREATE OR REPLACE FUNCTION public.tg_rsvp_after_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capacity INT;
  v_confirmed_count INT;
  v_next_id UUID;
BEGIN
  IF NEW.status IN ('confirmed','going') AND OLD.status NOT IN ('confirmed','going') THEN
    INSERT INTO public.tickets (rsvp_id, event_id, user_id)
    VALUES (NEW.id, NEW.event_id, NEW.user_id)
    ON CONFLICT (rsvp_id) DO NOTHING;
  END IF;

  IF OLD.status IN ('confirmed','going') AND NEW.status NOT IN ('confirmed','going') THEN
    DELETE FROM public.tickets WHERE rsvp_id = NEW.id;

    SELECT capacity INTO v_capacity FROM public.events WHERE id = NEW.event_id FOR UPDATE;
    SELECT count(*) INTO v_confirmed_count
      FROM public.rsvps WHERE event_id = NEW.event_id AND status IN ('confirmed','going');

    IF v_confirmed_count < v_capacity THEN
      SELECT id INTO v_next_id
        FROM public.rsvps
        WHERE event_id = NEW.event_id AND status = 'waitlisted'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

      IF v_next_id IS NOT NULL THEN
        UPDATE public.rsvps SET status = 'confirmed' WHERE id = v_next_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rsvps_after_update ON public.rsvps;
CREATE TRIGGER rsvps_after_update
  AFTER UPDATE OF status ON public.rsvps
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.tg_rsvp_after_update();

CREATE OR REPLACE FUNCTION public.tg_rsvp_after_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capacity INT;
  v_confirmed_count INT;
  v_next_id UUID;
BEGIN
  IF OLD.status IN ('confirmed','going') THEN
    SELECT capacity INTO v_capacity FROM public.events WHERE id = OLD.event_id FOR UPDATE;
    SELECT count(*) INTO v_confirmed_count
      FROM public.rsvps WHERE event_id = OLD.event_id AND status IN ('confirmed','going');

    IF v_confirmed_count < v_capacity THEN
      SELECT id INTO v_next_id
        FROM public.rsvps
        WHERE event_id = OLD.event_id AND status = 'waitlisted'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

      IF v_next_id IS NOT NULL THEN
        UPDATE public.rsvps SET status = 'confirmed' WHERE id = v_next_id;
      END IF;
    END IF;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS rsvps_after_delete ON public.rsvps;
CREATE TRIGGER rsvps_after_delete
  AFTER DELETE ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_rsvp_after_delete();

-- 7. RLS policies
DROP POLICY IF EXISTS "hosts public read" ON public.hosts;
DROP POLICY IF EXISTS "hosts owner insert" ON public.hosts;
DROP POLICY IF EXISTS "hosts owner update" ON public.hosts;
DROP POLICY IF EXISTS "hosts owner delete" ON public.hosts;
CREATE POLICY "hosts public read" ON public.hosts FOR SELECT USING (true);
CREATE POLICY "hosts owner insert" ON public.hosts FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "hosts owner update" ON public.hosts FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "hosts owner delete" ON public.hosts FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "host_members read" ON public.host_members;
DROP POLICY IF EXISTS "host_members owner write" ON public.host_members;
CREATE POLICY "host_members read" ON public.host_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid())
  );
CREATE POLICY "host_members owner write" ON public.host_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid()));

DROP POLICY IF EXISTS "events public read" ON public.events;
DROP POLICY IF EXISTS "events host insert" ON public.events;
DROP POLICY IF EXISTS "events host update" ON public.events;
DROP POLICY IF EXISTS "events host delete" ON public.events;

CREATE POLICY "events public read" ON public.events FOR SELECT
  USING (
    (status = 'published' AND visibility = 'public')
    OR host_id = auth.uid()
    OR (host_org_id IS NOT NULL AND public.is_host_member(auth.uid(), host_org_id))
    OR public.is_event_checker(auth.uid(), id)
  );
CREATE POLICY "events host insert" ON public.events FOR INSERT
  WITH CHECK (
    auth.uid() = host_id
    AND (host_org_id IS NULL OR public.is_host_member(auth.uid(), host_org_id))
  );
CREATE POLICY "events host update" ON public.events FOR UPDATE
  USING (
    host_id = auth.uid()
    OR (host_org_id IS NOT NULL AND public.is_host_member(auth.uid(), host_org_id))
  );
CREATE POLICY "events host delete" ON public.events FOR DELETE
  USING (
    host_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = events.host_org_id AND h.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "rsvps owner read" ON public.rsvps;
DROP POLICY IF EXISTS "rsvps read" ON public.rsvps;
DROP POLICY IF EXISTS "rsvps insert self" ON public.rsvps;
DROP POLICY IF EXISTS "rsvps update self" ON public.rsvps;
DROP POLICY IF EXISTS "rsvps delete self" ON public.rsvps;
CREATE POLICY "rsvps read" ON public.rsvps FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
    OR public.is_host_member_for_event(auth.uid(), event_id)
  );
CREATE POLICY "rsvps insert self" ON public.rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rsvps update self" ON public.rsvps FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rsvps delete self" ON public.rsvps FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tickets owner read" ON public.tickets;
DROP POLICY IF EXISTS "tickets read" ON public.tickets;
DROP POLICY IF EXISTS "tickets check-in" ON public.tickets;
CREATE POLICY "tickets read" ON public.tickets FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
    OR public.is_event_checker(auth.uid(), event_id)
  );

DROP POLICY IF EXISTS "checkins read" ON public.checkins;
DROP POLICY IF EXISTS "checkins insert" ON public.checkins;
CREATE POLICY "checkins read" ON public.checkins FOR SELECT
  USING (public.is_event_checker(auth.uid(), event_id));
CREATE POLICY "checkins insert" ON public.checkins FOR INSERT
  WITH CHECK (auth.uid() = checked_in_by AND public.is_event_checker(auth.uid(), event_id));

-- 8. Permissions
REVOKE EXECUTE ON FUNCTION public.tg_rsvp_assign_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_rsvp_after_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_rsvp_after_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_host_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_host_member_for_event(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_checker(UUID, UUID) TO authenticated;
