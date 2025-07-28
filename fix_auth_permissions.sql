-- Fix auth.users permission issues

-- First, create a secure function to get user email
CREATE OR REPLACE FUNCTION get_user_email(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT email 
        FROM auth.users 
        WHERE id = user_id
    );
END;
$$;

-- Create a secure function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles ur
        WHERE ur.user_id = user_id AND ur.role = 'admin'
    );
END;
$$;

-- Create RLS policy on auth.users to allow authenticated users to see their own data
DROP POLICY IF EXISTS "Users can view own profile" ON auth.users;
CREATE POLICY "Users can view own profile" 
ON auth.users 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Enable RLS on auth.users if not already enabled
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- Fix the ultimate dashboard function with better security
CREATE OR REPLACE FUNCTION get_ultimate_dashboard_metrics()
RETURNS TABLE(
    total_leads BIGINT,
    total_opportunities BIGINT,
    total_customers BIGINT,
    conversion_rate NUMERIC,
    total_value NUMERIC,
    recent_leads_count BIGINT,
    recent_opportunities_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user is admin
    IF is_user_admin() THEN
        -- Admin sees all data
        RETURN QUERY
        SELECT 
            (SELECT COUNT(*) FROM public.leads)::BIGINT as total_leads,
            (SELECT COUNT(*) FROM public.opportunities)::BIGINT as total_opportunities,
            (SELECT COUNT(*) FROM public.customers)::BIGINT as total_customers,
            CASE 
                WHEN (SELECT COUNT(*) FROM public.leads) > 0 
                THEN ROUND((SELECT COUNT(*) FROM public.opportunities WHERE stage = 'closed_won')::NUMERIC / (SELECT COUNT(*) FROM public.leads)::NUMERIC * 100, 2)
                ELSE 0::NUMERIC
            END as conversion_rate,
            COALESCE((SELECT SUM(value) FROM public.opportunities WHERE stage = 'closed_won'), 0)::NUMERIC as total_value,
            (SELECT COUNT(*) FROM public.leads WHERE created_at >= NOW() - INTERVAL '30 days')::BIGINT as recent_leads_count,
            (SELECT COUNT(*) FROM public.opportunities WHERE created_at >= NOW() - INTERVAL '30 days')::BIGINT as recent_opportunities_count;
    ELSE
        -- Regular user sees only their data
        RETURN QUERY
        SELECT 
            (SELECT COUNT(*) FROM public.leads WHERE assigned_to = auth.uid() OR created_by = auth.uid())::BIGINT as total_leads,
            (SELECT COUNT(*) FROM public.opportunities WHERE assigned_to = auth.uid() OR created_by = auth.uid())::BIGINT as total_opportunities,
            (SELECT COUNT(*) FROM public.customers WHERE created_by = auth.uid())::BIGINT as total_customers,
            CASE 
                WHEN (SELECT COUNT(*) FROM public.leads WHERE assigned_to = auth.uid() OR created_by = auth.uid()) > 0 
                THEN ROUND((SELECT COUNT(*) FROM public.opportunities WHERE (assigned_to = auth.uid() OR created_by = auth.uid()) AND stage = 'closed_won')::NUMERIC / (SELECT COUNT(*) FROM public.leads WHERE assigned_to = auth.uid() OR created_by = auth.uid())::NUMERIC * 100, 2)
                ELSE 0::NUMERIC
            END as conversion_rate,
            COALESCE((SELECT SUM(value) FROM public.opportunities WHERE (assigned_to = auth.uid() OR created_by = auth.uid()) AND stage = 'closed_won'), 0)::NUMERIC as total_value,
            (SELECT COUNT(*) FROM public.leads WHERE (assigned_to = auth.uid() OR created_by = auth.uid()) AND created_at >= NOW() - INTERVAL '30 days')::BIGINT as recent_leads_count,
            (SELECT COUNT(*) FROM public.opportunities WHERE (assigned_to = auth.uid() OR created_by = auth.uid()) AND created_at >= NOW() - INTERVAL '30 days')::BIGINT as recent_opportunities_count;
    END IF;
END;
$$;

-- Fix ultimate lead source function
CREATE OR REPLACE FUNCTION get_ultimate_lead_source_data()
RETURNS TABLE(
    source TEXT,
    count BIGINT,
    percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF is_user_admin() THEN
        RETURN QUERY
        SELECT 
            COALESCE(l.source, 'Unknown') as source,
            COUNT(*)::BIGINT as count,
            ROUND(COUNT(*)::NUMERIC / NULLIF((SELECT COUNT(*) FROM public.leads), 0) * 100, 2) as percentage
        FROM public.leads l
        GROUP BY l.source
        ORDER BY count DESC;
    ELSE
        RETURN QUERY
        SELECT 
            COALESCE(l.source, 'Unknown') as source,
            COUNT(*)::BIGINT as count,
            ROUND(COUNT(*)::NUMERIC / NULLIF((SELECT COUNT(*) FROM public.leads WHERE assigned_to = auth.uid() OR created_by = auth.uid()), 0) * 100, 2) as percentage
        FROM public.leads l
        WHERE l.assigned_to = auth.uid() OR l.created_by = auth.uid()
        GROUP BY l.source
        ORDER BY count DESC;
    END IF;
END;
$$;

-- Fix ultimate pipeline function
CREATE OR REPLACE FUNCTION get_ultimate_pipeline_data()
RETURNS TABLE(
    stage TEXT,
    count BIGINT,
    total_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF is_user_admin() THEN
        RETURN QUERY
        SELECT 
            o.stage,
            COUNT(*)::BIGINT as count,
            COALESCE(SUM(o.value), 0)::NUMERIC as total_value
        FROM public.opportunities o
        GROUP BY o.stage
        ORDER BY 
            CASE o.stage
                WHEN 'prospecting' THEN 1
                WHEN 'qualification' THEN 2
                WHEN 'proposal' THEN 3
                WHEN 'negotiation' THEN 4
                WHEN 'closed_won' THEN 5
                WHEN 'closed_lost' THEN 6
                ELSE 7
            END;
    ELSE
        RETURN QUERY
        SELECT 
            o.stage,
            COUNT(*)::BIGINT as count,
            COALESCE(SUM(o.value), 0)::NUMERIC as total_value
        FROM public.opportunities o
        WHERE o.assigned_to = auth.uid() OR o.created_by = auth.uid()
        GROUP BY o.stage
        ORDER BY 
            CASE o.stage
                WHEN 'prospecting' THEN 1
                WHEN 'qualification' THEN 2
                WHEN 'proposal' THEN 3
                WHEN 'negotiation' THEN 4
                WHEN 'closed_won' THEN 5
                WHEN 'closed_lost' THEN 6
                ELSE 7
            END;
    END IF;
END;
$$;

-- Grant execute permissions on these functions
GRANT EXECUTE ON FUNCTION get_user_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ultimate_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ultimate_lead_source_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ultimate_pipeline_data() TO authenticated;

-- Ensure RLS policies are correct for leads and opportunities
DROP POLICY IF EXISTS "admin_full_access_leads" ON public.leads;
CREATE POLICY "admin_full_access_leads" ON public.leads
FOR ALL TO authenticated
USING (is_user_admin());

DROP POLICY IF EXISTS "user_own_leads" ON public.leads;
CREATE POLICY "user_own_leads" ON public.leads
FOR ALL TO authenticated
USING (assigned_to = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS "admin_full_access_opportunities" ON public.opportunities;
CREATE POLICY "admin_full_access_opportunities" ON public.opportunities
FOR ALL TO authenticated
USING (is_user_admin());

DROP POLICY IF EXISTS "user_own_opportunities" ON public.opportunities;
CREATE POLICY "user_own_opportunities" ON public.opportunities
FOR ALL TO authenticated
USING (assigned_to = auth.uid() OR created_by = auth.uid());

-- Ensure user_roles table has proper RLS
DROP POLICY IF EXISTS "users_can_view_own_role" ON public.user_roles;
CREATE POLICY "users_can_view_own_role" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_can_manage_all_roles" ON public.user_roles;
CREATE POLICY "admin_can_manage_all_roles" ON public.user_roles
FOR ALL TO authenticated
USING (is_user_admin());
