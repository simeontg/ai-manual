-- 1. Tighten profiles SELECT policy
DROP POLICY IF EXISTS "profiles readable" ON public.profiles;
CREATE POLICY "profiles owner or admin read"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- 2. Public projection without email
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT id, display_name, avatar_url, bio, contact_email, is_host
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 3. Remove 'checker' from self-assignable roles
DROP POLICY IF EXISTS "Users can self-assign limited roles" ON public.user_roles;
CREATE POLICY "Users can self-assign limited roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role IN ('host', 'attendee'));

-- 4. Event-scoped checker validation (no global bypass)
CREATE OR REPLACE FUNCTION public.is_event_checker(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.host_members hm ON hm.host_id = e.host_id
    WHERE e.id = _event_id
      AND hm.user_id = _user_id
      AND hm.role IN ('owner', 'manager', 'checker')
  );
$$;

-- 5. SECURITY DEFINER RPC for legitimate per-ticket email access (check-in flow)
CREATE OR REPLACE FUNCTION public.get_event_attendee_email(p_ticket_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event uuid;
  v_user uuid;
  v_email text;
BEGIN
  SELECT event_id, user_id INTO v_event, v_user
  FROM public.tickets WHERE id = p_ticket_id;
  IF v_event IS NULL THEN RETURN NULL; END IF;
  IF NOT public.is_event_checker(auth.uid(), v_event) THEN RETURN NULL; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = v_user;
  RETURN v_email;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_event_attendee_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_attendee_email(uuid) TO authenticated;

-- 6. SECURITY DEFINER RPC for bulk attendee emails (CSV exports)
CREATE OR REPLACE FUNCTION public.get_event_attendee_emails(p_event_id uuid)
RETURNS TABLE(user_id uuid, email text, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_event_checker(auth.uid(), p_event_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.display_name
    FROM public.profiles p
    WHERE p.id IN (
      SELECT r.user_id FROM public.rsvps r WHERE r.event_id = p_event_id
      UNION
      SELECT t.user_id FROM public.tickets t WHERE t.event_id = p_event_id
    );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_event_attendee_emails(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_attendee_emails(uuid) TO authenticated;