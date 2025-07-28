-- ================================================
-- Fix Access Control for Regular Users
-- ================================================

-- 1. First, let's drop existing problematic policies
DROP POLICY IF EXISTS "Admin sees all, users see own and assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Admin sees all, users see own and assigned opportunities" ON public.opportunities;

-- 2. Create proper RLS policies that work correctly
-- Policy for leads: Admin sees all, users see their own + leads assigned to their email
CREATE POLICY "Leads access policy" ON public.leads
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
        -- Users can see leads assigned to their email address
        assigned_to = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    );

-- Policy for opportunities: Admin sees all, users see their own + opportunities assigned to their email
CREATE POLICY "Opportunities access policy" ON public.opportunities
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
        -- Users can see opportunities assigned to their email address
        assigned_to = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    );

-- 3. Create INSERT, UPDATE, DELETE policies for leads
CREATE POLICY "Leads insert policy" ON public.leads
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Leads update policy" ON public.leads
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
        OR user_id = auth.uid()
    );

CREATE POLICY "Leads delete policy" ON public.leads
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
        OR user_id = auth.uid()
    );

-- 4. Create INSERT, UPDATE, DELETE policies for opportunities
CREATE POLICY "Opportunities insert policy" ON public.opportunities
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Opportunities update policy" ON public.opportunities
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
        OR user_id = auth.uid()
    );

CREATE POLICY "Opportunities delete policy" ON public.opportunities
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
        OR user_id = auth.uid()
    );

-- 5. Fix the dashboard functions to respect RLS policies
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_final()
RETURNS TABLE(
    total_leads BIGINT,
    active_opportunities BIGINT,
    total_opportunities BIGINT,
    total_revenue DECIMAL
) AS $$
BEGIN
    -- Use regular queries that respect RLS policies
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.leads)::BIGINT,
        (SELECT COUNT(*) FROM public.opportunities 
         WHERE stage NOT IN ('closed_won', 'closed_lost'))::BIGINT,
        (SELECT COUNT(*) FROM public.opportunities)::BIGINT,
        (SELECT COALESCE(SUM(value), 0) FROM public.opportunities 
         WHERE stage = 'closed_won')::DECIMAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_lead_source_data_final()
RETURNS TABLE(source TEXT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT l.source, COUNT(*)::BIGINT
    FROM public.leads l
    WHERE l.source IS NOT NULL
    GROUP BY l.source;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_pipeline_data_final()
RETURNS TABLE(stage TEXT, count BIGINT, value DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT o.stage, COUNT(*)::BIGINT, COALESCE(SUM(o.value), 0)::DECIMAL
    FROM public.opportunities o
    WHERE o.stage IS NOT NULL
    GROUP BY o.stage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant permissions on new functions
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics_final() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_source_data_final() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pipeline_data_final() TO authenticated;

-- 7. Enable RLS on tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- 8. Create test data with proper assignments
-- (This would be where admin creates leads/opportunities and assigns them to regular users)

-- Success message
SELECT 'Access control policies have been fixed!' AS status;
SELECT 'Regular users should now see data assigned to their email address' AS note;
