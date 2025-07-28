-- Ultimate Database Fix Script for CRM System
-- This script addresses all permission issues and implements proper role-based access control

-- First, drop all existing problematic functions
DROP FUNCTION IF EXISTS get_dashboard_metrics_ultimate() CASCADE;
DROP FUNCTION IF EXISTS get_lead_source_data_ultimate() CASCADE;
DROP FUNCTION IF EXISTS get_pipeline_data_ultimate() CASCADE;
DROP FUNCTION IF EXISTS get_top_opportunities_ultimate(integer) CASCADE;
DROP FUNCTION IF EXISTS is_user_admin() CASCADE;
DROP FUNCTION IF EXISTS get_user_email() CASCADE;
DROP FUNCTION IF EXISTS assign_user_role(uuid, text) CASCADE;

-- Drop existing RLS policies to start fresh
DROP POLICY IF EXISTS "Admin can see all leads" ON leads;
DROP POLICY IF EXISTS "Users can see own and assigned leads" ON leads;
DROP POLICY IF EXISTS "Admin can modify all leads" ON leads;
DROP POLICY IF EXISTS "Users can modify own and assigned leads" ON leads;
DROP POLICY IF EXISTS "Admin can see all opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can see own and assigned opportunities" ON opportunities;
DROP POLICY IF EXISTS "Admin can modify all opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can modify own and assigned opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can read their own role" ON user_roles;
DROP POLICY IF EXISTS "Admin can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can read own customer data" ON customers;
DROP POLICY IF EXISTS "Admin can read all customer data" ON customers;
DROP POLICY IF EXISTS "Users can manage own customer data" ON customers;
DROP POLICY IF EXISTS "Admin can manage all customer data" ON customers;
DROP POLICY IF EXISTS "Users can read own activities" ON activities;
DROP POLICY IF EXISTS "Admin can read all activities" ON activities;
DROP POLICY IF EXISTS "Users can manage own activities" ON activities;
DROP POLICY IF EXISTS "Admin can manage all activities" ON activities;

-- Ensure user_roles table exists with correct structure
CREATE TABLE IF NOT EXISTS user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id),
    UNIQUE(email)
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create helper functions with SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_user_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(auth.jwt() ->> 'email', '');
$$;

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

-- Create function to assign roles (admin only)
CREATE OR REPLACE FUNCTION assign_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only admins can assign roles
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION 'Access denied: Only admins can assign roles';
    END IF;
    
    -- Validate role
    IF new_role NOT IN ('admin', 'user') THEN
        RAISE EXCEPTION 'Invalid role: %', new_role;
    END IF;
    
    -- Get user email
    DECLARE
        user_email text;
    BEGIN
        SELECT email INTO user_email FROM auth.users WHERE id = target_user_id;
        IF user_email IS NULL THEN
            RAISE EXCEPTION 'User not found: %', target_user_id;
        END IF;
        
        -- Insert or update role
        INSERT INTO user_roles (user_id, email, role)
        VALUES (target_user_id, user_email, new_role)
        ON CONFLICT (user_id)
        DO UPDATE SET 
            role = new_role,
            updated_at = now();
    END;
END;
$$;

-- Create the auto role assignment trigger function
CREATE OR REPLACE FUNCTION handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
    user_email text;
BEGIN
    -- Get email from the new user metadata (Supabase stores email in raw_user_meta_data)
    user_email := COALESCE(
        NEW.raw_user_meta_data ->> 'email',
        NEW.raw_app_meta_data ->> 'email',
        NEW.id::text || '@temp.local'  -- fallback if no email found
    );
    
    -- Get role from metadata, default to 'user'
    user_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'user');
    
    -- Validate role
    IF user_role NOT IN ('admin', 'user') THEN
        user_role := 'user';
    END IF;
    
    -- Insert the role
    INSERT INTO user_roles (user_id, email, role)
    VALUES (NEW.id, user_email, user_role)
    ON CONFLICT (user_id) DO UPDATE SET
        role = user_role,
        email = user_email,
        updated_at = now();
    
    RETURN NEW;
END;
$$;

-- Create trigger for auto role assignment
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_role();

-- Create dashboard metrics function
CREATE OR REPLACE FUNCTION get_dashboard_metrics_ultimate()
RETURNS TABLE (
    total_leads bigint,
    total_opportunities bigint,
    active_opportunities bigint,
    total_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF is_user_admin() THEN
        -- Admin sees all data
        RETURN QUERY
        SELECT 
            (SELECT COUNT(*) FROM leads)::bigint,
            (SELECT COUNT(*) FROM opportunities)::bigint,
            (SELECT COUNT(*) FROM opportunities WHERE stage NOT IN ('closed_won', 'closed_lost'))::bigint,
            (SELECT COALESCE(SUM(value), 0) FROM opportunities WHERE stage = 'closed_won')::numeric;
    ELSE
        -- Regular user sees only their own and assigned data
        RETURN QUERY
        SELECT 
            (SELECT COUNT(*) FROM leads 
             WHERE user_id = auth.uid() OR assigned_to = get_user_email())::bigint,
            (SELECT COUNT(*) FROM opportunities 
             WHERE user_id = auth.uid() OR assigned_to = get_user_email())::bigint,
            (SELECT COUNT(*) FROM opportunities 
             WHERE (user_id = auth.uid() OR assigned_to = get_user_email()) 
             AND stage NOT IN ('closed_won', 'closed_lost'))::bigint,
            (SELECT COALESCE(SUM(value), 0) FROM opportunities 
             WHERE (user_id = auth.uid() OR assigned_to = get_user_email()) 
             AND stage = 'closed_won')::numeric;
    END IF;
END;
$$;

-- Create lead source data function
CREATE OR REPLACE FUNCTION get_lead_source_data_ultimate()
RETURNS TABLE (
    source text,
    count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF is_user_admin() THEN
        -- Admin sees all data
        RETURN QUERY
        SELECT 
            l.source,
            COUNT(*)::bigint
        FROM leads l
        WHERE l.source IS NOT NULL
        GROUP BY l.source
        ORDER BY COUNT(*) DESC;
    ELSE
        -- Regular user sees only their own and assigned data
        RETURN QUERY
        SELECT 
            l.source,
            COUNT(*)::bigint
        FROM leads l
        WHERE l.source IS NOT NULL
        AND (l.user_id = auth.uid() OR l.assigned_to = get_user_email())
        GROUP BY l.source
        ORDER BY COUNT(*) DESC;
    END IF;
END;
$$;

-- Create pipeline data function
CREATE OR REPLACE FUNCTION get_pipeline_data_ultimate()
RETURNS TABLE (
    stage text,
    count bigint,
    value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF is_user_admin() THEN
        -- Admin sees all data
        RETURN QUERY
        SELECT 
            o.stage,
            COUNT(*)::bigint,
            COALESCE(SUM(o.value), 0)::numeric
        FROM opportunities o
        WHERE o.stage IS NOT NULL
        GROUP BY o.stage
        ORDER BY COUNT(*) DESC;
    ELSE
        -- Regular user sees only their own and assigned data
        RETURN QUERY
        SELECT 
            o.stage,
            COUNT(*)::bigint,
            COALESCE(SUM(o.value), 0)::numeric
        FROM opportunities o
        WHERE o.stage IS NOT NULL
        AND (o.user_id = auth.uid() OR o.assigned_to = get_user_email())
        GROUP BY o.stage
        ORDER BY COUNT(*) DESC;
    END IF;
END;
$$;

-- Create top opportunities function
CREATE OR REPLACE FUNCTION get_top_opportunities_ultimate(limit_count integer DEFAULT 3)
RETURNS TABLE (
    id uuid,
    name text,
    value numeric,
    stage text,
    probability integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF is_user_admin() THEN
        -- Admin sees all data
        RETURN QUERY
        SELECT 
            o.id,
            o.name,
            o.value,
            o.stage,
            o.probability
        FROM opportunities o
        WHERE o.stage NOT IN ('closed_won', 'closed_lost')
        ORDER BY o.value DESC NULLS LAST
        LIMIT limit_count;
    ELSE
        -- Regular user sees only their own and assigned data
        RETURN QUERY
        SELECT 
            o.id,
            o.name,
            o.value,
            o.stage,
            o.probability
        FROM opportunities o
        WHERE o.stage NOT IN ('closed_won', 'closed_lost')
        AND (o.user_id = auth.uid() OR o.assigned_to = get_user_email())
        ORDER BY o.value DESC NULLS LAST
        LIMIT limit_count;
    END IF;
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION assign_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_lead_source_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pipeline_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_opportunities_ultimate(integer) TO authenticated;

-- Create RLS policies for user_roles
CREATE POLICY "Users can read their own role" ON user_roles
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admin can read all roles" ON user_roles
    FOR SELECT
    USING (is_user_admin());

CREATE POLICY "Admin can manage all roles" ON user_roles
    FOR ALL
    USING (is_user_admin());

-- Create RLS policies for leads
CREATE POLICY "Admin can see all leads" ON leads
    FOR SELECT
    USING (is_user_admin());

CREATE POLICY "Users can see own and assigned leads" ON leads
    FOR SELECT
    USING (user_id = auth.uid() OR assigned_to = get_user_email());

CREATE POLICY "Admin can modify all leads" ON leads
    FOR ALL
    USING (is_user_admin());

CREATE POLICY "Users can modify own and assigned leads" ON leads
    FOR ALL
    USING (user_id = auth.uid() OR assigned_to = get_user_email());

-- Create RLS policies for opportunities
CREATE POLICY "Admin can see all opportunities" ON opportunities
    FOR SELECT
    USING (is_user_admin());

CREATE POLICY "Users can see own and assigned opportunities" ON opportunities
    FOR SELECT
    USING (user_id = auth.uid() OR assigned_to = get_user_email());

CREATE POLICY "Admin can modify all opportunities" ON opportunities
    FOR ALL
    USING (is_user_admin());

CREATE POLICY "Users can modify own and assigned opportunities" ON opportunities
    FOR ALL
    USING (user_id = auth.uid() OR assigned_to = get_user_email());

-- Create RLS policies for customers
CREATE POLICY "Admin can read all customer data" ON customers
    FOR SELECT
    USING (is_user_admin());

CREATE POLICY "Users can read own customer data" ON customers
    FOR SELECT
    USING (user_id = auth.uid() OR assigned_to = get_user_email());

CREATE POLICY "Admin can manage all customer data" ON customers
    FOR ALL
    USING (is_user_admin());

CREATE POLICY "Users can manage own customer data" ON customers
    FOR ALL
    USING (user_id = auth.uid() OR assigned_to = get_user_email());

-- Create RLS policies for activities
CREATE POLICY "Admin can read all activities" ON activities
    FOR SELECT
    USING (is_user_admin());

CREATE POLICY "Users can read own activities" ON activities
    FOR SELECT
    USING (user_id = auth.uid() OR assigned_to = get_user_email());

CREATE POLICY "Admin can manage all activities" ON activities
    FOR ALL
    USING (is_user_admin());

CREATE POLICY "Users can manage own activities" ON activities
    FOR ALL
    USING (user_id = auth.uid() OR assigned_to = get_user_email());

-- Ensure all tables have RLS enabled
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Grant basic permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON opportunities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON activities TO authenticated;
GRANT SELECT ON user_roles TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_assigned_to ON opportunities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(email);

-- Insert or update your admin role (replace 'your-email@domain.com' with your actual email)
-- This assumes you already have a user account in auth.users
-- You'll need to run this part manually with your actual email and user ID

/*
-- IMPORTANT: Replace these values with your actual user information
-- You can find your user ID by running: SELECT id, email FROM auth.users WHERE email = 'your-email@domain.com';

INSERT INTO user_roles (user_id, email, role)
VALUES (
    (SELECT id FROM auth.users WHERE email = 'your-email@domain.com' LIMIT 1),
    'your-email@domain.com',
    'admin'
)
ON CONFLICT (user_id) 
DO UPDATE SET 
    role = 'admin',
    updated_at = now();
*/

-- Create a function to help set up the first admin user
CREATE OR REPLACE FUNCTION setup_admin_user(admin_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_user_id uuid;
    result_message text;
BEGIN
    -- Find the user by email
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = admin_email 
    LIMIT 1;
    
    IF admin_user_id IS NULL THEN
        RETURN 'User not found with email: ' || admin_email;
    END IF;
    
    -- Insert or update the admin role
    INSERT INTO user_roles (user_id, email, role)
    VALUES (admin_user_id, admin_email, 'admin')
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        role = 'admin',
        updated_at = now();
    
    RETURN 'Successfully set admin role for user: ' || admin_email;
END;
$$;

GRANT EXECUTE ON FUNCTION setup_admin_user(text) TO authenticated;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Ultimate database fix script completed successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run: SELECT setup_admin_user(''your-email@domain.com''); with your actual email';
    RAISE NOTICE '2. Test the dashboard functions';
    RAISE NOTICE '3. Verify RLS policies are working correctly';
END $$;
