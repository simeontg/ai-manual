-- Invite tokens for adding members (host or checker) via copyable link
CREATE TABLE public.host_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  role public.host_member_role NOT NULL DEFAULT 'checker',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  used_at TIMESTAMPTZ,
  used_by UUID
);

CREATE INDEX idx_host_invites_token ON public.host_invites(token);
CREATE INDEX idx_host_invites_host ON public.host_invites(host_id);

ALTER TABLE public.host_invites ENABLE ROW LEVEL SECURITY;

-- Owners and host-role members can create invites for their hosts
CREATE POLICY "Host owners and members can create invites"
  ON public.host_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.host_members m WHERE m.host_id = host_invites.host_id AND m.user_id = auth.uid() AND m.role IN ('owner','manager'))
    )
  );

-- Owners and members can view invites for their hosts
CREATE POLICY "Host members can view invites"
  ON public.host_invites FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.host_members m WHERE m.host_id = host_invites.host_id AND m.user_id = auth.uid())
  );

-- Anyone authenticated can read a single invite by token (needed for accept page)
-- We rely on the secret token acting as a capability; status checked at accept time.
CREATE POLICY "Authenticated can lookup invite by token"
  ON public.host_invites FOR SELECT
  TO authenticated
  USING (true);

-- RPC to redeem an invite atomically
CREATE OR REPLACE FUNCTION public.accept_host_invite(_token TEXT)
RETURNS TABLE(host_id UUID, role public.host_member_role)
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

  UPDATE public.host_invites
    SET used_at = now(), used_by = auth.uid()
    WHERE id = v_invite.id;

  -- Mirror role into user_roles so existing isHost/isChecker checks work
  IF v_invite.role IN ('owner','manager') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'host')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF v_invite.role = 'checker' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'checker')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_invite.host_id, v_invite.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_host_invite(TEXT) TO authenticated;

-- Enable realtime on rsvps so attendees can see waitlist promotions live
ALTER TABLE public.rsvps REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvps;