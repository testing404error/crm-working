-- =====================================================
-- ADD USER PERMISSIONS SYSTEM (FIXED VERSION)
-- This migration adds support for granular user permissions
-- =====================================================

-- Drop existing functions first to avoid conflicts
DROP FUNCTION IF EXISTS set_user_data_view_permission(uuid, boolean, uuid);
DROP FUNCTION IF EXISTS user_can_view_other_users_data(uuid);

-- Create user_permissions table
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    can_view_other_users_data BOOLEAN DEFAULT false,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted_by ON public.user_permissions(granted_by);

-- Enable Row Level Security
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can view all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can update their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;

-- Create RLS policies for user_permissions table
CREATE POLICY "Users can view their own permissions" ON public.user_permissions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all permissions" ON public.user_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND COALESCE(raw_user_meta_data->>'role', 'user') = 'admin'
        )
    );

CREATE POLICY "Users can update their own permissions" ON public.user_permissions
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all permissions" ON public.user_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND COALESCE(raw_user_meta_data->>'role', 'user') = 'admin'
        )
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

-- Create helper function to check if user can view other users' data
CREATE OR REPLACE FUNCTION user_can_view_other_users_data(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (SELECT can_view_other_users_data 
         FROM public.user_permissions 
         WHERE user_id = check_user_id), 
        FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to set user's "Can View Other Users' Data" permission
CREATE OR REPLACE FUNCTION set_user_data_view_permission(
    target_user_id UUID,
    can_view BOOLEAN,
    admin_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    admin_role TEXT;
BEGIN
    -- Check if the requester is admin
    SELECT COALESCE(raw_user_meta_data->>'role', 'user') INTO admin_role
    FROM auth.users 
    WHERE id = admin_id;
    
    IF admin_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can modify user permissions';
    END IF;
    
    -- Insert or update the permission
    INSERT INTO public.user_permissions (user_id, can_view_other_users_data, granted_by)
    VALUES (target_user_id, can_view, admin_id)
    ON CONFLICT (user_id) DO UPDATE SET
        can_view_other_users_data = EXCLUDED.can_view_other_users_data,
        granted_by = EXCLUDED.granted_by,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION user_can_view_other_users_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_data_view_permission(UUID, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_view_other_users_data(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION set_user_data_view_permission(UUID, BOOLEAN, UUID) TO service_role;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON public.user_permissions;

-- Create the updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at 
    BEFORE UPDATE ON public.user_permissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'User permissions system created successfully!' AS status;
