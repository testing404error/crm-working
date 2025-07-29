-- Complete fix for dashboard functions with correct column names
-- Run this entire script in Supabase SQL Editor

-- Drop all existing dashboard functions
DROP FUNCTION IF EXISTS get_top_opportunities_simple();
DROP FUNCTION IF EXISTS get_lead_source_data_ultimate();
DROP FUNCTION IF EXISTS get_pipeline_data_ultimate();

-- Recreate get_top_opportunities_simple with correct column names
CREATE FUNCTION get_top_opportunities_simple()
RETURNS TABLE (
    id UUID,
    name TEXT,
    company TEXT,
    value NUMERIC,
    stage TEXT,
    probability INTEGER,
    expected_close_date DATE,
    created_at TIMESTAMPTZ,
    assigned_to UUID,
    assigned_to_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    user_role TEXT;
    is_admin BOOLEAN;
    accessible_user_ids UUID[];
BEGIN
    -- Get current user ID from auth
    current_user_id := auth.uid();
    
    -- Get user role and admin status
    SELECT u.role, (u.role = 'admin') INTO user_role, is_admin
    FROM public.users u
    WHERE u.auth_user_id = current_user_id;
    
    -- Get accessible user IDs based on role and permissions
    IF is_admin THEN
        -- Admin can see all opportunities
        RETURN QUERY
        SELECT 
            o.id,
            o.name,
            COALESCE(l.company, 'Unknown') as company,
            o.value,
            o.stage,
            o.probability,
            o.expected_close_date,
            o.created_at,
            o.assigned_to,
            COALESCE(u.name, u.email) as assigned_to_name
        FROM opportunities o
        LEFT JOIN leads l ON o.lead_id = l.id
        LEFT JOIN public.users u ON o.assigned_to = u.id
        ORDER BY o.value DESC NULLS LAST, o.created_at DESC
        LIMIT 10;
    ELSE
        -- Non-admin users: get accessible user IDs
        SELECT get_accessible_user_ids(current_user_id) INTO accessible_user_ids;
        
        RETURN QUERY
        SELECT 
            o.id,
            o.name,
            COALESCE(l.company, 'Unknown') as company,
            o.value,
            o.stage,
            o.probability,
            o.expected_close_date,
            o.created_at,
            o.assigned_to,
            COALESCE(u.name, u.email) as assigned_to_name
        FROM opportunities o
        LEFT JOIN leads l ON o.lead_id = l.id
        LEFT JOIN public.users u ON o.assigned_to = u.id
        WHERE (o.user_id = current_user_id OR 
               o.assigned_to = current_user_id OR 
               o.user_id = ANY(accessible_user_ids) OR 
               o.assigned_to = ANY(accessible_user_ids))
        ORDER BY o.value DESC NULLS LAST, o.created_at DESC
        LIMIT 10;
    END IF;
END;
$$;

-- Recreate get_lead_source_data_ultimate with correct column names
CREATE FUNCTION get_lead_source_data_ultimate()
RETURNS TABLE (
    source TEXT,
    count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    user_role TEXT;
    is_admin BOOLEAN;
    accessible_user_ids UUID[];
BEGIN
    -- Get current user ID from auth
    current_user_id := auth.uid();
    
    -- Get user role and admin status
    SELECT u.role, (u.role = 'admin') INTO user_role, is_admin
    FROM public.users u
    WHERE u.auth_user_id = current_user_id;
    
    -- Get accessible user IDs based on role and permissions
    IF is_admin THEN
        -- Admin can see all lead sources
        RETURN QUERY
        SELECT 
            COALESCE(l.source, 'Unknown') as source,
            COUNT(l.id) as count
        FROM leads l
        WHERE l.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY l.source
        ORDER BY count DESC;
    ELSE
        -- Non-admin users: get accessible user IDs
        SELECT get_accessible_user_ids(current_user_id) INTO accessible_user_ids;
        
        RETURN QUERY
        SELECT 
            COALESCE(l.source, 'Unknown') as source,
            COUNT(l.id) as count
        FROM leads l
        WHERE l.created_at >= NOW() - INTERVAL '30 days'
          AND (l.user_id = current_user_id OR 
               l.assigned_to = current_user_id OR 
               l.user_id = ANY(accessible_user_ids) OR 
               l.assigned_to = ANY(accessible_user_ids))
        GROUP BY l.source
        ORDER BY count DESC;
    END IF;
END;
$$;

-- Recreate get_pipeline_data_ultimate with correct column names
CREATE FUNCTION get_pipeline_data_ultimate()
RETURNS TABLE (
    stage TEXT,
    count BIGINT,
    total_amount NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    user_role TEXT;
    is_admin BOOLEAN;
    accessible_user_ids UUID[];
BEGIN
    -- Get current user ID from auth
    current_user_id := auth.uid();
    
    -- Get user role and admin status
    SELECT u.role, (u.role = 'admin') INTO user_role, is_admin
    FROM public.users u
    WHERE u.auth_user_id = current_user_id;
    
    -- Get accessible user IDs based on role and permissions
    IF is_admin THEN
        -- Admin can see all pipeline data
        RETURN QUERY
        SELECT 
            COALESCE(o.stage, 'Unknown') as stage,
            COUNT(o.id) as count,
            COALESCE(SUM(o.value), 0) as total_amount
        FROM opportunities o
        WHERE o.created_at >= NOW() - INTERVAL '90 days'
        GROUP BY o.stage
        ORDER BY total_amount DESC;
    ELSE
        -- Non-admin users: get accessible user IDs
        SELECT get_accessible_user_ids(current_user_id) INTO accessible_user_ids;
        
        RETURN QUERY
        SELECT 
            COALESCE(o.stage, 'Unknown') as stage,
            COUNT(o.id) as count,
            COALESCE(SUM(o.value), 0) as total_amount
        FROM opportunities o
        WHERE o.created_at >= NOW() - INTERVAL '90 days'
          AND (o.user_id = current_user_id OR 
               o.assigned_to = current_user_id OR 
               o.user_id = ANY(accessible_user_ids) OR 
               o.assigned_to = ANY(accessible_user_ids))
        GROUP BY o.stage
        ORDER BY total_amount DESC;
    END IF;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_top_opportunities_simple() TO authenticated;
GRANT EXECUTE ON FUNCTION get_lead_source_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pipeline_data_ultimate() TO authenticated;

-- Verify the functions exist and show their return types
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_top_opportunities_simple', 'get_lead_source_data_ultimate', 'get_pipeline_data_ultimate')
ORDER BY routine_name;
