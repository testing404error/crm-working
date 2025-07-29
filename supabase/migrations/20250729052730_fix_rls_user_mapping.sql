-- Fix RLS policies to correctly map between auth.uid() and public.users table

-- Drop the previous policies that used incorrect user mapping
DROP POLICY IF EXISTS "Users can manage accessible leads" ON public.leads;
DROP POLICY IF EXISTS "Users can manage accessible opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can manage accessible activities" ON public.activities;

-- Create corrected RLS policies that properly map auth.uid() to public.users

-- 1. Leads policy - Users can see leads they created or are assigned to
CREATE POLICY "Users can manage accessible leads" ON public.leads
    FOR ALL USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        assigned_to IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        user_id = ANY (public.get_accessible_user_ids(auth.uid()))
    );

-- 2. Opportunities policy - Users can see opportunities they created or are assigned to
CREATE POLICY "Users can manage accessible opportunities" ON public.opportunities
    FOR ALL USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        assigned_to IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        user_id = ANY (public.get_accessible_user_ids(auth.uid()))
    );

-- 3. Activities policy - Users can see activities they created or are assigned to
CREATE POLICY "Users can manage accessible activities" ON public.activities
    FOR ALL USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        assigned_to IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        user_id = ANY (public.get_accessible_user_ids(auth.uid()))
    );
