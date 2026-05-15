
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'attendee')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $$;

UPDATE public.profiles p SET email = u.email
  FROM auth.users u WHERE p.id = u.id AND p.email IS NULL;

CREATE OR REPLACE FUNCTION public.tg_rsvp_block_past()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ends TIMESTAMPTZ;
BEGIN
  SELECT ends_at INTO v_ends FROM public.events WHERE id = NEW.event_id;
  IF v_ends IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_ends < now() THEN RAISE EXCEPTION 'Event has already ended'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rsvps_block_past ON public.rsvps;
CREATE TRIGGER rsvps_block_past
  BEFORE INSERT OR UPDATE OF status ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_rsvp_block_past();

CREATE TABLE IF NOT EXISTS public.event_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tg_feedback_validate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ends TIMESTAMPTZ;
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN RAISE EXCEPTION 'Rating must be 1-5'; END IF;
  SELECT ends_at INTO v_ends FROM public.events WHERE id = NEW.event_id;
  IF v_ends IS NULL OR v_ends > now() THEN
    RAISE EXCEPTION 'Feedback only allowed after event ends';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feedback_validate ON public.event_feedback;
CREATE TRIGGER feedback_validate BEFORE INSERT OR UPDATE ON public.event_feedback
  FOR EACH ROW EXECUTE FUNCTION public.tg_feedback_validate();

CREATE POLICY "feedback read" ON public.event_feedback FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id
    AND (e.status='published' OR e.host_id = auth.uid()))
);
CREATE POLICY "feedback insert self" ON public.event_feedback FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.event_id = event_feedback.event_id AND t.user_id = auth.uid())
  );
CREATE POLICY "feedback update self" ON public.event_feedback FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feedback delete self or host" ON public.event_feedback FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.event_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS event_photos_event_idx ON public.event_photos(event_id);

CREATE POLICY "photos public read approved" ON public.event_photos FOR SELECT USING (
  approved = true
  OR auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
);
CREATE POLICY "photos insert self" ON public.event_photos FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.event_id = event_photos.event_id AND t.user_id = auth.uid())
  );
CREATE POLICY "photos host moderate" ON public.event_photos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
);
CREATE POLICY "photos delete owner or host" ON public.event_photos FOR DELETE USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
);

DO $$ BEGIN CREATE TYPE public.report_target AS ENUM ('event','photo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.report_status AS ENUM ('open','reviewed','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.report_target NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status public.report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports insert self" ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports admin read" ON public.reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = reporter_id);
CREATE POLICY "reports admin update" ON public.reports FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
