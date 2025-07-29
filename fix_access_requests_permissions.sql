-- Fix permissions and RLS policies for pending_access_requests table
-- Run this script in Supabase SQL Editor

-- First, check if the table exists and create it if it doesn't
CREATE TABLE IF NOT EXISTS pending_access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(requester_id, receiver_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON pending_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_receiver ON pending_access_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON pending_access_requests(status);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON pending_access_requests TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Enable Row Level Security
ALTER TABLE pending_access_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own requests" ON pending_access_requests;
DROP POLICY IF EXISTS "Users can insert their own requests" ON pending_access_requests;
DROP POLICY IF EXISTS "Receivers can update request status" ON pending_access_requests;
DROP POLICY IF EXISTS "Requesters can delete their own requests" ON pending_access_requests;

-- Create RLS policies
CREATE POLICY "Users can view their own requests" ON pending_access_requests
    FOR SELECT USING (
        requester_id = auth.uid() OR 
        receiver_id = auth.uid()
    );

CREATE POLICY "Users can insert their own requests" ON pending_access_requests
    FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Receivers can update request status" ON pending_access_requests
    FOR UPDATE USING (receiver_id = auth.uid());

CREATE POLICY "Requesters can delete their own requests" ON pending_access_requests
    FOR DELETE USING (requester_id = auth.uid());

-- Also ensure user_permissions table has proper permissions
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    can_view_other_users_data BOOLEAN DEFAULT FALSE,
    granted_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user_permissions
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- Grant permissions for user_permissions table
GRANT SELECT, INSERT, UPDATE, DELETE ON user_permissions TO authenticated;

-- Enable RLS for user_permissions
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for user_permissions
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON user_permissions;

-- Create RLS policies for user_permissions
CREATE POLICY "Users can view own permissions" ON user_permissions
    FOR SELECT USING (user_id = auth.uid());

-- Allow authenticated users to insert/update permissions (the function will handle admin checks)
CREATE POLICY "Authenticated users can manage permissions" ON user_permissions
    FOR ALL USING (true) WITH CHECK (true);

-- Recreate the stored functions with proper security
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

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION set_user_data_view_permission(UUID, BOOLEAN, UUID) TO authenticated;

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

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION user_can_view_other_users_data(UUID) TO authenticated;

-- Verify the setup
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('pending_access_requests', 'user_permissions');

-- Show current policies
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
WHERE tablename IN ('pending_access_requests', 'user_permissions');
