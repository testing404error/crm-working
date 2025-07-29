-- =====================================================
-- CREATE ACCESS CONTROL TABLE AND RELATED STRUCTURES
-- This fixes the 404 error when checking user permissions
-- =====================================================

-- 1. Create access_control table for user permissions
CREATE TABLE IF NOT EXISTS public.access_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, granted_to_user_id)
);

-- 2. Create access_requests table for permission requests
CREATE TABLE IF NOT EXISTS public.access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    requested_from_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(requester_id, requested_from_id)
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_access_control_user_id ON public.access_control(user_id);
CREATE INDEX IF NOT EXISTS idx_access_control_granted_to_user_id ON public.access_control(granted_to_user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_requester_id ON public.access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_requested_from_id ON public.access_requests(requested_from_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

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

-- 6. Create RLS policies for access_requests table
CREATE POLICY "Users can view their own access requests" ON public.access_requests
    FOR SELECT USING (
        requester_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        requested_from_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can create access requests" ON public.access_requests
    FOR INSERT WITH CHECK (
        requester_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can update requests they received" ON public.access_requests
    FOR UPDATE USING (
        requested_from_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- 7. Grant permissions to authenticated users
GRANT ALL ON public.access_control TO authenticated;
GRANT ALL ON public.access_requests TO authenticated;

-- Grant permissions to service role
GRANT ALL ON public.access_control TO service_role;
GRANT ALL ON public.access_requests TO service_role;

-- 8. Create helper function to get accessible user IDs (improved version)
CREATE OR REPLACE FUNCTION public.get_accessible_user_ids(requesting_user_id UUID)
RETURNS UUID[] AS $$
DECLARE
    accessible_ids UUID[];
    is_admin BOOLEAN := FALSE;
BEGIN
    -- Check if user is admin by checking auth.users metadata
    SELECT COALESCE(
        (SELECT (raw_user_meta_data->>'role') = 'admin' 
         FROM auth.users 
         WHERE id = requesting_user_id), 
        FALSE
    ) INTO is_admin;
    
    IF is_admin THEN
        -- If admin, return all user IDs
        SELECT ARRAY(SELECT id FROM public.users) INTO accessible_ids;
    ELSE
        -- For regular users, return own ID + granted access IDs
        SELECT ARRAY(
            SELECT DISTINCT unnest(ARRAY[
                requesting_user_id,
                -- Add user IDs that granted access to this user
                (SELECT ARRAY_AGG(user_id) FROM public.access_control WHERE granted_to_user_id = requesting_user_id)
            ])
        ) INTO accessible_ids;
        
        -- Remove any NULL values
        SELECT ARRAY(SELECT unnest(accessible_ids) WHERE unnest IS NOT NULL) INTO accessible_ids;
    END IF;
    
    RETURN COALESCE(accessible_ids, ARRAY[requesting_user_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_accessible_user_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_user_ids(UUID) TO service_role;

-- 10. Create a trigger to update updated_at on access_requests
CREATE OR REPLACE FUNCTION update_access_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_access_requests_updated_at
    BEFORE UPDATE ON public.access_requests
    FOR EACH ROW EXECUTE FUNCTION update_access_requests_updated_at();

-- 11. Verify the setup
SELECT 'Access control tables created successfully!' AS status;

-- Show table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('access_control', 'access_requests') 
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;
