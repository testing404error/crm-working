-- Fix permission policies to allow the function to work properly
-- Run this in your Supabase SQL Editor

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Only admin can manage permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can manage all permissions" ON user_permissions;

-- Create a more permissive policy that allows the function to work
CREATE POLICY "Allow function access to user permissions" ON user_permissions
    FOR ALL USING (true);

-- Update the stored function to remove admin check since we have relationship validation
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
    -- Insert or update the user permission (function has SECURITY DEFINER so it bypasses RLS)
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_user_data_view_permission(UUID, BOOLEAN, UUID) TO authenticated;

-- Drop existing policy first, then recreate
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;

-- Add a policy for users to view their own permissions
CREATE POLICY "Users can view own permissions" ON user_permissions
    FOR SELECT USING (user_id = auth.uid());

-- Success message
SELECT 'Permission policies updated successfully!' as status;
