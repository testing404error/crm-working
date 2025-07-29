-- FIXED Complete Database Setup for User Management System
-- This script creates all necessary tables, functions, and permissions
-- Handles existing policies properly
-- Run this in your Supabase SQL Editor

-- =======================
-- 1. CREATE MISSING TABLES
-- =======================

-- Create pending_access_requests table
CREATE TABLE IF NOT EXISTS pending_access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(requester_id, receiver_id)
);

-- Create user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    can_view_other_users_data BOOLEAN DEFAULT FALSE,
    granted_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create access_control table (if referenced in code)
CREATE TABLE IF NOT EXISTS access_control (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    granted_to_user_id UUID NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, granted_to_user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON pending_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_receiver ON pending_access_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON pending_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_access_control_user_id ON access_control(user_id);
CREATE INDEX IF NOT EXISTS idx_access_control_granted_to ON access_control(granted_to_user_id);

-- =======================
-- 2. ENABLE ROW LEVEL SECURITY
-- =======================

ALTER TABLE pending_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control ENABLE ROW LEVEL SECURITY;

-- =======================
-- 3. DROP ALL EXISTING POLICIES COMPLETELY
-- =======================

-- Drop ALL policies for pending_access_requests
DO $$ 
BEGIN
    -- Drop all policies for pending_access_requests
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON pending_access_requests;', E'\n')
        FROM pg_policies 
        WHERE tablename = 'pending_access_requests'
    );
    
    -- Drop all policies for user_permissions
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON user_permissions;', E'\n')
        FROM pg_policies 
        WHERE tablename = 'user_permissions'
    );
    
    -- Drop all policies for access_control
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON access_control;', E'\n')
        FROM pg_policies 
        WHERE tablename = 'access_control'
    );
EXCEPTION 
    WHEN OTHERS THEN
        -- If there's an error with the dynamic SQL, continue
        NULL;
END $$;

-- Manual cleanup of known policies
DROP POLICY IF EXISTS "Service role can access all requests" ON pending_access_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON pending_access_requests;
DROP POLICY IF EXISTS "Users can insert their own requests" ON pending_access_requests;
DROP POLICY IF EXISTS "Receivers can update request status" ON pending_access_requests;
DROP POLICY IF EXISTS "Requesters can delete their own requests" ON pending_access_requests;

DROP POLICY IF EXISTS "Service role can manage all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Authenticated users can manage permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can manage all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Allow function access to user permissions" ON user_permissions;

DROP POLICY IF EXISTS "Service role can manage access control" ON access_control;
DROP POLICY IF EXISTS "Users can view access granted to them" ON access_control;
DROP POLICY IF EXISTS "Authenticated users can manage access control" ON access_control;

-- =======================
-- 4. GRANT PERMISSIONS TO ROLES
-- =======================

-- Grant permissions to service_role (used by edge functions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Specifically grant permissions for our tables
GRANT SELECT, INSERT, UPDATE, DELETE ON pending_access_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON access_control TO service_role;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON pending_access_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON access_control TO authenticated;

-- =======================
-- 5. CREATE NEW POLICIES (with unique names to avoid conflicts)
-- =======================

-- Policies for pending_access_requests
CREATE POLICY "svc_role_all_access_requests" ON pending_access_requests
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "users_view_own_requests" ON pending_access_requests
    FOR SELECT TO authenticated
    USING (requester_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "users_insert_own_requests" ON pending_access_requests
    FOR INSERT TO authenticated
    WITH CHECK (requester_id = auth.uid());

CREATE POLICY "receivers_update_status" ON pending_access_requests
    FOR UPDATE TO authenticated
    USING (receiver_id = auth.uid());

CREATE POLICY "requesters_delete_own" ON pending_access_requests
    FOR DELETE TO authenticated
    USING (requester_id = auth.uid());

-- Policies for user_permissions
CREATE POLICY "svc_role_all_permissions" ON user_permissions
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "users_view_own_perms" ON user_permissions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "auth_users_manage_perms" ON user_permissions
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Policies for access_control
CREATE POLICY "svc_role_all_access_control" ON access_control
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "users_view_granted_access" ON access_control
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR granted_to_user_id = auth.uid());

CREATE POLICY "auth_users_manage_access" ON access_control
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- =======================
-- 6. CREATE STORED FUNCTIONS
-- =======================

-- Function to set user data view permission
CREATE OR REPLACE FUNCTION set_user_data_view_permission(
    target_user_id UUID,
    can_view BOOLEAN,
    admin_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert or update the user permission
    INSERT INTO user_permissions (user_id, can_view_other_users_data, granted_by, updated_at)
    VALUES (target_user_id, can_view, admin_user_id, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        can_view_other_users_data = can_view,
        granted_by = admin_user_id,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$;

-- Function to check if user can view other users' data
CREATE OR REPLACE FUNCTION user_can_view_other_users_data(
    check_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    can_view BOOLEAN := FALSE;
BEGIN
    SELECT can_view_other_users_data INTO can_view
    FROM user_permissions
    WHERE user_id = check_user_id;
    
    RETURN COALESCE(can_view, FALSE);
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION set_user_data_view_permission(UUID, BOOLEAN, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION user_can_view_other_users_data(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION set_user_data_view_permission(UUID, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_view_other_users_data(UUID) TO authenticated;

-- =======================
-- 7. TEST QUERIES
-- =======================

-- Test table access
SELECT 'pending_access_requests' as table_name, COUNT(*) as count FROM pending_access_requests;
SELECT 'user_permissions' as table_name, COUNT(*) as count FROM user_permissions;
SELECT 'access_control' as table_name, COUNT(*) as count FROM access_control;

-- Show all policies for verification
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('pending_access_requests', 'user_permissions', 'access_control')
ORDER BY tablename, policyname;

-- Test functions
SELECT 'Function test: user_can_view_other_users_data' as test_name, 
       user_can_view_other_users_data('00000000-0000-0000-0000-000000000000'::UUID) as result;

-- Show table structures
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('pending_access_requests', 'user_permissions', 'access_control')
ORDER BY table_name, ordinal_position;

-- =======================
-- 8. SUCCESS MESSAGE
-- =======================

SELECT 'FIXED Database setup completed successfully! All tables, policies, and functions are now ready.' as status;
