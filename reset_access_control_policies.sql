-- Reset and recreate access_control RLS policies

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view access control they are involved in" ON public.access_control;
DROP POLICY IF EXISTS "Users can grant access to their data" ON public.access_control;
DROP POLICY IF EXISTS "Users can revoke access they granted" ON public.access_control;

-- Recreate the policies
CREATE POLICY "Users can view access control they are involved in" ON public.access_control
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        granted_to_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can grant access to their data" ON public.access_control
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can revoke access they granted" ON public.access_control
    FOR DELETE USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );
