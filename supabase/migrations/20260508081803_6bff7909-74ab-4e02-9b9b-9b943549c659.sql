DROP POLICY IF EXISTS "events host insert" ON public.events;

CREATE POLICY "events host insert" ON public.events FOR INSERT
  WITH CHECK (
    auth.uid() = host_id
    AND public.has_role(auth.uid(), 'host')
    AND (host_org_id IS NULL OR public.is_host_member(auth.uid(), host_org_id))
  );