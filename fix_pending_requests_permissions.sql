-- Fix all permissions for pending_access_requests table
-- Run this script in Supabase SQL Editor

-- Grant all necessary permissions to service_role (used by edge functions)
GRANT SELECT, INSERT, UPDATE, DELETE ON pending_access_requests TO service_role;

-- Drop existing policies to recreate them with proper permissions
DROP POLICY IF EXISTS "Service role can access all requests" ON pending_access_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON pending_access_requests;
DROP POLICY IF EXISTS "Users can insert their own requests" ON pending_access_requests;
DROP POLICY IF EXISTS "Receivers can update request status" ON pending_access_requests;
DROP POLICY IF EXISTS "Requesters can delete their own requests" ON pending_access_requests;

-- Create comprehensive policies
-- Service role can do anything (for edge functions)
CREATE POLICY "Service role can access all requests" ON pending_access_requests
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Users can view requests they're involved in
CREATE POLICY "Users can view their own requests" ON pending_access_requests
    FOR SELECT TO authenticated
    USING (requester_id = auth.uid() OR receiver_id = auth.uid());

-- Users can insert their own requests
CREATE POLICY "Users can insert their own requests" ON pending_access_requests
    FOR INSERT TO authenticated
    WITH CHECK (requester_id = auth.uid());

-- Receivers can update request status
CREATE POLICY "Receivers can update request status" ON pending_access_requests
    FOR UPDATE TO authenticated
    USING (receiver_id = auth.uid());

-- Requesters can delete their own requests
CREATE POLICY "Requesters can delete their own requests" ON pending_access_requests
    FOR DELETE TO authenticated
    USING (requester_id = auth.uid());

-- Also fix user_permissions table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_permissions TO service_role;

-- Drop and recreate user_permissions policies
DROP POLICY IF EXISTS "Service role can manage all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Authenticated users can manage permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can manage all permissions" ON user_permissions;

-- Service role can do anything with user_permissions
CREATE POLICY "Service role can manage all permissions" ON user_permissions
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions" ON user_permissions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Authenticated users can manage permissions (edge function will handle admin checks)
CREATE POLICY "Authenticated users can manage permissions" ON user_permissions
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Test the access by checking if we can query the tables
SELECT 'Test pending_access_requests' as test_name, COUNT(*) as count FROM pending_access_requests;
SELECT 'Test user_permissions' as test_name, COUNT(*) as count FROM user_permissions;

-- Show all policies for verification
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('pending_access_requests', 'user_permissions')
ORDER BY tablename, policyname;
