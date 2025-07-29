-- Restore RLS policies for leads, opportunities, and activities to resolve the visibility

-- 1. Restore RLS policy: Users can manage accessible leads
CREATE POLICY "Users can manage accessible leads" ON public.leads
    FOR SELECT USING (
        user_id = auth.uid() OR
        assigned_to = auth.uid()
    );

-- 2. Restore RLS policy: Users can manage accessible opportunities
CREATE POLICY "Users can manage accessible opportunities" ON public.opportunities
    FOR SELECT USING (
        user_id = auth.uid() OR
        assigned_to = auth.uid()
    );

-- 3. Restore RLS policy: Users can manage accessible activities
CREATE POLICY "Users can manage accessible activities" ON public.activities
    FOR SELECT USING (
        user_id = auth.uid() OR
        assigned_to = auth.uid()
    );
