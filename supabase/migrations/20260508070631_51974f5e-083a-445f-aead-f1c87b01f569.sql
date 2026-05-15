CREATE OR REPLACE FUNCTION public.is_host_member(_user_id uuid, _host_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.host_members
    WHERE host_id = _host_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.hosts
    WHERE id = _host_id AND owner_id = _user_id
  );
END $function$;