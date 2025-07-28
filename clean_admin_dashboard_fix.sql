-- ================================================
-- Clean Admin Dashboard Fix
-- ================================================

-- 1. Update RLS policies to be more permissive for admins
DROP POLICY IF EXISTS "Admin sees all, users see own and assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Admin sees all, users see own and assigned opportunities" ON public.opportunities;

-- 2. Create simplified policies
CREATE POLICY "Admin sees all, users see own and assigned leads" ON public.leads
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
        -- Users can see leads assigned to them
        assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

CREATE POLICY "Admin sees all, users see own and assigned opportunities" ON public.opportunities
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
        -- Users can see opportunities assigned to them
        assigned_to = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- 3. Create a function to get dashboard metrics
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
RETURNS TABLE(
    total_leads BIGINT,
    active_opportunities BIGINT,
    total_opportunities BIGINT,
    total_revenue DECIMAL
) AS $$
DECLARE
    is_admin BOOLEAN;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Check if user is admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = current_user_id AND role = 'admin'
    ) INTO is_admin;
    
    IF is_admin THEN
        -- Admin sees all data
        RETURN QUERY
        SELECT 
            (SELECT COUNT(*) FROM public.leads)::BIGINT as total_leads,
            (SELECT COUNT(*) FROM public.opportunities 
             WHERE stage NOT IN ('closed_won', 'closed_lost'))::BIGINT as active_opportunities,
            (SELECT COUNT(*) FROM public.opportunities)::BIGINT as total_opportunities,
            (SELECT COALESCE(SUM(value), 0) FROM public.opportunities 
             WHERE stage = 'closed_won')::DECIMAL as total_revenue;
    ELSE
        -- Regular user sees only their data
        RETURN QUERY
        SELECT 
            (SELECT COUNT(*) FROM public.leads 
             WHERE user_id = current_user_id)::BIGINT as total_leads,
            (SELECT COUNT(*) FROM public.opportunities 
             WHERE user_id = current_user_id 
             AND stage NOT IN ('closed_won', 'closed_lost'))::BIGINT as active_opportunities,
            (SELECT COUNT(*) FROM public.opportunities 
             WHERE user_id = current_user_id)::BIGINT as total_opportunities,
            (SELECT COALESCE(SUM(value), 0) FROM public.opportunities 
             WHERE user_id = current_user_id 
             AND stage = 'closed_won')::DECIMAL as total_revenue;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create lead source data function
CREATE OR REPLACE FUNCTION public.get_lead_source_data()
RETURNS TABLE(source TEXT, count BIGINT) AS $$
DECLARE
    is_admin BOOLEAN;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Check if user is admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = current_user_id AND role = 'admin'
    ) INTO is_admin;
    
    IF is_admin THEN
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
        WHERE l.user_id = current_user_id AND l.source IS NOT NULL
        GROUP BY l.source;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create pipeline data function
CREATE OR REPLACE FUNCTION public.get_pipeline_data()
RETURNS TABLE(stage TEXT, count BIGINT, value DECIMAL) AS $$
DECLARE
    is_admin BOOLEAN;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Check if user is admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = current_user_id AND role = 'admin'
    ) INTO is_admin;
    
    IF is_admin THEN
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
        WHERE o.user_id = current_user_id AND o.stage IS NOT NULL
        GROUP BY o.stage;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_source_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pipeline_data() TO authenticated;

-- 7. Test the current user's role
SELECT 
    u.email,
    COALESCE(ur.role, 'no role') as role,
    'This should show your role for dashboard access' as note
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.id = auth.uid();

-- Success message
SELECT 'Clean admin dashboard access has been configured!' AS status;
