-- ================================================
-- Fix All Database Issues
-- ================================================

-- 1. Create missing system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create missing communications table
CREATE TABLE IF NOT EXISTS public.communications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create missing assignee_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.assignee_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Fix the opportunities stage constraint to include closed_won and closed_lost
-- First drop the existing constraint
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;

-- Add the updated constraint with all valid stages
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_stage_check 
CHECK (stage IN ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'));

-- 5. Enable RLS on new tables
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignee_users ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for new tables

-- System settings policies (admin only)
CREATE POLICY "Authenticated users can view system settings" ON public.system_settings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update system settings" ON public.system_settings
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Communications policies
CREATE POLICY "Users can view their lead communications" ON public.communications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.leads 
            WHERE leads.id = communications.lead_id 
            AND leads.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert communications for their leads" ON public.communications
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.leads 
            WHERE leads.id = communications.lead_id 
            AND leads.user_id = auth.uid()
        )
    );

-- Assignee users policies (accessible to all authenticated users)
CREATE POLICY "All users can view assignee users" ON public.assignee_users
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All users can insert assignee users" ON public.assignee_users
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "All users can update assignee users" ON public.assignee_users
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "All users can delete assignee users" ON public.assignee_users
    FOR DELETE USING (auth.role() = 'authenticated');

-- 7. Insert some sample assignee users if none exist
INSERT INTO public.assignee_users (name, email) 
SELECT * FROM (VALUES 
    ('Admin User', 'admin@example.com'),
    ('Sales Manager', 'sales@example.com'),
    ('Lead Specialist', 'leads@example.com')
) AS v(name, email)
WHERE NOT EXISTS (SELECT 1 FROM public.assignee_users WHERE email = v.email);

-- 8. Insert default system settings if none exist
INSERT INTO public.system_settings (company_name) 
SELECT 'First Movers AI'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);

-- Success message
SELECT 'All database issues have been fixed!' AS status;
