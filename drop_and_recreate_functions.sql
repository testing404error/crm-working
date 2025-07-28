-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_dashboard_metrics_ultimate();
DROP FUNCTION IF EXISTS get_lead_sources_ultimate();
DROP FUNCTION IF EXISTS get_pipeline_data_ultimate();
DROP FUNCTION IF EXISTS get_top_opportunities_ultimate();
DROP FUNCTION IF EXISTS is_user_admin();

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    );
END;
$$;

-- Dashboard metrics function
CREATE OR REPLACE FUNCTION get_dashboard_metrics_ultimate()
RETURNS TABLE (
    total_leads bigint,
    total_opportunities bigint,
    total_value numeric,
    conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF is_user_admin() THEN
        -- Admin can see all data
        RETURN QUERY
        SELECT 
            (SELECT COUNT(*) FROM leads)::bigint as total_leads,
            (SELECT COUNT(*) FROM opportunities)::bigint as total_opportunities,
            (SELECT COALESCE(SUM(amount), 0) FROM opportunities WHERE status = 'closed_won')::numeric as total_value,
            (CASE 
                WHEN (SELECT COUNT(*) FROM leads) > 0 
                THEN (SELECT COUNT(*) FROM opportunities WHERE status = 'closed_won')::numeric * 100.0 / (SELECT COUNT(*) FROM leads)::numeric
                ELSE 0
            END)::numeric as conversion_rate;
    ELSE
        -- Regular user can only see their own data
        RETURN QUERY
        SELECT 
            (SELECT COUNT(*) FROM leads WHERE assigned_to = auth.uid() OR created_by = auth.uid())::bigint as total_leads,
            (SELECT COUNT(*) FROM opportunities WHERE assigned_to = auth.uid() OR created_by = auth.uid())::bigint as total_opportunities,
            (SELECT COALESCE(SUM(amount), 0) FROM opportunities WHERE (assigned_to = auth.uid() OR created_by = auth.uid()) AND status = 'closed_won')::numeric as total_value,
            (CASE 
                WHEN (SELECT COUNT(*) FROM leads WHERE assigned_to = auth.uid() OR created_by = auth.uid()) > 0 
                THEN (SELECT COUNT(*) FROM opportunities WHERE (assigned_to = auth.uid() OR created_by = auth.uid()) AND status = 'closed_won')::numeric * 100.0 / (SELECT COUNT(*) FROM leads WHERE assigned_to = auth.uid() OR created_by = auth.uid())::numeric
                ELSE 0
            END)::numeric as conversion_rate;
    END IF;
END;
$$;

-- Lead sources function
CREATE OR REPLACE FUNCTION get_lead_sources_ultimate()
RETURNS TABLE (
    source text,
    count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF is_user_admin() THEN
        -- Admin can see all lead sources
        RETURN QUERY
        SELECT 
            COALESCE(l.source, 'Unknown')::text as source,
            COUNT(*)::bigint as count
        FROM leads l
        GROUP BY l.source
        ORDER BY count DESC;
    ELSE
        -- Regular user can only see their own lead sources
        RETURN QUERY
        SELECT 
            COALESCE(l.source, 'Unknown')::text as source,
            COUNT(*)::bigint as count
        FROM leads l
        WHERE l.assigned_to = auth.uid() OR l.created_by = auth.uid()
        GROUP BY l.source
        ORDER BY count DESC;
    END IF;
END;
$$;

-- Pipeline data function
CREATE OR REPLACE FUNCTION get_pipeline_data_ultimate()
RETURNS TABLE (
    stage text,
    count bigint,
    total_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF is_user_admin() THEN
        -- Admin can see all pipeline data
        RETURN QUERY
        SELECT 
            COALESCE(o.stage, 'Unknown')::text as stage,
            COUNT(*)::bigint as count,
            COALESCE(SUM(o.amount), 0)::numeric as total_value
        FROM opportunities o
        GROUP BY o.stage
        ORDER BY total_value DESC;
    ELSE
        -- Regular user can only see their own pipeline data
        RETURN QUERY
        SELECT 
            COALESCE(o.stage, 'Unknown')::text as stage,
            COUNT(*)::bigint as count,
            COALESCE(SUM(o.amount), 0)::numeric as total_value
        FROM opportunities o
        WHERE o.assigned_to = auth.uid() OR o.created_by = auth.uid()
        GROUP BY o.stage
        ORDER BY total_value DESC;
    END IF;
END;
$$;

-- Top opportunities function
CREATE OR REPLACE FUNCTION get_top_opportunities_ultimate()
RETURNS TABLE (
    id uuid,
    title text,
    amount numeric,
    stage text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF is_user_admin() THEN
        -- Admin can see all top opportunities
        RETURN QUERY
        SELECT 
            o.id,
            o.title::text,
            o.amount::numeric,
            o.stage::text,
            o.created_at
        FROM opportunities o
        ORDER BY o.amount DESC NULLS LAST
        LIMIT 10;
    ELSE
        -- Regular user can only see their own top opportunities
        RETURN QUERY
        SELECT 
            o.id,
            o.title::text,
            o.amount::numeric,
            o.stage::text,
            o.created_at
        FROM opportunities o
        WHERE o.assigned_to = auth.uid() OR o.created_by = auth.uid()
        ORDER BY o.amount DESC NULLS LAST
        LIMIT 10;
    END IF;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_metrics_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_lead_sources_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pipeline_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_opportunities_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;
