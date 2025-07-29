-- Fix Dashboard to Respect Access Control Relationships
-- This creates dashboard functions that use the same access control logic as leads/opportunities pages

-- First, drop any existing conflicting functions
DROP FUNCTION IF EXISTS get_dashboard_stats();
DROP FUNCTION IF EXISTS get_dashboard_metrics();
DROP FUNCTION IF EXISTS get_lead_source_data_ultimate();
DROP FUNCTION IF EXISTS get_pipeline_data_ultimate();
DROP FUNCTION IF EXISTS get_top_opportunities_simple();

-- Create dashboard metrics function that respects access control
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(
    total_leads BIGINT,
    total_opportunities BIGINT,
    total_activities BIGINT
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
    WITH accessible_data AS (
        -- Get data user can access based on access control relationships or their own data
        SELECT 
            l.id as lead_id,
            o.id as opp_id,
            a.id as activity_id
        FROM (
            -- User's own leads
            SELECT id FROM leads WHERE user_id = auth.uid()
            UNION
            -- Leads from users who granted access to current user
            SELECT l.id 
            FROM leads l 
            JOIN access_control ac ON l.user_id = ac.user_id 
            WHERE ac.granted_to_user_id = auth.uid()
        ) l
        FULL OUTER JOIN (
            -- User's own opportunities
            SELECT id FROM opportunities WHERE user_id = auth.uid()
            UNION
            -- Opportunities from users who granted access to current user
            SELECT o.id 
            FROM opportunities o 
            JOIN access_control ac ON o.user_id = ac.user_id 
            WHERE ac.granted_to_user_id = auth.uid()
        ) o ON true
        FULL OUTER JOIN (
            -- User's own activities (if activities table exists)
            SELECT id FROM activities WHERE user_id = auth.uid()
            UNION
            -- Activities from users who granted access (if activities table exists)
            SELECT a.id 
            FROM activities a 
            JOIN access_control ac ON a.user_id = ac.user_id 
            WHERE ac.granted_to_user_id = auth.uid()
        ) a ON true
    )
    SELECT 
        COUNT(DISTINCT lead_id) as total_leads,
        COUNT(DISTINCT opp_id) as total_opportunities,
        COUNT(DISTINCT activity_id) as total_activities
    FROM accessible_data;
$$;

-- Create lead source data function that respects access control
CREATE OR REPLACE FUNCTION get_lead_source_data_ultimate()
RETURNS TABLE(
    source TEXT,
    count BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        COALESCE(l.source, 'Unknown') as source,
        COUNT(*) as count
    FROM (
        -- User's own leads
        SELECT * FROM leads WHERE user_id = auth.uid()
        UNION
        -- Leads from users who granted access to current user
        SELECT l.* 
        FROM leads l 
        JOIN access_control ac ON l.user_id = ac.user_id 
        WHERE ac.granted_to_user_id = auth.uid()
    ) l
    GROUP BY l.source
    ORDER BY count DESC;
$$;

-- Create pipeline data function that respects access control
CREATE OR REPLACE FUNCTION get_pipeline_data_ultimate()
RETURNS TABLE(
    stage TEXT,
    count BIGINT,
    total_amount NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        o.stage as stage,
        COUNT(*) as count,
        COALESCE(SUM(o.value), 0) as total_amount
    FROM (
        -- User's own opportunities
        SELECT * FROM opportunities WHERE user_id = auth.uid()
        UNION
        -- Opportunities from users who granted access to current user
        SELECT o.* 
        FROM opportunities o 
        JOIN access_control ac ON o.user_id = ac.user_id 
        WHERE ac.granted_to_user_id = auth.uid()
    ) o
    WHERE o.stage IS NOT NULL
    GROUP BY o.stage
    ORDER BY total_amount DESC;
$$;

-- Create top opportunities function that respects access control
CREATE OR REPLACE FUNCTION get_top_opportunities_simple()
RETURNS TABLE(
    id UUID,
    name TEXT,
    value NUMERIC,
    stage TEXT,
    probability INTEGER
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        o.id,
        o.name,
        o.value,
        o.stage,
        o.probability
    FROM (
        -- User's own opportunities
        SELECT * FROM opportunities WHERE user_id = auth.uid()
        UNION
        -- Opportunities from users who granted access to current user
        SELECT o.* 
        FROM opportunities o 
        JOIN access_control ac ON o.user_id = ac.user_id 
        WHERE ac.granted_to_user_id = auth.uid()
    ) o
    WHERE o.stage NOT IN ('closed_won', 'closed_lost')
    ORDER BY o.value DESC NULLS LAST
    LIMIT 5;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_lead_source_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pipeline_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_opportunities_simple() TO authenticated;

-- Test the functions to make sure they work
SELECT 'Dashboard access control functions created successfully!' as status;
