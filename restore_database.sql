-- ================================================
-- CRM Database Schema Restoration Script
-- ================================================

-- Drop existing tables if they exist (in correct order to handle dependencies)
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS opportunities CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS assignee_relationships CASCADE;
DROP TABLE IF EXISTS assignee_users CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS pending_access_requests CASCADE;

-- ================================================
-- 1. LEADS TABLE
-- ================================================
CREATE TABLE leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    source VARCHAR(100) DEFAULT 'manual',
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted')),
    assigned_to VARCHAR(255),
    location VARCHAR(255),
    notes TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- 2. OPPORTUNITIES TABLE
-- ================================================
CREATE TABLE opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    value DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    stage VARCHAR(50) DEFAULT 'prospecting' CHECK (stage IN ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
    probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    assigned_to VARCHAR(255),
    description TEXT,
    next_action TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- 3. CUSTOMERS TABLE
-- ================================================
CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    language VARCHAR(50) DEFAULT 'English',
    currency VARCHAR(10) DEFAULT 'USD',
    total_value DECIMAL(15,2) DEFAULT 0,
    addresses JSONB DEFAULT '[]',
    tags TEXT[],
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- 4. ACTIVITIES TABLE
-- ================================================
CREATE TABLE activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'task', 'note')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    related_to_type VARCHAR(50) CHECK (related_to_type IN ('lead', 'opportunity', 'customer')),
    related_to_id UUID,
    related_to_name VARCHAR(255),
    assigned_to VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue', 'cancelled')),
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- 5. ASSIGNEE USERS TABLE
-- ================================================
CREATE TABLE assignee_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- 6. ASSIGNEE RELATIONSHIPS TABLE
-- ================================================
CREATE TABLE assignee_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES assignee_users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, assignee_id)
);

-- ================================================
-- 7. USER PERMISSIONS TABLE
-- ================================================
CREATE TABLE user_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ================================================
-- 8. PENDING ACCESS REQUESTS TABLE
-- ================================================
CREATE TABLE pending_access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ================================================
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_created_at ON leads(created_at);

CREATE INDEX idx_opportunities_user_id ON opportunities(user_id);
CREATE INDEX idx_opportunities_lead_id ON opportunities(lead_id);
CREATE INDEX idx_opportunities_assigned_to ON opportunities(assigned_to);
CREATE INDEX idx_opportunities_stage ON opportunities(stage);
CREATE INDEX idx_opportunities_created_at ON opportunities(created_at);

CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_created_at ON customers(created_at);

CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_related_to ON activities(related_to_type, related_to_id);
CREATE INDEX idx_activities_assigned_to ON activities(assigned_to);
CREATE INDEX idx_activities_due_date ON activities(due_date);
CREATE INDEX idx_activities_status ON activities(status);

CREATE INDEX idx_assignee_relationships_user_id ON assignee_relationships(user_id);
CREATE INDEX idx_assignee_relationships_assignee_id ON assignee_relationships(assignee_id);

CREATE INDEX idx_access_requests_requester ON pending_access_requests(requester_id);
CREATE INDEX idx_access_requests_receiver ON pending_access_requests(receiver_id);
CREATE INDEX idx_access_requests_status ON pending_access_requests(status);

-- ================================================
-- ENABLE ROW LEVEL SECURITY
-- ================================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignee_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignee_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_access_requests ENABLE ROW LEVEL SECURITY;

-- ================================================
-- CREATE RLS POLICIES
-- ================================================

-- Leads policies
CREATE POLICY "Users can view their own leads" ON leads
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own leads" ON leads
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own leads" ON leads
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own leads" ON leads
    FOR DELETE USING (user_id = auth.uid());

-- Opportunities policies
CREATE POLICY "Users can view their own opportunities" ON opportunities
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own opportunities" ON opportunities
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own opportunities" ON opportunities
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own opportunities" ON opportunities
    FOR DELETE USING (user_id = auth.uid());

-- Customers policies
CREATE POLICY "Users can view their own customers" ON customers
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own customers" ON customers
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own customers" ON customers
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own customers" ON customers
    FOR DELETE USING (user_id = auth.uid());

-- Activities policies
CREATE POLICY "Users can view their own activities" ON activities
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own activities" ON activities
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own activities" ON activities
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own activities" ON activities
    FOR DELETE USING (user_id = auth.uid());

-- Assignee users policies (accessible to all authenticated users)
CREATE POLICY "All users can view assignee users" ON assignee_users
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Only authenticated users can manage assignee users" ON assignee_users
    FOR ALL USING (auth.role() = 'authenticated');

-- Assignee relationships policies
CREATE POLICY "Users can view their own assignee relationships" ON assignee_relationships
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage their own assignee relationships" ON assignee_relationships
    FOR ALL USING (user_id = auth.uid());

-- User permissions policies
CREATE POLICY "Users can view their own permissions" ON user_permissions
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage their own permissions" ON user_permissions
    FOR ALL USING (user_id = auth.uid());

-- Access requests policies
CREATE POLICY "Users can view their own requests" ON pending_access_requests
    FOR SELECT USING (requester_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Users can insert their own requests" ON pending_access_requests
    FOR INSERT WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Receivers can update request status" ON pending_access_requests
    FOR UPDATE USING (receiver_id = auth.uid());
CREATE POLICY "Requesters can delete their own requests" ON pending_access_requests
    FOR DELETE USING (requester_id = auth.uid());

-- ================================================
-- CREATE TRIGGER FUNCTIONS
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- CREATE TRIGGERS
-- ================================================
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at
    BEFORE UPDATE ON user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_access_requests_updated_at
    BEFORE UPDATE ON pending_access_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
-- Schema restoration complete!
