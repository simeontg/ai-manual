CREATE OR REPLACE FUNCTION public.get_host_invite(_token TEXT)
RETURNS TABLE(id UUID, role public.host_member_role, host_name TEXT, expires_at TIMESTAMPTZ, used_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.role, h.name, i.expires_at, i.used_at
  FROM public.host_invites i
  JOIN public.hosts h ON h.id = i.host_id
  WHERE i.token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_host_invite(TEXT) TO anon, authenticated;