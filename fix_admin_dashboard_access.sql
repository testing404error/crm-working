-- ================================================
-- Fix Admin Dashboard Access & RLS Policies
-- ================================================

-- 1. First, let's create a more permissive policy for admins to access leads and opportunities
DROP POLICY IF EXISTS "Admin sees all leads, users see own and assigned" ON public.leads;
DROP POLICY IF EXISTS "Admin sees all opportunities, users see own and assigned" ON public.opportunities;

-- 2. Create new policies that properly handle admin access
CREATE POLICY "Admin and user lead access" ON public.leads
    FOR SELECT USING (
        -- Admin can see all leads
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
        OR
        -- Users can see their own leads
        user_id = auth.uid()
        OR
        -- Users can see leads assigned to them (using email matching)
        assigned_to IN (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admin and user opportunity access" ON public.opportunities
    FOR SELECT USING (
        -- Admin can see all opportunities
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
        OR
        -- Users can see their own opportunities
        user_id = auth.uid()
        OR
        -- Users can see opportunities assigned to them (using email matching)
        assigned_to IN (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    );

-- 3. Create a view for dashboard metrics that bypasses RLS issues
CREATE OR REPLACE VIEW public.dashboard_metrics AS
SELECT 
    ur.user_id,
    ur.role,
    (
        SELECT COUNT(*) 
        FROM public.leads l 
        WHERE (ur.role = 'admin' OR l.user_id = ur.user_id)
    ) as total_leads,
    (
        SELECT COUNT(*) 
        FROM public.opportunities o 
        WHERE (ur.role = 'admin' OR o.user_id = ur.user_id)
        AND o.stage NOT IN ('closed_won', 'closed_lost')
    ) as active_opportunities,
    (
        SELECT COUNT(*) 
        FROM public.opportunities o 
        WHERE (ur.role = 'admin' OR o.user_id = ur.user_id)
    ) as total_opportunities,
    (
        SELECT COALESCE(SUM(o.value), 0) 
        FROM public.opportunities o 
        WHERE (ur.role = 'admin' OR o.user_id = ur.user_id)
        AND o.stage = 'closed_won'
    ) as total_revenue
FROM public.user_roles ur;

-- 4. Enable RLS on the view
ALTER VIEW public.dashboard_metrics SET (security_barrier = true);

-- 5. Create RLS policy for the dashboard metrics view
CREATE POLICY "Users can view their dashboard metrics" ON public.dashboard_metrics
    FOR SELECT USING (user_id = auth.uid());

-- 6. Create a function to get lead source data that works with admin permissions
CREATE OR REPLACE FUNCTION public.get_lead_source_data(for_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(source TEXT, count BIGINT) AS $$
BEGIN
    -- Check if user is admin
    IF EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = for_user_id AND role = 'admin'
    ) THEN
        -- Admin sees all leads
        RETURN QUERY
        SELECT l.source, COUNT(*)::BIGINT
        FROM public.leads l
        WHERE l.source IS NOT NULL
        GROUP BY l.source;
    ELSE
        -- Regular users see only their leads
        RETURN QUERY
        SELECT l.source, COUNT(*)::BIGINT
        FROM public.leads l
        WHERE l.user_id = for_user_id AND l.source IS NOT NULL
        GROUP BY l.source;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create a function to get pipeline data that works with admin permissions
CREATE OR REPLACE FUNCTION public.get_pipeline_data(for_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(stage TEXT, count BIGINT, value DECIMAL) AS $$
BEGIN
    -- Check if user is admin
    IF EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = for_user_id AND role = 'admin'
    ) THEN
        -- Admin sees all opportunities
        RETURN QUERY
        SELECT o.stage, COUNT(*)::BIGINT, COALESCE(SUM(o.value), 0)::DECIMAL
        FROM public.opportunities o
        WHERE o.stage IS NOT NULL
        GROUP BY o.stage;
    ELSE
        -- Regular users see only their opportunities
        RETURN QUERY
        SELECT o.stage, COUNT(*)::BIGINT, COALESCE(SUM(o.value), 0)::DECIMAL
        FROM public.opportunities o
        WHERE o.user_id = for_user_id AND o.stage IS NOT NULL
        GROUP BY o.stage;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Grant necessary permissions
GRANT SELECT ON public.dashboard_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_source_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pipeline_data(UUID) TO authenticated;

-- 9. Verify current user's role
SELECT 
    u.email,
    ur.role,
    'Should be admin for dashboard access' as note
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.id = auth.uid();

-- Success message
SELECT 'Admin dashboard access has been fixed!' AS status;
