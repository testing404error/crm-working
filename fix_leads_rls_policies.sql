-- =====================================================
-- FIX LEADS RLS POLICIES - Using Correct Column Names
-- =====================================================

-- First, drop existing policies on leads table
DROP POLICY IF EXISTS "Users can access leads they have permission for" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads they have access to" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads they have access to" ON public.leads;

-- Create new, more permissive policies for leads
-- Allow authenticated users to select all leads (they can see all leads)
CREATE POLICY "Authenticated users can view all leads" 
ON public.leads FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert leads with their user_id
CREATE POLICY "Authenticated users can create leads" 
ON public.leads FOR INSERT 
WITH CHECK (
    auth.role() = 'authenticated' AND
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- Allow authenticated users to update leads they created or are assigned to
CREATE POLICY "Authenticated users can update leads they own or are assigned to" 
ON public.leads FOR UPDATE 
USING (
    auth.role() = 'authenticated' AND
    (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        assigned_to IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    )
);

-- Allow authenticated users to delete leads they created
CREATE POLICY "Authenticated users can delete leads they own" 
ON public.leads FOR DELETE 
USING (
    auth.role() = 'authenticated' AND
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'leads'
ORDER BY policyname;
