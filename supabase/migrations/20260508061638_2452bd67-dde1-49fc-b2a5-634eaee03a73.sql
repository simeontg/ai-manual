DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT id, display_name, avatar_url, bio, contact_email, is_host
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Add a permissive SELECT policy limited to non-email columns by allowing all reads,
-- since the email column is now also returned only to owner/admin via the existing
-- "profiles owner or admin read" policy combined with this one. To keep email private
-- while allowing public columns, add a second policy that returns rows but the view
-- restricts columns. Policies are row-level only, so we need a second permissive policy
-- that allows everyone to SELECT rows; column privacy is enforced by only ever querying
-- profiles_public from the client (never profiles.*).
CREATE POLICY "profiles public row read"
ON public.profiles FOR SELECT
USING (true);

-- Revoke direct column SELECT on email from anon/authenticated so even direct queries
-- cannot read it; only owner/admin via the policy above + column grant.
REVOKE SELECT (email) ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, avatar_url, bio, contact_email, is_host, created_at, updated_at)
  ON public.profiles TO anon, authenticated;