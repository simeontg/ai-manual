
-- 1. Re-add tickets UPDATE policy: only hosts/org members/event checkers, and
--    only when the ticket has not been checked in yet (single check-in).
DROP POLICY IF EXISTS "tickets check-in" ON public.tickets;
DROP POLICY IF EXISTS "tickets update" ON public.tickets;
CREATE POLICY "tickets update" ON public.tickets FOR UPDATE
  USING (
    checked_in_at IS NULL
    AND (
      EXISTS (SELECT 1 FROM public.events e WHERE e.id = tickets.event_id AND e.host_id = auth.uid())
      OR public.is_event_checker(auth.uid(), tickets.event_id)
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = tickets.event_id AND e.host_id = auth.uid())
    OR public.is_event_checker(auth.uid(), tickets.event_id)
  );

-- 2. Defense-in-depth: trigger blocks any second check-in even if RLS is bypassed,
--    and mirrors the check-in into the checkins table (UNIQUE ticket_id).
CREATE OR REPLACE FUNCTION public.tg_ticket_checkin_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.checked_in_at IS NOT NULL AND OLD.checked_in_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ticket % is already checked in', OLD.id
      USING ERRCODE = 'unique_violation';
  END IF;

  IF NEW.checked_in_at IS NOT NULL AND OLD.checked_in_at IS NULL THEN
    IF NEW.checked_in_by IS NULL THEN
      RAISE EXCEPTION 'checked_in_by is required';
    END IF;
    INSERT INTO public.checkins (ticket_id, event_id, checked_in_by, checked_in_at)
    VALUES (NEW.id, NEW.event_id, NEW.checked_in_by, NEW.checked_in_at)
    ON CONFLICT (ticket_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tickets_checkin_guard ON public.tickets;
CREATE TRIGGER tickets_checkin_guard
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_ticket_checkin_guard();

REVOKE EXECUTE ON FUNCTION public.tg_ticket_checkin_guard() FROM PUBLIC, anon, authenticated;

-- 3. Capacity + waitlist enforcement on RSVP UPDATE (not just INSERT).
--    Reuses the same locking pattern as the insert path.
CREATE OR REPLACE FUNCTION public.tg_rsvp_before_update_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capacity INT;
  v_confirmed_count INT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Normalize legacy 'going' to 'confirmed' so we have one canonical state.
  IF NEW.status = 'going' THEN
    NEW.status := 'confirmed';
  END IF;

  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Lock the event row to serialize concurrent capacity decisions.
  SELECT capacity INTO v_capacity FROM public.events WHERE id = NEW.event_id FOR UPDATE;

  SELECT count(*) INTO v_confirmed_count
    FROM public.rsvps
    WHERE event_id = NEW.event_id
      AND status IN ('confirmed','going')
      AND id <> NEW.id;

  IF NEW.status = 'confirmed' THEN
    IF v_confirmed_count >= v_capacity THEN
      NEW.status := 'waitlisted';
    END IF;
  ELSIF NEW.status = 'waitlist' THEN
    NEW.status := 'waitlisted';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rsvps_before_update_status ON public.rsvps;
CREATE TRIGGER rsvps_before_update_status
  BEFORE UPDATE OF status ON public.rsvps
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.tg_rsvp_before_update_status();

REVOKE EXECUTE ON FUNCTION public.tg_rsvp_before_update_status() FROM PUBLIC, anon, authenticated;

-- 4. Strict FIFO tiebreak (created_at, id) on promotion.
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
        ORDER BY created_at ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

      IF v_next_id IS NOT NULL THEN
        UPDATE public.rsvps SET status = 'confirmed' WHERE id = v_next_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

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
        ORDER BY created_at ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

      IF v_next_id IS NOT NULL THEN
        UPDATE public.rsvps SET status = 'confirmed' WHERE id = v_next_id;
      END IF;
    END IF;
  END IF;
  RETURN OLD;
END $$;

-- 5. Tighten is_event_checker: require host_members link OR explicit checker app_role
--    AND a host_members link to that event's org. No more global cross-org access.
CREATE OR REPLACE FUNCTION public.is_event_checker(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.host_members hm ON hm.host_id = e.host_org_id
    WHERE e.id = _event_id
      AND hm.user_id = _user_id
      AND hm.role IN ('owner','manager','checker')
  );
END $$;
