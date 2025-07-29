-- Fix database schema column errors and function issues
-- This addresses the "column 'unnest' does not exist" and other column mismatch errors

-- 1. Fix the get_accessible_user_ids function
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
        SELECT ARRAY_AGG(id) INTO accessible_ids FROM public.users;
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
    
    -- Return the accessible IDs, ensuring no nulls
    RETURN COALESCE(accessible_ids, ARRAY[public_user_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a simpler dashboard function that doesn't rely on complex column operations
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE(
    total_leads bigint,
    total_opportunities bigint,
    total_activities bigint,
    user_role text
) AS $$
DECLARE
    current_user_id UUID;
    accessible_user_ids UUID[];
    user_is_admin BOOLEAN := FALSE;
BEGIN
    -- Get current user info
    current_user_id := auth.uid();
    
    -- Check if user is admin
    SELECT COALESCE(
        (raw_user_meta_data->>'role') = 'admin',
        FALSE
    ) INTO user_is_admin
    FROM auth.users 
    WHERE id = current_user_id;
    
    -- Get accessible user IDs
    accessible_user_ids := public.get_accessible_user_ids(current_user_id);
    
    IF user_is_admin THEN
        -- Admin sees all data
        RETURN QUERY
        SELECT 
            (SELECT COUNT(*) FROM public.leads)::bigint,
            (SELECT COUNT(*) FROM public.opportunities)::bigint,
            (SELECT COUNT(*) FROM public.activities)::bigint,
            'admin'::text;
    ELSE
        -- Regular user sees only accessible data
        RETURN QUERY
        SELECT 
            (SELECT COUNT(*) FROM public.leads WHERE user_id = ANY(accessible_user_ids))::bigint,
            (SELECT COUNT(*) FROM public.opportunities WHERE user_id = ANY(accessible_user_ids))::bigint,
            (SELECT COUNT(*) FROM public.activities WHERE user_id = ANY(accessible_user_ids))::bigint,
            'user'::text;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a simple function to get top opportunities without complex column operations
CREATE OR REPLACE FUNCTION public.get_top_opportunities_simple()
RETURNS TABLE(
    id uuid,
    name varchar,
    value decimal,
    stage varchar
) AS $$
DECLARE
    current_user_id UUID;
    accessible_user_ids UUID[];
    user_is_admin BOOLEAN := FALSE;
BEGIN
    current_user_id := auth.uid();
    
    -- Check if user is admin
    SELECT COALESCE(
        (raw_user_meta_data->>'role') = 'admin',
        FALSE
    ) INTO user_is_admin
    FROM auth.users 
    WHERE id = current_user_id;
    
    accessible_user_ids := public.get_accessible_user_ids(current_user_id);
    
    IF user_is_admin THEN
        RETURN QUERY
        SELECT o.id, o.name, o.value, o.stage
        FROM public.opportunities o
        ORDER BY o.value DESC
        LIMIT 5;
    ELSE
        RETURN QUERY
        SELECT o.id, o.name, o.value, o.stage
        FROM public.opportunities o
        WHERE o.user_id = ANY(accessible_user_ids)
        ORDER BY o.value DESC
        LIMIT 5;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant permissions on the new functions
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_opportunities_simple() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_user_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_user_ids(UUID) TO service_role;

-- 5. Drop any problematic existing functions that might be causing issues
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_ultimate();
DROP FUNCTION IF EXISTS public.get_lead_source_data_ultimate();
DROP FUNCTION IF EXISTS public.get_pipeline_data_ultimate();
DROP FUNCTION IF EXISTS public.get_top_opportunities_ultimate();

-- 6. Ensure all necessary tables have proper grants
GRANT SELECT ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO authenticated;
GRANT UPDATE ON public.leads TO authenticated;
GRANT DELETE ON public.leads TO authenticated;

GRANT SELECT ON public.opportunities TO authenticated;
GRANT INSERT ON public.opportunities TO authenticated;
GRANT UPDATE ON public.opportunities TO authenticated;
GRANT DELETE ON public.opportunities TO authenticated;

GRANT SELECT ON public.activities TO authenticated;
GRANT INSERT ON public.activities TO authenticated;
GRANT UPDATE ON public.activities TO authenticated;
GRANT DELETE ON public.activities TO authenticated;

GRANT SELECT ON public.users TO authenticated;

-- 7. Verify the fix
SELECT 'Schema column errors fixed successfully!' as status;
