DROP FUNCTION IF EXISTS public.accept_host_invite(TEXT);

CREATE OR REPLACE FUNCTION public.accept_host_invite(_token TEXT)
RETURNS TABLE(out_host_id UUID, out_role public.host_member_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.host_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT * INTO v_invite FROM public.host_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite not found'; END IF;
  IF v_invite.used_at IS NOT NULL THEN RAISE EXCEPTION 'invite already used'; END IF;
  IF v_invite.expires_at < now() THEN RAISE EXCEPTION 'invite expired'; END IF;

  INSERT INTO public.host_members (host_id, user_id, role)
  VALUES (v_invite.host_id, auth.uid(), v_invite.role)
  ON CONFLICT (host_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.host_invites AS hi
    SET used_at = now(), used_by = auth.uid()
    WHERE hi.id = v_invite.id;

  IF v_invite.role IN ('owner','manager') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'host')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF v_invite.role = 'checker' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'checker')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  out_host_id := v_invite.host_id;
  out_role := v_invite.role;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_host_invite(TEXT) TO authenticated;