-- Add missing RLS policies for access_control table

-- Policy for viewing access control records (users can see records they are involved in)
CREATE POLICY "Users can view access control they are involved in" ON public.access_control
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        granted_to_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- Policy for creating access control records (users can grant access to their own data)
CREATE POLICY "Users can grant access to their data" ON public.access_control
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- Policy for deleting access control records (users can revoke access they granted)
CREATE POLICY "Users can revoke access they granted" ON public.access_control
    FOR DELETE USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );
