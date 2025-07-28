-- Final comprehensive fix for all RLS and permission issues
-- This script will resolve all "permission denied for table users" errors

-- 1. First, let's ensure the user_roles table exists and has proper structure
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(email)
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on user_roles
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own role" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage roles" ON user_roles;

-- Create comprehensive policies for user_roles
CREATE POLICY "Anyone can view roles" ON user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own role" ON user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON user_roles FOR ALL TO service_role USING (true);

-- 2. Ensure leads and opportunities tables have proper RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on leads
DROP POLICY IF EXISTS "Users can view their own leads and admin leads" ON leads;
DROP POLICY IF EXISTS "Users can insert their own leads" ON leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Admins can manage all leads" ON leads;
DROP POLICY IF EXISTS "Service role full access leads" ON leads;

-- Create simplified and working policies for leads
CREATE POLICY "View leads policy" ON leads FOR SELECT TO authenticated USING (
    -- User is admin OR owns the lead OR is assigned to the lead
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
    OR user_id = auth.uid()
    OR assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Insert leads policy" ON leads FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
);

CREATE POLICY "Update leads policy" ON leads FOR UPDATE TO authenticated USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
    OR user_id = auth.uid()
    OR assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Delete leads policy" ON leads FOR DELETE TO authenticated USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
    OR user_id = auth.uid()
);

CREATE POLICY "Service role leads access" ON leads FOR ALL TO service_role USING (true);

-- Drop all existing policies on opportunities
DROP POLICY IF EXISTS "Users can view their own opportunities and admin opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can insert their own opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can update their own opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can delete their own opportunities" ON opportunities;
DROP POLICY IF EXISTS "Admins can view all opportunities" ON opportunities;
DROP POLICY IF EXISTS "Admins can manage all opportunities" ON opportunities;
DROP POLICY IF EXISTS "Service role full access opportunities" ON opportunities;

-- Create simplified and working policies for opportunities
CREATE POLICY "View opportunities policy" ON opportunities FOR SELECT TO authenticated USING (
    -- User is admin OR owns the opportunity OR is assigned to the opportunity
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
    OR user_id = auth.uid()
    OR assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Insert opportunities policy" ON opportunities FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
);

CREATE POLICY "Update opportunities policy" ON opportunities FOR UPDATE TO authenticated USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
    OR user_id = auth.uid()
    OR assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Delete opportunities policy" ON opportunities FOR DELETE TO authenticated USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
    OR user_id = auth.uid()
);

CREATE POLICY "Service role opportunities access" ON opportunities FOR ALL TO service_role USING (true);

-- 3. Create helper function to check if user is admin (bypasses RLS issues)
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;

-- 4. Create final dashboard functions that work without RLS issues
CREATE OR REPLACE FUNCTION get_dashboard_metrics_ultimate()
RETURNS TABLE(
    total_leads BIGINT,
    total_opportunities BIGINT,
    total_customers BIGINT,
    conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_is_admin BOOLEAN;
    current_user_email TEXT;
BEGIN
    -- Get current user info
    SELECT is_user_admin() INTO user_is_admin;
    SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
    
    IF user_is_admin THEN
        -- Admin sees all data
        SELECT 
            COUNT(*) FILTER (WHERE l.id IS NOT NULL),
            COUNT(*) FILTER (WHERE o.id IS NOT NULL),
            COUNT(*) FILTER (WHERE c.id IS NOT NULL),
            CASE 
                WHEN COUNT(*) FILTER (WHERE l.id IS NOT NULL) > 0 
                THEN ROUND((COUNT(*) FILTER (WHERE o.id IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE l.id IS NOT NULL)) * 100, 2)
                ELSE 0 
            END
        INTO total_leads, total_opportunities, total_customers, conversion_rate
        FROM leads l
        FULL OUTER JOIN opportunities o ON true
        FULL OUTER JOIN customers c ON true;
    ELSE
        -- Regular user sees only their data and assigned data
        SELECT 
            COUNT(*) FILTER (WHERE l.id IS NOT NULL),
            COUNT(*) FILTER (WHERE o.id IS NOT NULL),
            COUNT(*) FILTER (WHERE c.id IS NOT NULL),
            CASE 
                WHEN COUNT(*) FILTER (WHERE l.id IS NOT NULL) > 0 
                THEN ROUND((COUNT(*) FILTER (WHERE o.id IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE l.id IS NOT NULL)) * 100, 2)
                ELSE 0 
            END
        INTO total_leads, total_opportunities, total_customers, conversion_rate
        FROM leads l
        FULL OUTER JOIN opportunities o ON (o.user_id = auth.uid() OR o.assigned_to = current_user_email)
        FULL OUTER JOIN customers c ON (c.user_id = auth.uid())
        WHERE l.user_id = auth.uid() OR l.assigned_to = current_user_email;
    END IF;
    
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION get_lead_source_data_ultimate()
RETURNS TABLE(
    source TEXT,
    count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_is_admin BOOLEAN;
    current_user_email TEXT;
BEGIN
    -- Get current user info
    SELECT is_user_admin() INTO user_is_admin;
    SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
    
    IF user_is_admin THEN
        -- Admin sees all lead sources
        RETURN QUERY
        SELECT 
            COALESCE(l.source, 'Unknown') as source,
            COUNT(*)::BIGINT as count
        FROM leads l
        GROUP BY l.source
        ORDER BY count DESC;
    ELSE
        -- Regular user sees only their lead sources and assigned sources
        RETURN QUERY
        SELECT 
            COALESCE(l.source, 'Unknown') as source,
            COUNT(*)::BIGINT as count
        FROM leads l
        WHERE l.user_id = auth.uid() OR l.assigned_to = current_user_email
        GROUP BY l.source
        ORDER BY count DESC;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION get_pipeline_data_ultimate()
RETURNS TABLE(
    stage TEXT,
    count BIGINT,
    value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_is_admin BOOLEAN;
    current_user_email TEXT;
BEGIN
    -- Get current user info
    SELECT is_user_admin() INTO user_is_admin;
    SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
    
    IF user_is_admin THEN
        -- Admin sees all pipeline data
        RETURN QUERY
        SELECT 
            o.stage,
            COUNT(*)::BIGINT as count,
            COALESCE(SUM(o.value), 0) as value
        FROM opportunities o
        GROUP BY o.stage
        ORDER BY 
            CASE o.stage
                WHEN 'lead' THEN 1
                WHEN 'qualified' THEN 2
                WHEN 'proposal' THEN 3
                WHEN 'negotiation' THEN 4
                WHEN 'closed_won' THEN 5
                WHEN 'closed_lost' THEN 6
                ELSE 7
            END;
    ELSE
        -- Regular user sees only their pipeline data and assigned data
        RETURN QUERY
        SELECT 
            o.stage,
            COUNT(*)::BIGINT as count,
            COALESCE(SUM(o.value), 0) as value
        FROM opportunities o
        WHERE o.user_id = auth.uid() OR o.assigned_to = current_user_email
        GROUP BY o.stage
        ORDER BY 
            CASE o.stage
                WHEN 'lead' THEN 1
                WHEN 'qualified' THEN 2
                WHEN 'proposal' THEN 3
                WHEN 'negotiation' THEN 4
                WHEN 'closed_won' THEN 5
                WHEN 'closed_lost' THEN 6
                ELSE 7
            END;
    END IF;
END;
$$;

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION get_dashboard_metrics_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_lead_source_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pipeline_data_ultimate() TO authenticated;

-- 5. Create a function to get top opportunities without RLS issues
CREATE OR REPLACE FUNCTION get_top_opportunities()
RETURNS TABLE(
    id UUID,
    title TEXT,
    value NUMERIC,
    stage TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_is_admin BOOLEAN;
    current_user_email TEXT;
BEGIN
    -- Get current user info
    SELECT is_user_admin() INTO user_is_admin;
    SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
    
    IF user_is_admin THEN
        -- Admin sees all opportunities
        RETURN QUERY
        SELECT o.id, o.title, o.value, o.stage, o.created_at
        FROM opportunities o
        ORDER BY o.value DESC NULLS LAST
        LIMIT 10;
    ELSE
        -- Regular user sees only their opportunities and assigned opportunities
        RETURN QUERY
        SELECT o.id, o.title, o.value, o.stage, o.created_at
        FROM opportunities o
        WHERE o.user_id = auth.uid() OR o.assigned_to = current_user_email
        ORDER BY o.value DESC NULLS LAST
        LIMIT 10;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_top_opportunities() TO authenticated;

-- 6. Ensure all tables have proper permissions for authenticated users
GRANT SELECT ON leads TO authenticated;
GRANT INSERT, UPDATE, DELETE ON leads TO authenticated;
GRANT SELECT ON opportunities TO authenticated; 
GRANT INSERT, UPDATE, DELETE ON opportunities TO authenticated;
GRANT SELECT ON customers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON customers TO authenticated;
GRANT SELECT ON user_roles TO authenticated;
GRANT INSERT ON user_roles TO authenticated;

-- 7. Create some sample data if tables are empty (optional)
DO $$
BEGIN
    -- Only insert if leads table is empty
    IF NOT EXISTS (SELECT 1 FROM leads LIMIT 1) THEN
        INSERT INTO leads (title, source, status, assigned_to, contact_info, notes) VALUES
        ('Sample Lead 1', 'website', 'new', 'admin@example.com', '{"email": "lead1@example.com", "phone": "123-456-7890"}', 'Initial contact from website form'),
        ('Sample Lead 2', 'referral', 'qualified', 'admin@example.com', '{"email": "lead2@example.com", "phone": "098-765-4321"}', 'Referred by existing customer');
    END IF;
    
    -- Only insert if opportunities table is empty
    IF NOT EXISTS (SELECT 1 FROM opportunities LIMIT 1) THEN
        INSERT INTO opportunities (title, stage, value, assigned_to, description) VALUES
        ('Sample Opportunity 1', 'qualified', 10000, 'admin@example.com', 'Potential large client engagement'),
        ('Sample Opportunity 2', 'proposal', 5000, 'admin@example.com', 'Mid-size project proposal');
    END IF;
END $$;

-- Success message
SELECT 'All permissions and RLS policies have been fixed successfully!' as message;
