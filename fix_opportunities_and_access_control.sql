-- ================================================
-- Fix Opportunities Stage Constraint & Access Control
-- ================================================

-- 1. Fix the opportunities stage constraint
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;

-- Add the correct constraint with all valid stages
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_stage_check 
CHECK (stage IN ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'));

-- 2. Create user_roles table to manage admin/user roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create policy for user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own role" ON public.user_roles
    FOR ALL USING (user_id = auth.uid());

-- 5. Drop existing RLS policies for leads and opportunities
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can insert their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;

DROP POLICY IF EXISTS "Users can view their own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can insert their own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can update their own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can delete their own opportunities" ON public.opportunities;

-- 6. Create new RLS policies for leads with admin/user access control

-- Leads SELECT policy: Admin sees all, users see their own + admin's leads assigned to them
CREATE POLICY "Admin sees all leads, users see own and assigned" ON public.leads
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
        -- Users can see admin's leads assigned to them
        (assigned_to = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        ) AND EXISTS (
            SELECT 1 FROM public.user_roles admin_role 
            WHERE admin_role.user_id = leads.user_id 
            AND admin_role.role = 'admin'
        ))
    );

-- Leads INSERT policy: All authenticated users can create leads
CREATE POLICY "Authenticated users can create leads" ON public.leads
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Leads UPDATE policy: Admin can update all, users can update their own
CREATE POLICY "Admin updates all, users update own" ON public.leads
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
        OR user_id = auth.uid()
    );

-- Leads DELETE policy: Admin can delete all, users can delete their own
CREATE POLICY "Admin deletes all, users delete own" ON public.leads
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
        OR user_id = auth.uid()
    );

-- 7. Create new RLS policies for opportunities with admin/user access control

-- Opportunities SELECT policy: Admin sees all, users see their own + admin's opportunities assigned to them
CREATE POLICY "Admin sees all opportunities, users see own and assigned" ON public.opportunities
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
        -- Users can see admin's opportunities assigned to them
        (assigned_to = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        ) AND EXISTS (
            SELECT 1 FROM public.user_roles admin_role 
            WHERE admin_role.user_id = opportunities.user_id 
            AND admin_role.role = 'admin'
        ))
    );

-- Opportunities INSERT policy: All authenticated users can create opportunities
CREATE POLICY "Authenticated users can create opportunities" ON public.opportunities
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Opportunities UPDATE policy: Admin can update all, users can update their own
CREATE POLICY "Admin updates all opportunities, users update own" ON public.opportunities
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
        OR user_id = auth.uid()
    );

-- Opportunities DELETE policy: Admin can delete all, users can delete their own
CREATE POLICY "Admin deletes all opportunities, users delete own" ON public.opportunities
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
        OR user_id = auth.uid()
    );

-- 8. Insert current user as admin (replace with your actual user ID)
-- You'll need to get your user ID from auth.users table and replace the placeholder
-- INSERT INTO public.user_roles (user_id, role) 
-- VALUES ('YOUR_USER_ID_HERE', 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Success message
SELECT 'Opportunities constraint fixed and access control implemented!' AS status;
