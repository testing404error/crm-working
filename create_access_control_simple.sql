-- =====================================================
-- SIMPLE ACCESS CONTROL TABLE CREATION
-- This fixes the 404 error with minimal changes
-- =====================================================

-- 1. Create access_control table (the main one causing 404 error)
CREATE TABLE IF NOT EXISTS public.access_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, granted_to_user_id)
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_access_control_user_id ON public.access_control(user_id);
CREATE INDEX IF NOT EXISTS idx_access_control_granted_to_user_id ON public.access_control(granted_to_user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.access_control ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view access control they are involved in" ON public.access_control;
DROP POLICY IF EXISTS "Users can grant access to their data" ON public.access_control;
DROP POLICY IF EXISTS "Users can revoke access they granted" ON public.access_control;

-- 5. Create RLS policies for access_control table
CREATE POLICY "Users can view access control they are involved in" ON public.access_control
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        granted_to_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can grant access to their data" ON public.access_control
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can revoke access they granted" ON public.access_control
    FOR DELETE USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- 6. Grant permissions to authenticated users
GRANT ALL ON public.access_control TO authenticated;
GRANT ALL ON public.access_control TO service_role;

-- 7. Create helper function to get accessible user IDs
CREATE OR REPLACE FUNCTION public.get_accessible_user_ids(auth_user_uuid UUID)
RETURNS UUID[] AS $$
DECLARE
    public_user_id UUID;
    accessible_ids UUID[];
    is_admin BOOLEAN := FALSE;
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
        
        -- Add user IDs that granted access to this user
        SELECT accessible_ids || ARRAY_AGG(user_id) INTO accessible_ids
        FROM public.access_control 
        WHERE granted_to_user_id = public_user_id;
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

-- 9. Verify the setup
SELECT 'Access control table created successfully!' AS status;

-- Check if table was created
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'access_control' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
