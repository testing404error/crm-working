-- ============================================
-- USER PERMISSIONS MIGRATION
-- Run this in your Supabase Dashboard > SQL Editor
-- ============================================

-- Create user permissions table to handle "Can View Other Users' Data" toggle
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL, -- The user who has these permissions
    can_view_other_users_data BOOLEAN DEFAULT false, -- The main permission we're adding
    granted_by UUID, -- Which admin granted this permission
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id) -- Each user can only have one permissions record
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted_by ON user_permissions(granted_by);

-- Enable Row Level Security
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_permissions table
-- Users can view their own permissions
DROP POLICY IF EXISTS "users_can_view_own_permissions" ON user_permissions;
CREATE POLICY "users_can_view_own_permissions" ON user_permissions
    FOR SELECT USING (user_id = auth.uid());

-- Admins can view all permissions
DROP POLICY IF EXISTS "admins_can_view_all_permissions" ON user_permissions;
CREATE POLICY "admins_can_view_all_permissions" ON user_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admins can insert/update user permissions
DROP POLICY IF EXISTS "admins_can_manage_permissions" ON user_permissions;
CREATE POLICY "admins_can_manage_permissions" ON user_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;
CREATE TRIGGER update_user_permissions_updated_at
    BEFORE UPDATE ON user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_permissions_updated_at();

-- Function to check if a user has permission to view other users' data
CREATE OR REPLACE FUNCTION user_can_view_other_users_data(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- First check if user is admin (admins can always see everything)
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = check_user_id 
        AND raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RETURN true;
    END IF;
    
    -- Check if user has explicit permission
    RETURN EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = check_user_id 
        AND can_view_other_users_data = true
    );
END;
$$;

-- Function to grant/revoke permission for a user
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
    -- Verify that the admin_user_id is actually an admin
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = admin_user_id 
        AND raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RETURN false;
    END IF;
    
    -- Insert or update the permission
    INSERT INTO user_permissions (user_id, can_view_other_users_data, granted_by)
    VALUES (target_user_id, can_view, admin_user_id)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        can_view_other_users_data = EXCLUDED.can_view_other_users_data,
        granted_by = EXCLUDED.granted_by,
        updated_at = NOW();
    
    RETURN true;
END;
$$;

-- Insert a record to confirm migration was applied
INSERT INTO user_permissions (user_id, can_view_other_users_data, granted_by)
VALUES ('00000000-0000-0000-0000-000000000000', false, '00000000-0000-0000-0000-000000000000')
ON CONFLICT (user_id) DO NOTHING;

-- Show confirmation
SELECT 'User permissions migration applied successfully!' as status;
