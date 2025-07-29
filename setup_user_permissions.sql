-- =====================================================
-- COMPLETE USER PERMISSIONS AND ACCESS CONTROL SETUP
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Create the pending_access_requests table
CREATE TABLE IF NOT EXISTS pending_access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    can_view_other_users_data BOOLEAN DEFAULT FALSE,
    granted_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the access_control table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS access_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, granted_to_user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON pending_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_receiver ON pending_access_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON pending_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_access_control_user_id ON access_control(user_id);
CREATE INDEX IF NOT EXISTS idx_access_control_granted_to_user_id ON access_control(granted_to_user_id);

-- Enable Row Level Security
ALTER TABLE pending_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own requests" ON pending_access_requests;
DROP POLICY IF EXISTS "Users can insert their own requests" ON pending_access_requests;
DROP POLICY IF EXISTS "Receivers can update request status" ON pending_access_requests;
DROP POLICY IF EXISTS "Requesters can delete their own requests" ON pending_access_requests;
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Only admin can manage permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can view access control they are involved in" ON access_control;
DROP POLICY IF EXISTS "Users can grant access to their data" ON access_control;
DROP POLICY IF EXISTS "Users can revoke access they granted" ON access_control;

-- Create policies for pending_access_requests
CREATE POLICY "Users can view their own requests" ON pending_access_requests
    FOR SELECT USING (requester_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can insert their own requests" ON pending_access_requests
    FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Receivers can update request status" ON pending_access_requests
    FOR UPDATE USING (receiver_id = auth.uid());

CREATE POLICY "Requesters can delete their own requests" ON pending_access_requests
    FOR DELETE USING (requester_id = auth.uid());

-- Create policies for user_permissions
CREATE POLICY "Users can view own permissions" ON user_permissions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all permissions" ON user_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create policies for access_control table
CREATE POLICY "Users can view access control they are involved in" ON access_control
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        granted_to_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can grant access to their data" ON access_control
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can revoke access they granted" ON access_control
    FOR DELETE USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- Create stored function to set user data view permission
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
    -- Check if the admin user has admin role
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = admin_user_id 
        AND raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RETURN FALSE;
    END IF;
    
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

-- Create function to check if user can view other users' data
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
    -- First check if user is admin
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = check_user_id 
        AND raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Then check user permissions
    SELECT can_view_other_users_data INTO can_view
    FROM user_permissions
    WHERE user_id = check_user_id;
    
    RETURN COALESCE(can_view, FALSE);
END;
$$;

-- Grant necessary permissions
GRANT ALL ON pending_access_requests TO authenticated;
GRANT ALL ON user_permissions TO authenticated;
GRANT ALL ON access_control TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_data_view_permission(UUID, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_view_other_users_data(UUID) TO authenticated;

-- Success message
SELECT 'User permissions and access control setup completed successfully!' as status;
