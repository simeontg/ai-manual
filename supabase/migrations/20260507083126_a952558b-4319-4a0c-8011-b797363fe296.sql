
-- Allow checkers/hosts to delete checkin rows for events they manage (undo flow).
DROP POLICY IF EXISTS "checkins delete" ON public.checkins;
CREATE POLICY "checkins delete" ON public.checkins FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = checkins.event_id AND e.host_id = auth.uid())
    OR public.is_event_checker(auth.uid(), checkins.event_id)
  );

-- Extend the ticket guard so undo (setting checked_in_at to NULL) also removes
-- the checkins log row, keeping ticket and checkins in sync.
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

  IF NEW.checked_in_at IS NULL AND OLD.checked_in_at IS NOT NULL THEN
    DELETE FROM public.checkins WHERE ticket_id = NEW.id;
    NEW.checked_in_by := NULL;
  END IF;

  RETURN NEW;
END $$;

-- Update RLS so hosts/checkers can also UPDATE a ticket to undo (i.e. when the
-- ticket IS already checked in, but we're nulling it out).
DROP POLICY IF EXISTS "tickets update" ON public.tickets;
CREATE POLICY "tickets update" ON public.tickets FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = tickets.event_id AND e.host_id = auth.uid())
    OR public.is_event_checker(auth.uid(), tickets.event_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = tickets.event_id AND e.host_id = auth.uid())
    OR public.is_event_checker(auth.uid(), tickets.event_id)
  );
