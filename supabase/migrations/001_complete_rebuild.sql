-- =====================================================
-- COMPLETE DATABASE REBUILD - Version 2.0
-- This migration rebuilds the entire database schema
-- =====================================================

-- Drop all existing objects to start fresh
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Grant permissions to roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- CREATE CORE TABLES
-- =====================================================

-- Users table (extends auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    team VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Invited')),
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads table
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    company VARCHAR(255),
    title VARCHAR(255),
    source VARCHAR(50) NOT NULL CHECK (source IN ('website', 'email', 'social', 'referral', 'manual')),
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted')),
    assigned_to UUID REFERENCES public.users(id),
    location VARCHAR(255),
    notes TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opportunities table
CREATE TABLE public.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    customer_id UUID,
    value DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'INR',
    stage VARCHAR(50) DEFAULT 'prospecting' CHECK (stage IN ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost')),
    probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    assigned_to UUID NOT NULL REFERENCES public.users(id),
    description TEXT,
    lost_reason TEXT,
    next_action TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    company VARCHAR(255),
    contact_person VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    company VARCHAR(255),
    language VARCHAR(10) DEFAULT 'en',
    currency VARCHAR(3) DEFAULT 'INR',
    total_value DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activities table
CREATE TABLE public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'task', 'note')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    related_to_type VARCHAR(50),
    related_to_id UUID,
    related_to_name VARCHAR(255),
    assigned_to UUID NOT NULL REFERENCES public.users(id),
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Communications table
CREATE TABLE public.communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'sms', 'call')),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'sent',
    attachments JSONB DEFAULT '[]'::jsonb
);

-- Access control table
CREATE TABLE public.access_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, granted_to_user_id)
);

-- System settings table (fixes the 404 error)
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) DEFAULT 'First Movers AI',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO public.system_settings (company_name) VALUES ('First Movers AI');

-- =====================================================
-- CREATE INDEXES
-- =====================================================

CREATE INDEX idx_leads_user_id ON public.leads(user_id);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_opportunities_user_id ON public.opportunities(user_id);
CREATE INDEX idx_opportunities_assigned_to ON public.opportunities(assigned_to);
CREATE INDEX idx_opportunities_stage ON public.opportunities(stage);

-- =====================================================
-- CREATE FUNCTIONS
-- =====================================================

-- Helper function for access control
CREATE OR REPLACE FUNCTION get_accessible_user_ids(input_user_id UUID)
RETURNS UUID[] AS $$
DECLARE
    user_role TEXT;
    accessible_ids UUID[];
BEGIN
    -- Get user role from auth.users metadata
    SELECT COALESCE(raw_user_meta_data->>'role', 'user') INTO user_role
    FROM auth.users 
    WHERE id = input_user_id;
    
    -- Admin users can access all user data
    IF user_role = 'admin' THEN
        SELECT ARRAY_AGG(id) INTO accessible_ids FROM public.users;
        RETURN COALESCE(accessible_ids, ARRAY[]::UUID[]);
    END IF;
    
    -- Regular users can access their own data + data from users who granted access
    SELECT ARRAY_AGG(DISTINCT user_id) INTO accessible_ids
    FROM (
        -- Own data
        SELECT input_user_id as user_id
        UNION
        -- Data from users who granted access
        SELECT ac.user_id
        FROM public.access_control ac
        WHERE ac.granted_to_user_id = input_user_id
        UNION
        -- Data where user is assigned (for leads/opportunities)
        SELECT l.user_id
        FROM public.leads l
        WHERE l.assigned_to = input_user_id
        UNION
        SELECT o.user_id
        FROM public.opportunities o
        WHERE o.assigned_to = input_user_id
    ) accessible_data;
    
    RETURN COALESCE(accessible_ids, ARRAY[input_user_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dashboard metrics function
CREATE OR REPLACE FUNCTION get_dashboard_metrics_ultimate()
RETURNS TABLE (
    total_leads BIGINT,
    total_opportunities BIGINT,
    active_opportunities BIGINT,
    total_revenue NUMERIC
) AS $$
DECLARE
    current_user_id UUID;
    accessible_ids UUID[];
BEGIN
    current_user_id := auth.uid();
    accessible_ids := get_accessible_user_ids(current_user_id);
    
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.leads WHERE user_id = ANY(accessible_ids))::BIGINT as total_leads,
        (SELECT COUNT(*) FROM public.opportunities WHERE user_id = ANY(accessible_ids))::BIGINT as total_opportunities,
        (SELECT COUNT(*) FROM public.opportunities WHERE user_id = ANY(accessible_ids) AND stage NOT IN ('closed-won', 'closed-lost'))::BIGINT as active_opportunities,
        (SELECT COALESCE(SUM(value), 0) FROM public.opportunities WHERE user_id = ANY(accessible_ids) AND stage = 'closed-won')::NUMERIC as total_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lead source data function
CREATE OR REPLACE FUNCTION get_lead_source_data_ultimate()
RETURNS TABLE (source TEXT, count BIGINT) AS $$
DECLARE
    current_user_id UUID;
    accessible_ids UUID[];
BEGIN
    current_user_id := auth.uid();
    accessible_ids := get_accessible_user_ids(current_user_id);
    
    RETURN QUERY
    SELECT l.source::TEXT, COUNT(*)::BIGINT
    FROM public.leads l
    WHERE l.user_id = ANY(accessible_ids)
    GROUP BY l.source
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pipeline data function
CREATE OR REPLACE FUNCTION get_pipeline_data_ultimate()
RETURNS TABLE (stage TEXT, count BIGINT, value NUMERIC) AS $$
DECLARE
    current_user_id UUID;
    accessible_ids UUID[];
BEGIN
    current_user_id := auth.uid();
    accessible_ids := get_accessible_user_ids(current_user_id);
    
    RETURN QUERY
    SELECT o.stage::TEXT, COUNT(*)::BIGINT, COALESCE(SUM(o.value), 0)::NUMERIC
    FROM public.opportunities o
    WHERE o.user_id = ANY(accessible_ids)
    GROUP BY o.stage
    ORDER BY 
        CASE o.stage
            WHEN 'prospecting' THEN 1
            WHEN 'qualification' THEN 2
            WHEN 'proposal' THEN 3
            WHEN 'negotiation' THEN 4
            WHEN 'closed-won' THEN 5
            WHEN 'closed-lost' THEN 6
            ELSE 7
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Top opportunities function
CREATE OR REPLACE FUNCTION get_top_opportunities_ultimate(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (id UUID, name TEXT, value NUMERIC, stage TEXT, probability INTEGER) AS $$
DECLARE
    current_user_id UUID;
    accessible_ids UUID[];
BEGIN
    current_user_id := auth.uid();
    accessible_ids := get_accessible_user_ids(current_user_id);
    
    RETURN QUERY
    SELECT o.id, o.name::TEXT, o.value::NUMERIC, o.stage::TEXT, o.probability
    FROM public.opportunities o
    WHERE o.user_id = ANY(accessible_ids) AND o.stage NOT IN ('closed-won', 'closed-lost')
    ORDER BY o.value DESC, o.probability DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Users policies
CREATE POLICY "Users can read all user profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- Leads policies
CREATE POLICY "Users can access leads they have permission for" ON public.leads FOR SELECT USING (user_id = ANY(get_accessible_user_ids(auth.uid())));
CREATE POLICY "Users can create leads" ON public.leads FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can update leads they have access to" ON public.leads FOR UPDATE USING (user_id = ANY(get_accessible_user_ids(auth.uid())));
CREATE POLICY "Users can delete leads they have access to" ON public.leads FOR DELETE USING (user_id = ANY(get_accessible_user_ids(auth.uid())));

-- Opportunities policies
CREATE POLICY "Users can access opportunities they have permission for" ON public.opportunities FOR SELECT USING (user_id = ANY(get_accessible_user_ids(auth.uid())));
CREATE POLICY "Users can create opportunities" ON public.opportunities FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can update opportunities they have access to" ON public.opportunities FOR UPDATE USING (user_id = ANY(get_accessible_user_ids(auth.uid())));
CREATE POLICY "Users can delete opportunities they have access to" ON public.opportunities FOR DELETE USING (user_id = ANY(get_accessible_user_ids(auth.uid())));

-- System settings policies (allow everyone to read company name)
CREATE POLICY "Everyone can read system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can update system settings" ON public.system_settings FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND COALESCE(raw_user_meta_data->>'role', 'user') = 'admin'
    )
);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
