-- Ultimate Dashboard Functions with Role-Based Access Control
-- These functions properly handle admin vs regular user permissions

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;

-- Ultimate Dashboard Metrics Function
CREATE OR REPLACE FUNCTION get_dashboard_metrics_ultimate()
RETURNS TABLE (
  total_leads BIGINT,
  total_opportunities BIGINT,
  active_opportunities BIGINT,
  total_revenue NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(leads_count.count, 0) as total_leads,
    COALESCE(opps_count.count, 0) as total_opportunities,
    COALESCE(active_opps_count.count, 0) as active_opportunities,
    COALESCE(revenue.total, 0) as total_revenue
  FROM (
    -- Count leads based on user role
    SELECT COUNT(*) as count
    FROM leads l
    WHERE 
      CASE 
        WHEN is_user_admin() THEN TRUE
        ELSE (l.assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid()) OR l.user_id = auth.uid())
      END
  ) as leads_count
  CROSS JOIN (
    -- Count opportunities based on user role
    SELECT COUNT(*) as count
    FROM opportunities o
    WHERE 
      CASE 
        WHEN is_user_admin() THEN TRUE
        ELSE (o.assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid()) OR o.user_id = auth.uid())
      END
  ) as opps_count
  CROSS JOIN (
    -- Count active opportunities based on user role
    SELECT COUNT(*) as count
    FROM opportunities o
    WHERE 
      o.stage NOT IN ('closed_won', 'closed_lost')
      AND CASE 
        WHEN is_user_admin() THEN TRUE
        ELSE (o.assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid()) OR o.user_id = auth.uid())
      END
  ) as active_opps_count
  CROSS JOIN (
    -- Calculate total revenue from closed won opportunities
    SELECT COALESCE(SUM(o.value), 0) as total
    FROM opportunities o
    WHERE 
      o.stage = 'closed_won'
      AND CASE 
        WHEN is_user_admin() THEN TRUE
        ELSE (o.assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid()) OR o.user_id = auth.uid())
      END
  ) as revenue;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_metrics_ultimate() TO authenticated;

-- Ultimate Lead Source Data Function
CREATE OR REPLACE FUNCTION get_lead_source_data_ultimate()
RETURNS TABLE (
  source TEXT,
  count BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    l.source,
    COUNT(*) as count
  FROM leads l
  WHERE 
    l.source IS NOT NULL
    AND CASE 
      WHEN is_user_admin() THEN TRUE
      ELSE (l.assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid()) OR l.user_id = auth.uid())
    END
  GROUP BY l.source
  ORDER BY count DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_lead_source_data_ultimate() TO authenticated;

-- Ultimate Pipeline Data Function
CREATE OR REPLACE FUNCTION get_pipeline_data_ultimate()
RETURNS TABLE (
  stage TEXT,
  count BIGINT,
  value NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    o.stage::TEXT,
    COUNT(*) as count,
    COALESCE(SUM(o.value), 0) as value
  FROM opportunities o
  WHERE 
    o.stage IS NOT NULL
    AND CASE 
      WHEN is_user_admin() THEN TRUE
      ELSE (o.assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid()) OR o.user_id = auth.uid())
    END
  GROUP BY o.stage
  ORDER BY value DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_pipeline_data_ultimate() TO authenticated;

-- Ultimate Top Opportunities Function
CREATE OR REPLACE FUNCTION get_top_opportunities_ultimate(limit_count INTEGER DEFAULT 3)
RETURNS TABLE (
  id UUID,
  name TEXT,
  value NUMERIC,
  probability INTEGER,
  stage TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    o.id,
    o.name,
    o.value,
    o.probability,
    o.stage::TEXT
  FROM opportunities o
  WHERE 
    o.stage NOT IN ('closed_won', 'closed_lost')
    AND CASE 
      WHEN is_user_admin() THEN TRUE
      ELSE (o.assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid()) OR o.user_id = auth.uid())
    END
  ORDER BY o.value DESC NULLS LAST
  LIMIT limit_count;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_top_opportunities_ultimate() TO authenticated;

-- Test the functions (uncomment to run tests)
/*
-- Test dashboard metrics
SELECT * FROM get_dashboard_metrics_ultimate();

-- Test lead source data
SELECT * FROM get_lead_source_data_ultimate();

-- Test pipeline data
SELECT * FROM get_pipeline_data_ultimate();

-- Test top opportunities
SELECT * FROM get_top_opportunities_ultimate(5);

-- Test admin check
SELECT is_user_admin() as is_admin;
*/
