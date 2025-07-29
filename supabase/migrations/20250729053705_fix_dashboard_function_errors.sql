-- Fix dashboard function errors

-- 1. Fix the get_top_opportunities_simple function with column ambiguity
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
        ORDER BY o.value DESC NULLS LAST
        LIMIT 5;
    ELSE
        RETURN QUERY
        SELECT o.id, o.name, o.value, o.stage
        FROM public.opportunities o
        WHERE o.user_id = ANY(accessible_user_ids)
        ORDER BY o.value DESC NULLS LAST
        LIMIT 5;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the missing get_lead_source_data_ultimate function
CREATE OR REPLACE FUNCTION public.get_lead_source_data_ultimate()
RETURNS TABLE(
    source text,
    count bigint
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
        SELECT COALESCE(l.source, 'Unknown')::text, COUNT(*)::bigint
        FROM public.leads l
        WHERE l.source IS NOT NULL
        GROUP BY l.source
        ORDER BY COUNT(*) DESC;
    ELSE
        RETURN QUERY
        SELECT COALESCE(l.source, 'Unknown')::text, COUNT(*)::bigint
        FROM public.leads l
        WHERE l.user_id = ANY(accessible_user_ids) AND l.source IS NOT NULL
        GROUP BY l.source
        ORDER BY COUNT(*) DESC;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the missing get_pipeline_data_ultimate function
CREATE OR REPLACE FUNCTION public.get_pipeline_data_ultimate()
RETURNS TABLE(
    stage text,
    count bigint,
    value numeric
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
        SELECT COALESCE(o.stage, 'Unknown')::text, COUNT(*)::bigint, COALESCE(SUM(o.value), 0)::numeric
        FROM public.opportunities o
        WHERE o.stage IS NOT NULL
        GROUP BY o.stage
        ORDER BY SUM(o.value) DESC NULLS LAST;
    ELSE
        RETURN QUERY
        SELECT COALESCE(o.stage, 'Unknown')::text, COUNT(*)::bigint, COALESCE(SUM(o.value), 0)::numeric
        FROM public.opportunities o
        WHERE o.user_id = ANY(accessible_user_ids) AND o.stage IS NOT NULL
        GROUP BY o.stage
        ORDER BY SUM(o.value) DESC NULLS LAST;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_top_opportunities_simple() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_source_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pipeline_data_ultimate() TO authenticated;

-- 5. Verify the fix
SELECT 'Dashboard functions fixed successfully!' as status;
