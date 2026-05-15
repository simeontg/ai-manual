-- Backfill host_org_id from the oldest host owned by host_id
UPDATE public.events e
SET host_org_id = sub.host_org
FROM (
  SELECT DISTINCT ON (owner_id) owner_id, id AS host_org
  FROM public.hosts
  ORDER BY owner_id, created_at ASC
) sub
WHERE e.host_org_id IS NULL
  AND sub.owner_id = e.host_id;

-- Auto-set host_org_id on insert if not provided
CREATE OR REPLACE FUNCTION public.set_event_host_org()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.host_org_id IS NULL THEN
    SELECT id INTO NEW.host_org_id
    FROM public.hosts
    WHERE owner_id = NEW.host_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_event_host_org ON public.events;
CREATE TRIGGER trg_set_event_host_org
  BEFORE INSERT OR UPDATE OF host_id ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_event_host_org();