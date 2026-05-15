-- Ensure RLS is on
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop any prior self-insert policy if present, then recreate
DROP POLICY IF EXISTS "Users can self-assign limited roles" ON public.user_roles;

CREATE POLICY "Users can self-assign limited roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role IN ('host'::public.app_role, 'checker'::public.app_role, 'attendee'::public.app_role)
);
