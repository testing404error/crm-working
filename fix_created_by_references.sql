-- ================================================
-- Fix created_by References - Replace with user_id
-- ================================================
-- This script fixes SQL functions and policies that incorrectly reference 'created_by' 
-- column and replaces them with the correct 'user_id' column

-- ================================================
-- DROP EXISTING FUNCTIONS THAT HAVE created_by ERRORS
-- ================================================
DROP FUNCTION IF EXISTS get_admin_dashboard_metrics();
DROP FUNCTION IF EXISTS get_admin_lead_sources();
DROP FUNCTION IF EXISTS get_admin_pipeline_data();
DROP FUNCTION IF EXISTS get_user_dashboard_metrics(UUID);
DROP FUNCTION IF EXISTS get_user_lead_sources(UUID);
DROP FUNCTION IF EXISTS get_user_pipeline_data(UUID);

-- ================================================
-- CREATE CORRECTED ADMIN DASHBOARD FUNCTIONS
-- ================================================

-- Admin Dashboard Metrics (uses user_id instead of created_by)
CREATE OR REPLACE FUNCTION get_admin_dashboard_metrics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_leads', (SELECT COUNT(*) FROM leads),
        'total_opportunities', (SELECT COUNT(*) FROM opportunities),
        'total_customers', (SELECT COUNT(*) FROM customers),
        'conversion_rate', (
            CASE 
                WHEN (SELECT COUNT(*) FROM leads) > 0 
                THEN ROUND((SELECT COUNT(*) FROM opportunities WHERE stage = 'closed_won')::DECIMAL / (SELECT COUNT(*) FROM leads)::DECIMAL * 100, 2)
                ELSE 0 
            END
        ),
        'total_revenue', COALESCE((SELECT SUM(value) FROM opportunities WHERE stage = 'closed_won'), 0),
        'pipeline_value', COALESCE((SELECT SUM(value) FROM opportunities WHERE stage NOT IN ('closed_won', 'closed_lost')), 0),
        'monthly_leads', (
            SELECT COUNT(*) FROM leads 
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'monthly_opportunities', (
            SELECT COUNT(*) FROM opportunities 
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin Lead Sources (uses user_id instead of created_by)
CREATE OR REPLACE FUNCTION get_admin_lead_sources()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'source', source,
            'count', count,
            'percentage', ROUND((count::DECIMAL / total_leads::DECIMAL * 100), 2)
        )
    ) INTO result
    FROM (
        SELECT 
            COALESCE(source, 'Unknown') as source,
            COUNT(*) as count,
            (SELECT COUNT(*) FROM leads) as total_leads
        FROM leads
        GROUP BY source
    ) source_data;
    
    RETURN COALESCE(result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin Pipeline Data (uses user_id instead of created_by)
CREATE OR REPLACE FUNCTION get_admin_pipeline_data()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'stage', stage,
            'count', count,
            'value', COALESCE(total_value, 0)
        )
    ) INTO result
    FROM (
        SELECT 
            stage,
            COUNT(*) as count,
            SUM(value) as total_value
        FROM opportunities
        GROUP BY stage
        ORDER BY 
            CASE stage
                WHEN 'prospecting' THEN 1
                WHEN 'qualification' THEN 2
                WHEN 'proposal' THEN 3
                WHEN 'negotiation' THEN 4
                WHEN 'closed_won' THEN 5
                WHEN 'closed_lost' THEN 6
                ELSE 7
            END
    ) pipeline_data;
    
    RETURN COALESCE(result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- CREATE CORRECTED USER DASHBOARD FUNCTIONS
-- ================================================

-- User Dashboard Metrics (uses user_id correctly)
CREATE OR REPLACE FUNCTION get_user_dashboard_metrics(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_leads', (SELECT COUNT(*) FROM leads WHERE user_id = target_user_id),
        'total_opportunities', (SELECT COUNT(*) FROM opportunities WHERE user_id = target_user_id),
        'total_customers', (SELECT COUNT(*) FROM customers WHERE user_id = target_user_id),
        'conversion_rate', (
            CASE 
                WHEN (SELECT COUNT(*) FROM leads WHERE user_id = target_user_id) > 0 
                THEN ROUND((SELECT COUNT(*) FROM opportunities WHERE user_id = target_user_id AND stage = 'closed_won')::DECIMAL / (SELECT COUNT(*) FROM leads WHERE user_id = target_user_id)::DECIMAL * 100, 2)
                ELSE 0 
            END
        ),
        'total_revenue', COALESCE((SELECT SUM(value) FROM opportunities WHERE user_id = target_user_id AND stage = 'closed_won'), 0),
        'pipeline_value', COALESCE((SELECT SUM(value) FROM opportunities WHERE user_id = target_user_id AND stage NOT IN ('closed_won', 'closed_lost')), 0),
        'monthly_leads', (
            SELECT COUNT(*) FROM leads 
            WHERE user_id = target_user_id 
            AND created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'monthly_opportunities', (
            SELECT COUNT(*) FROM opportunities 
            WHERE user_id = target_user_id 
            AND created_at >= date_trunc('month', CURRENT_DATE)
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- User Lead Sources (uses user_id correctly)
CREATE OR REPLACE FUNCTION get_user_lead_sources(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'source', source,
            'count', count,
            'percentage', ROUND((count::DECIMAL / total_leads::DECIMAL * 100), 2)
        )
    ) INTO result
    FROM (
        SELECT 
            COALESCE(source, 'Unknown') as source,
            COUNT(*) as count,
            (SELECT COUNT(*) FROM leads WHERE user_id = target_user_id) as total_leads
        FROM leads
        WHERE user_id = target_user_id
        GROUP BY source
    ) source_data;
    
    RETURN COALESCE(result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- User Pipeline Data (uses user_id correctly)
CREATE OR REPLACE FUNCTION get_user_pipeline_data(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'stage', stage,
            'count', count,
            'value', COALESCE(total_value, 0)
        )
    ) INTO result
    FROM (
        SELECT 
            stage,
            COUNT(*) as count,
            SUM(value) as total_value
        FROM opportunities
        WHERE user_id = target_user_id
        GROUP BY stage
        ORDER BY 
            CASE stage
                WHEN 'prospecting' THEN 1
                WHEN 'qualification' THEN 2
                WHEN 'proposal' THEN 3
                WHEN 'negotiation' THEN 4
                WHEN 'closed_won' THEN 5
                WHEN 'closed_lost' THEN 6
                ELSE 7
            END
    ) pipeline_data;
    
    RETURN COALESCE(result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- UPDATE ADMIN POLICIES TO USE user_id
-- ================================================

-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Admins can manage all leads" ON leads;
DROP POLICY IF EXISTS "Admins can view all opportunities" ON opportunities;
DROP POLICY IF EXISTS "Admins can manage all opportunities" ON opportunities;
DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
DROP POLICY IF EXISTS "Admins can manage all customers" ON customers;
DROP POLICY IF EXISTS "Admins can view all activities" ON activities;
DROP POLICY IF EXISTS "Admins can manage all activities" ON activities;

-- Create corrected admin policies
-- Leads admin policies
CREATE POLICY "Admins can view all leads" ON leads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_permissions 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage all leads" ON leads
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_permissions 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Opportunities admin policies
CREATE POLICY "Admins can view all opportunities" ON opportunities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_permissions 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage all opportunities" ON opportunities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_permissions 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Customers admin policies
CREATE POLICY "Admins can view all customers" ON customers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_permissions 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage all customers" ON customers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_permissions 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Activities admin policies
CREATE POLICY "Admins can view all activities" ON activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_permissions 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage all activities" ON activities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_permissions 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ================================================
-- GRANT EXECUTE PERMISSIONS ON FUNCTIONS
-- ================================================
GRANT EXECUTE ON FUNCTION get_admin_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_lead_sources() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_pipeline_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_dashboard_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_lead_sources(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_pipeline_data(UUID) TO authenticated;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
-- All created_by references have been fixed and replaced with user_id!
-- Dashboard functions and admin policies are now corrected.
