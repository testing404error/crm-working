-- Fix Auth Permissions - Modified Version
-- This script avoids modifying auth.users table directly

-- First, let's create helper functions that work around auth.users limitations
CREATE OR REPLACE FUNCTION get_user_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Create admin check function using user_roles table instead
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;

-- Drop existing dashboard functions if they exist
DROP FUNCTION IF EXISTS get_dashboard_metrics_ultimate();
DROP FUNCTION IF EXISTS get_lead_source_data_ultimate();
DROP FUNCTION IF EXISTS get_pipeline_data_ultimate();
DROP FUNCTION IF EXISTS get_top_opportunities_ultimate();

-- Create comprehensive dashboard metrics function
CREATE OR REPLACE FUNCTION get_dashboard_metrics_ultimate()
RETURNS TABLE(
  total_leads bigint,
  total_opportunities bigint,
  total_revenue numeric,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_is_admin boolean;
BEGIN
  -- Check if user is admin
  user_is_admin := is_user_admin();
  
  IF user_is_admin THEN
    -- Admin sees all data
    RETURN QUERY
    SELECT 
      (SELECT COUNT(*) FROM leads)::bigint as total_leads,
      (SELECT COUNT(*) FROM opportunities)::bigint as total_opportunities,
      (SELECT COALESCE(SUM(value), 0) FROM opportunities WHERE stage = 'closed_won')::numeric as total_revenue,
      (CASE 
        WHEN (SELECT COUNT(*) FROM leads) > 0 
        THEN (SELECT COUNT(*) FROM opportunities WHERE stage = 'closed_won')::numeric / (SELECT COUNT(*) FROM leads)::numeric * 100 
        ELSE 0 
      END)::numeric as conversion_rate;
  ELSE
    -- Regular user sees only their data
    RETURN QUERY
    SELECT 
      (SELECT COUNT(*) FROM leads WHERE assigned_to = auth.uid() OR created_by = auth.uid())::bigint as total_leads,
      (SELECT COUNT(*) FROM opportunities WHERE assigned_to = auth.uid() OR created_by = auth.uid())::bigint as total_opportunities,
      (SELECT COALESCE(SUM(value), 0) FROM opportunities WHERE (assigned_to = auth.uid() OR created_by = auth.uid()) AND stage = 'closed_won')::numeric as total_revenue,
      (CASE 
        WHEN (SELECT COUNT(*) FROM leads WHERE assigned_to = auth.uid() OR created_by = auth.uid()) > 0 
        THEN (SELECT COUNT(*) FROM opportunities WHERE (assigned_to = auth.uid() OR created_by = auth.uid()) AND stage = 'closed_won')::numeric / (SELECT COUNT(*) FROM leads WHERE assigned_to = auth.uid() OR created_by = auth.uid())::numeric * 100 
        ELSE 0 
      END)::numeric as conversion_rate;
  END IF;
END;
$$;

-- Create lead source data function
CREATE OR REPLACE FUNCTION get_lead_source_data_ultimate()
RETURNS TABLE(
  source text,
  count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_is_admin boolean;
BEGIN
  user_is_admin := is_user_admin();
  
  IF user_is_admin THEN
    RETURN QUERY
    SELECT l.source, COUNT(*)::bigint as count
    FROM leads l
    GROUP BY l.source
    ORDER BY count DESC;
  ELSE
    RETURN QUERY
    SELECT l.source, COUNT(*)::bigint as count
    FROM leads l
    WHERE l.assigned_to = auth.uid() OR l.created_by = auth.uid()
    GROUP BY l.source
    ORDER BY count DESC;
  END IF;
END;
$$;

-- Create pipeline data function
CREATE OR REPLACE FUNCTION get_pipeline_data_ultimate()
RETURNS TABLE(
  stage text,
  count bigint,
  total_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_is_admin boolean;
BEGIN
  user_is_admin := is_user_admin();
  
  IF user_is_admin THEN
    RETURN QUERY
    SELECT o.stage, COUNT(*)::bigint as count, COALESCE(SUM(o.value), 0)::numeric as total_value
    FROM opportunities o
    GROUP BY o.stage
    ORDER BY total_value DESC;
  ELSE
    RETURN QUERY
    SELECT o.stage, COUNT(*)::bigint as count, COALESCE(SUM(o.value), 0)::numeric as total_value
    FROM opportunities o
    WHERE o.assigned_to = auth.uid() OR o.created_by = auth.uid()
    GROUP BY o.stage
    ORDER BY total_value DESC;
  END IF;
END;
$$;

-- Create top opportunities function
CREATE OR REPLACE FUNCTION get_top_opportunities_ultimate()
RETURNS TABLE(
  id uuid,
  title text,
  value numeric,
  stage text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_is_admin boolean;
BEGIN
  user_is_admin := is_user_admin();
  
  IF user_is_admin THEN
    RETURN QUERY
    SELECT o.id, o.title, o.value, o.stage, o.created_at
    FROM opportunities o
    ORDER BY o.value DESC
    LIMIT 10;
  ELSE
    RETURN QUERY
    SELECT o.id, o.title, o.value, o.stage, o.created_at
    FROM opportunities o
    WHERE o.assigned_to = auth.uid() OR o.created_by = auth.uid()
    ORDER BY o.value DESC
    LIMIT 10;
  END IF;
END;
$$;

-- Grant execute permissions on all dashboard functions
GRANT EXECUTE ON FUNCTION get_dashboard_metrics_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_lead_source_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pipeline_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_opportunities_ultimate() TO authenticated;

-- Update RLS policies for leads table
DROP POLICY IF EXISTS "leads_select_policy" ON leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
DROP POLICY IF EXISTS "leads_update_policy" ON leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON leads;

-- Enable RLS on leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies for leads
CREATE POLICY "leads_select_policy" ON leads
  FOR SELECT TO authenticated
  USING (
    is_user_admin() OR 
    assigned_to = auth.uid() OR 
    created_by = auth.uid()
  );

CREATE POLICY "leads_insert_policy" ON leads
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

CREATE POLICY "leads_update_policy" ON leads
  FOR UPDATE TO authenticated
  USING (
    is_user_admin() OR 
    assigned_to = auth.uid() OR 
    created_by = auth.uid()
  )
  WITH CHECK (
    is_user_admin() OR 
    assigned_to = auth.uid() OR 
    created_by = auth.uid()
  );

CREATE POLICY "leads_delete_policy" ON leads
  FOR DELETE TO authenticated
  USING (
    is_user_admin() OR 
    created_by = auth.uid()
  );

-- Update RLS policies for opportunities table
DROP POLICY IF EXISTS "opportunities_select_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_insert_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_update_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_delete_policy" ON opportunities;

-- Enable RLS on opportunities
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies for opportunities
CREATE POLICY "opportunities_select_policy" ON opportunities
  FOR SELECT TO authenticated
  USING (
    is_user_admin() OR 
    assigned_to = auth.uid() OR 
    created_by = auth.uid()
  );

CREATE POLICY "opportunities_insert_policy" ON opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

CREATE POLICY "opportunities_update_policy" ON opportunities
  FOR UPDATE TO authenticated
  USING (
    is_user_admin() OR 
    assigned_to = auth.uid() OR 
    created_by = auth.uid()
  )
  WITH CHECK (
    is_user_admin() OR 
    assigned_to = auth.uid() OR 
    created_by = auth.uid()
  );

CREATE POLICY "opportunities_delete_policy" ON opportunities
  FOR DELETE TO authenticated
  USING (
    is_user_admin() OR 
    created_by = auth.uid()
  );

-- Update RLS policies for user_roles table
DROP POLICY IF EXISTS "user_roles_select_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete_policy" ON user_roles;

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_roles
CREATE POLICY "user_roles_select_policy" ON user_roles
  FOR SELECT TO authenticated
  USING (
    is_user_admin() OR 
    user_id = auth.uid()
  );

CREATE POLICY "user_roles_insert_policy" ON user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    is_user_admin()
  );

CREATE POLICY "user_roles_update_policy" ON user_roles
  FOR UPDATE TO authenticated
  USING (
    is_user_admin()
  )
  WITH CHECK (
    is_user_admin()
  );

CREATE POLICY "user_roles_delete_policy" ON user_roles
  FOR DELETE TO authenticated
  USING (
    is_user_admin()
  );

-- Create a safe function to get user profile information
CREATE OR REPLACE FUNCTION get_user_profile(user_uuid uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  email text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id uuid;
  user_is_admin boolean;
BEGIN
  -- Use provided user_uuid or default to current user
  target_user_id := COALESCE(user_uuid, auth.uid());
  user_is_admin := is_user_admin();
  
  -- Only allow access if user is admin or requesting their own profile
  IF user_is_admin OR target_user_id = auth.uid() THEN
    RETURN QUERY
    SELECT 
      u.id,
      u.email::text,
      COALESCE(ur.role, 'user')::text as role
    FROM auth.users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    WHERE u.id = target_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_profile(uuid) TO authenticated;

-- Create function to list all users (admin only)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE(
  id uuid,
  email text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow if user is admin
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    COALESCE(ur.role, 'user')::text as role,
    u.created_at
  FROM auth.users u
  LEFT JOIN user_roles ur ON u.id = ur.user_id
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;

-- Ensure all necessary permissions are granted
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT ON leads TO authenticated;
GRANT SELECT ON opportunities TO authenticated;

-- Grant specific permissions for the authenticated role
GRANT INSERT, UPDATE, DELETE ON leads TO authenticated;
GRANT INSERT, UPDATE, DELETE ON opportunities TO authenticated;
GRANT INSERT, UPDATE, DELETE ON user_roles TO authenticated;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;
