-- =============================================
-- CORRECTED ULTIMATE DATABASE FIX SCRIPT
-- Fixes: No direct email column access in auth.users
--        No identifier column references in user_roles
-- =============================================

-- Drop existing objects to recreate them correctly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_role();
DROP FUNCTION IF EXISTS setup_admin_user(text);
DROP FUNCTION IF EXISTS get_user_email();
DROP FUNCTION IF EXISTS is_user_admin();
DROP FUNCTION IF EXISTS get_dashboard_metrics_ultimate();
DROP FUNCTION IF EXISTS get_lead_source_data_ultimate();
DROP FUNCTION IF EXISTS get_pipeline_data_ultimate();
DROP FUNCTION IF EXISTS get_top_opportunities_ultimate(integer);

-- Drop existing policies
DROP POLICY IF EXISTS "admin_all_access_leads" ON leads;
DROP POLICY IF EXISTS "user_own_assigned_leads" ON leads;
DROP POLICY IF EXISTS "admin_all_access_opportunities" ON opportunities;
DROP POLICY IF EXISTS "user_own_assigned_opportunities" ON opportunities;
DROP POLICY IF EXISTS "admin_all_access_activities" ON activities;
DROP POLICY IF EXISTS "user_own_assigned_activities" ON activities;
DROP POLICY IF EXISTS "admin_all_access_user_roles" ON user_roles;
DROP POLICY IF EXISTS "user_own_role_access" ON user_roles;

-- Ensure user_roles table exists with correct schema
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'sales', 'marketing')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS (CORRECTED)
-- =============================================

-- Get user email from JWT claims (no direct auth.users email column access)
CREATE OR REPLACE FUNCTION get_user_email()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Extract email from JWT claims
    SELECT COALESCE(
        auth.jwt() ->> 'email',
        ''
    ) INTO user_email;
    
    RETURN user_email;
END;
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM user_roles
    WHERE user_id = auth.uid();
    
    RETURN COALESCE(user_role = 'admin', FALSE);
END;
$$;

-- =============================================
-- DASHBOARD FUNCTIONS (CORRECTED)
-- =============================================

-- Get dashboard metrics with role-based access
CREATE OR REPLACE FUNCTION get_dashboard_metrics_ultimate()
RETURNS TABLE(
    total_leads BIGINT,
    total_opportunities BIGINT,
    total_revenue NUMERIC,
    conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    is_admin BOOLEAN;
BEGIN
    current_user_id := auth.uid();
    is_admin := is_user_admin();
    
    IF is_admin THEN
        -- Admin sees all data
        SELECT 
            COUNT(*)::BIGINT,
            (SELECT COUNT(*)::BIGINT FROM opportunities),
            COALESCE(SUM(o.value), 0),
            CASE 
                WHEN COUNT(*) > 0 THEN 
                    ROUND((SELECT COUNT(*)::NUMERIC FROM opportunities WHERE stage = 'closed_won') / COUNT(*)::NUMERIC * 100, 2)
                ELSE 0
            END
        INTO total_leads, total_opportunities, total_revenue, conversion_rate
        FROM leads l
        LEFT JOIN opportunities o ON l.id = o.lead_id;
    ELSE
        -- Regular user sees only their data and admin's data assigned to them
        SELECT 
            COUNT(*)::BIGINT,
            (SELECT COUNT(*)::BIGINT FROM opportunities o 
             WHERE o.assigned_to::text = current_user_id::text 
             OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = o.assigned_to AND ur.role = 'admin')),
            COALESCE(SUM(o.value), 0),
            CASE 
                WHEN COUNT(*) > 0 THEN 
                    ROUND((SELECT COUNT(*)::NUMERIC FROM opportunities o2 
                           WHERE o2.stage = 'closed_won' 
                           AND (o2.assigned_to::text = current_user_id::text 
                                OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = o2.assigned_to AND ur.role = 'admin'))) / COUNT(*)::NUMERIC * 100, 2)
                ELSE 0
            END
        INTO total_leads, total_opportunities, total_revenue, conversion_rate
        FROM leads l
        LEFT JOIN opportunities o ON l.id = o.lead_id
        WHERE l.assigned_to::text = current_user_id::text 
        OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = l.assigned_to AND ur.role = 'admin');
    END IF;
    
    RETURN NEXT;
END;
$$;

-- Get lead source data with role-based access
CREATE OR REPLACE FUNCTION get_lead_source_data_ultimate()
RETURNS TABLE(
    source TEXT,
    count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    is_admin BOOLEAN;
BEGIN
    current_user_id := auth.uid();
    is_admin := is_user_admin();
    
    IF is_admin THEN
        -- Admin sees all lead sources
        RETURN QUERY
        SELECT l.source, COUNT(*)::BIGINT
        FROM leads l
        GROUP BY l.source
        ORDER BY COUNT(*) DESC;
    ELSE
        -- Regular user sees only their lead sources and admin's assigned to them
        RETURN QUERY
        SELECT l.source, COUNT(*)::BIGINT
        FROM leads l
        WHERE l.assigned_to::text = current_user_id::text 
        OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = l.assigned_to AND ur.role = 'admin')
        GROUP BY l.source
        ORDER BY COUNT(*) DESC;
    END IF;
END;
$$;

-- Get pipeline data with role-based access
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
    current_user_id UUID;
    is_admin BOOLEAN;
BEGIN
    current_user_id := auth.uid();
    is_admin := is_user_admin();
    
    IF is_admin THEN
        -- Admin sees all pipeline data
        RETURN QUERY
        SELECT o.stage, COUNT(*)::BIGINT, COALESCE(SUM(o.value), 0)
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
        -- Regular user sees only their pipeline data and admin's assigned to them
        RETURN QUERY
        SELECT o.stage, COUNT(*)::BIGINT, COALESCE(SUM(o.value), 0)
        FROM opportunities o
        WHERE o.assigned_to::text = current_user_id::text 
        OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = o.assigned_to AND ur.role = 'admin')
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

-- Get top opportunities with role-based access
CREATE OR REPLACE FUNCTION get_top_opportunities_ultimate(limit_count INTEGER DEFAULT 5)
RETURNS TABLE(
    id UUID,
    title TEXT,
    value NUMERIC,
    stage TEXT,
    company TEXT,
    assigned_to UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    is_admin BOOLEAN;
BEGIN
    current_user_id := auth.uid();
    is_admin := is_user_admin();
    
    IF is_admin THEN
        -- Admin sees all top opportunities
        RETURN QUERY
        SELECT o.id, o.title, o.value, o.stage, o.company, o.assigned_to
        FROM opportunities o
        ORDER BY o.value DESC NULLS LAST
        LIMIT limit_count;
    ELSE
        -- Regular user sees only their top opportunities and admin's assigned to them
        RETURN QUERY
        SELECT o.id, o.title, o.value, o.stage, o.company, o.assigned_to
        FROM opportunities o
        WHERE o.assigned_to::text = current_user_id::text 
        OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = o.assigned_to AND ur.role = 'admin')
        ORDER BY o.value DESC NULLS LAST
        LIMIT limit_count;
    END IF;
END;
$$;

-- =============================================
-- USER ROLE MANAGEMENT (CORRECTED)
-- =============================================

-- Handle new user role assignment (CORRECTED - no direct email column access)
CREATE OR REPLACE FUNCTION handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
    user_role TEXT;
BEGIN
    -- Extract email from user metadata (no direct email column in auth.users)
    user_email := COALESCE(
        NEW.raw_user_meta_data ->> 'email',
        NEW.raw_app_meta_data ->> 'email',
        NEW.id::text || '@temp.local'
    );
    
    -- Extract role from user metadata, default to 'sales'
    user_role := COALESCE(
        NEW.raw_user_meta_data ->> 'role',
        NEW.raw_app_meta_data ->> 'role',
        'sales'
    );
    
    -- Validate role
    IF user_role NOT IN ('admin', 'manager', 'sales', 'marketing') THEN
        user_role := 'sales';
    END IF;
    
    -- Insert into user_roles table (using email column, not identifier)
    INSERT INTO user_roles (user_id, email, role)
    VALUES (NEW.id, user_email, user_role)
    ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;

-- Setup admin user function (CORRECTED - no direct email column access)
CREATE OR REPLACE FUNCTION setup_admin_user(admin_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Find user by email in user_roles table (not auth.users)
    SELECT user_id INTO admin_user_id
    FROM user_roles
    WHERE email = admin_email;
    
    IF admin_user_id IS NOT NULL THEN
        -- Update existing user to admin role
        UPDATE user_roles
        SET role = 'admin', updated_at = NOW()
        WHERE user_id = admin_user_id;
        
        RAISE NOTICE 'User % has been promoted to admin', admin_email;
    ELSE
        RAISE NOTICE 'User with email % not found in user_roles table', admin_email;
    END IF;
END;
$$;

-- =============================================
-- ROW LEVEL SECURITY POLICIES (CORRECTED)
-- =============================================

-- Leads policies
CREATE POLICY "admin_all_access_leads" ON leads
    FOR ALL USING (is_user_admin());

CREATE POLICY "user_own_assigned_leads" ON leads
    FOR ALL USING (
        assigned_to::text = auth.uid()::text 
        OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = assigned_to AND ur.role = 'admin')
    );

-- Opportunities policies  
CREATE POLICY "admin_all_access_opportunities" ON opportunities
    FOR ALL USING (is_user_admin());

CREATE POLICY "user_own_assigned_opportunities" ON opportunities
    FOR ALL USING (
        assigned_to::text = auth.uid()::text 
        OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = assigned_to AND ur.role = 'admin')
    );

-- Activities policies
CREATE POLICY "admin_all_access_activities" ON activities
    FOR ALL USING (is_user_admin());

CREATE POLICY "user_own_assigned_activities" ON activities
    FOR ALL USING (
        assigned_to::text = auth.uid()::text 
        OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = assigned_to AND ur.role = 'admin')
    );

-- User roles policies
CREATE POLICY "admin_all_access_user_roles" ON user_roles
    FOR ALL USING (is_user_admin());

CREATE POLICY "user_own_role_access" ON user_roles
    FOR SELECT USING (user_id = auth.uid());

-- =============================================
-- TRIGGERS
-- =============================================

-- Create trigger for new user role assignment
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_role();

-- =============================================
-- GRANTS AND PERMISSIONS
-- =============================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_lead_source_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pipeline_data_ultimate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_opportunities_ultimate(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_role() TO postgres;
GRANT EXECUTE ON FUNCTION setup_admin_user(text) TO postgres;

-- Grant table permissions
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON leads TO authenticated;
GRANT ALL ON opportunities TO authenticated;
GRANT ALL ON activities TO authenticated;

-- =============================================
-- FINAL SETUP MESSAGE
-- =============================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'CORRECTED DATABASE SETUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Key fixes applied:';
    RAISE NOTICE '1. No direct email column access in auth.users';
    RAISE NOTICE '2. Email extracted from JWT/metadata properly';
    RAISE NOTICE '3. No identifier column references in user_roles';
    RAISE NOTICE '4. Role-based access control functions created';
    RAISE NOTICE '5. RLS policies updated with type-safe comparisons';
    RAISE NOTICE '6. Triggers and permissions properly configured';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test user registration with role selection';
    RAISE NOTICE '2. Verify dashboard functions work correctly';
    REPLACE NOTICE '3. Use setup_admin_user(''email@domain.com'') to promote admins';
    RAISE NOTICE '==============================================';
END $$;
