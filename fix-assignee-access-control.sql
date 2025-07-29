-- =====================================================
-- COMPLETE FIX FOR ASSIGNEE ACCESS CONTROL SYSTEM
-- This creates the access_control table with proper permissions
-- =====================================================

-- 1. Drop existing table and function if they exist
DROP TABLE IF EXISTS public.access_control CASCADE;
DROP FUNCTION IF EXISTS public.get_accessible_user_ids(uuid);

-- 2. Create access_control table
CREATE TABLE public.access_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, granted_to_user_id)
);

-- 3. Create indexes for better performance
CREATE INDEX idx_access_control_user_id ON public.access_control(user_id);
CREATE INDEX idx_access_control_granted_to_user_id ON public.access_control(granted_to_user_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.access_control ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for access_control table
-- Allow users to see access control records they are involved in
CREATE POLICY "Users can view their access grants" ON public.access_control
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        granted_to_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- Allow users to grant access to their own data
CREATE POLICY "Users can grant access to their data" ON public.access_control
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- Allow users to revoke access they granted
CREATE POLICY "Users can revoke access they granted" ON public.access_control
    FOR DELETE USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- 6. Grant permissions to authenticated users
GRANT SELECT, INSERT, DELETE ON public.access_control TO authenticated;
GRANT ALL ON public.access_control TO service_role;

-- 7. Create helper function to get accessible user IDs
CREATE OR REPLACE FUNCTION public.get_accessible_user_ids(auth_user_uuid UUID)
RETURNS UUID[] AS $$
DECLARE
    public_user_id UUID;
    accessible_ids UUID[];
    is_admin BOOLEAN := FALSE;
    granted_ids UUID[];
BEGIN
    -- Get the public user ID from auth user ID
    SELECT id INTO public_user_id 
    FROM public.users 
    WHERE auth_user_id = auth_user_uuid;
    
    -- If no public user found, return empty array
    IF public_user_id IS NULL THEN
        RETURN ARRAY[]::UUID[];
    END IF;
    
    -- Check if user is admin by checking auth.users metadata
    SELECT COALESCE(
        (SELECT (raw_user_meta_data->>'role') = 'admin' 
         FROM auth.users 
         WHERE id = auth_user_uuid), 
        FALSE
    ) INTO is_admin;
    
    IF is_admin THEN
        -- If admin, return all user IDs
        SELECT ARRAY(SELECT id FROM public.users) INTO accessible_ids;
    ELSE
        -- For regular users, start with their own ID
        accessible_ids := ARRAY[public_user_id];
        
        -- Get user IDs that granted access to this user
        SELECT ARRAY_AGG(user_id) INTO granted_ids
        FROM public.access_control 
        WHERE granted_to_user_id = public_user_id;
        
        -- Combine own ID with granted IDs
        IF granted_ids IS NOT NULL THEN
            accessible_ids := accessible_ids || granted_ids;
        END IF;
    END IF;
    
    -- Remove any NULL values and return unique values
    SELECT ARRAY(
        SELECT DISTINCT unnest(accessible_ids) 
        WHERE unnest IS NOT NULL
    ) INTO accessible_ids;
    
    RETURN COALESCE(accessible_ids, ARRAY[public_user_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_accessible_user_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_user_ids(UUID) TO service_role;

-- 9. Insert sample data for testing (optional - remove if not needed)
-- This creates a sample admin -> assignee relationship
-- Uncomment these lines if you want to test with sample data:

-- INSERT INTO public.access_control (user_id, granted_to_user_id)
-- SELECT 
--     admin_user.id as user_id,
--     assignee_user.id as granted_to_user_id
-- FROM 
--     (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1) admin_user,
--     (SELECT id FROM public.users WHERE role = 'user' LIMIT 1) assignee_user
-- WHERE admin_user.id IS NOT NULL AND assignee_user.id IS NOT NULL
-- ON CONFLICT (user_id, granted_to_user_id) DO NOTHING;

-- 10. Verify the setup
SELECT 'Access control table and function created successfully!' AS status;

-- Show table structure
SELECT 'access_control table columns:' AS info, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'access_control' AND table_schema = 'public'
ORDER BY ordinal_position;
