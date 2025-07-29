-- Fix permissions for users table access from edge functions
-- Run this script in Supabase SQL Editor

-- Grant necessary permissions to the service role (used by edge functions)
GRANT SELECT ON public.users TO service_role;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Service role can access all users" ON public.users;
DROP POLICY IF EXISTS "Users can view other users for access requests" ON public.users;

-- Create a policy that allows service role to access users table
CREATE POLICY "Service role can access all users" ON public.users
    FOR SELECT TO service_role
    USING (true);

-- Also ensure authenticated users can access users they need for the access request system
CREATE POLICY "Users can view other users for access requests" ON public.users
    FOR SELECT TO authenticated
    USING (true);

-- Verify the policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;
