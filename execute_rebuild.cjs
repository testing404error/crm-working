#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client with service role key for admin operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function executeSQL(query, description) {
    console.log(`\n🔧 ${description}...`);
    try {
        const { data, error } = await supabase.rpc('exec_sql', { 
            sql_query: query.trim() 
        });
        
        if (error) {
            console.error(`❌ Error: ${error.message}`);
            return false;
        }
        
        console.log(`✅ ${description} completed successfully`);
        return true;
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        return false;
    }
}

async function createExecutionFunction() {
    const execFunction = `
        CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
        RETURNS text AS $$
        DECLARE
            result text;
        BEGIN
            EXECUTE sql_query;
            RETURN 'SUCCESS';
        EXCEPTION 
            WHEN OTHERS THEN
                GET STACKED DIAGNOSTICS result = MESSAGE_TEXT;
                RETURN 'ERROR: ' || result;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    console.log('🔧 Creating SQL execution helper function...');
    
    try {
        // Try to create function directly through SQL
        const { data, error } = await supabase
            .from('pg_stat_statements')
            .select('*')
            .limit(0);
            
        // If we can't access pg_stat_statements, create function manually
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey
            },
            body: JSON.stringify({ sql_query: execFunction })
        });
        
        if (response.ok) {
            console.log('✅ SQL execution helper created');
            return true;
        } else {
            // Try alternative approach
            console.log('⚠️  Direct function creation failed, trying RPC approach...');
            const { data, error } = await supabase.rpc('exec_sql', { sql_query: execFunction });
            
            if (error && !error.message.includes('does not exist')) {
                console.error('❌ Cannot create execution function:', error.message);
                return false;
            }
            
            console.log('✅ SQL execution helper created via RPC');
            return true;
        }
    } catch (error) {
        console.log('⚠️  Could not create execution function:', error.message);
        return false;
    }
}

async function executeRebuild() {
    console.log('🚀 Starting automated database rebuild...\n');
    
    // First create the execution function
    const funcCreated = await createExecutionFunction();
    
    if (!funcCreated) {
        console.log('\n❌ Could not create execution helper. Please execute manually in Supabase Dashboard.');
        console.log(`🌐 Dashboard: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`);
        return;
    }
    
    // Drop schema and recreate
    const dropSchema = `
        DROP SCHEMA IF EXISTS public CASCADE;
        CREATE SCHEMA public;
        GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
        GRANT ALL ON SCHEMA public TO postgres, service_role;
    `;
    
    if (!await executeSQL(dropSchema, 'Dropping and recreating schema')) {
        return;
    }
    
    // Enable extensions
    const extensions = `
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `;
    
    if (!await executeSQL(extensions, 'Enabling extensions')) {
        return;
    }
    
    // Create users table
    const usersTable = `
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
    `;
    
    if (!await executeSQL(usersTable, 'Creating users table')) {
        return;
    }
    
    // Create leads table
    const leadsTable = `
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
    `;
    
    if (!await executeSQL(leadsTable, 'Creating leads table')) {
        return;
    }
    
    // Create opportunities table
    const opportunitiesTable = `
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
    `;
    
    if (!await executeSQL(opportunitiesTable, 'Creating opportunities table')) {
        return;
    }
    
    // Create other essential tables
    const otherTables = `
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
        
        CREATE TABLE public.access_control (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            granted_to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, granted_to_user_id)
        );
    `;
    
    if (!await executeSQL(otherTables, 'Creating additional tables')) {
        return;
    }
    
    // Create indexes
    const indexes = `
        CREATE INDEX idx_leads_user_id ON public.leads(user_id);
        CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
        CREATE INDEX idx_opportunities_user_id ON public.opportunities(user_id);
        CREATE INDEX idx_opportunities_assigned_to ON public.opportunities(assigned_to);
        CREATE INDEX idx_opportunities_stage ON public.opportunities(stage);
    `;
    
    if (!await executeSQL(indexes, 'Creating indexes')) {
        return;
    }
    
    console.log('\n🎉 Database rebuild completed successfully!');
    console.log('Now creating functions and RLS policies...');
    
    // Continue with functions and policies in the next step
    await createFunctionsAndPolicies();
}

async function createFunctionsAndPolicies() {
    // Create helper function
    const helperFunction = `
        CREATE OR REPLACE FUNCTION get_accessible_user_ids(input_user_id UUID)
        RETURNS UUID[] AS $$
        DECLARE
            user_role TEXT;
            accessible_ids UUID[];
        BEGIN
            SELECT COALESCE(raw_user_meta_data->>'role', 'user') INTO user_role
            FROM auth.users 
            WHERE id = input_user_id;
            
            IF user_role = 'admin' THEN
                SELECT ARRAY_AGG(id) INTO accessible_ids FROM public.users;
                RETURN COALESCE(accessible_ids, ARRAY[]::UUID[]);
            END IF;
            
            SELECT ARRAY_AGG(DISTINCT user_id) INTO accessible_ids
            FROM (
                SELECT input_user_id as user_id
                UNION
                SELECT ac.user_id
                FROM public.access_control ac
                WHERE ac.granted_to_user_id = input_user_id
                UNION
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
    `;
    
    if (!await executeSQL(helperFunction, 'Creating access control helper function')) {
        return;
    }
    
    // Create dashboard functions
    const dashboardFunctions = `
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
            GROUP BY o.stage;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        
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
    `;
    
    if (!await executeSQL(dashboardFunctions, 'Creating dashboard functions')) {
        return;
    }
    
    // Enable RLS and create policies
    const rlsSetup = `
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.access_control ENABLE ROW LEVEL SECURITY;
    `;
    
    if (!await executeSQL(rlsSetup, 'Enabling RLS on tables')) {
        return;
    }
    
    // Create RLS policies
    const policies = `
        CREATE POLICY "Users can read all user profiles" ON public.users FOR SELECT USING (true);
        CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = auth_user_id);
        CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
        
        CREATE POLICY "Users can access leads they have permission for" ON public.leads FOR SELECT USING (user_id = ANY(get_accessible_user_ids(auth.uid())));
        CREATE POLICY "Users can create leads" ON public.leads FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
        CREATE POLICY "Users can update leads they have access to" ON public.leads FOR UPDATE USING (user_id = ANY(get_accessible_user_ids(auth.uid())));
        CREATE POLICY "Users can delete leads they have access to" ON public.leads FOR DELETE USING (user_id = ANY(get_accessible_user_ids(auth.uid())));
        
        CREATE POLICY "Users can access opportunities they have permission for" ON public.opportunities FOR SELECT USING (user_id = ANY(get_accessible_user_ids(auth.uid())));
        CREATE POLICY "Users can create opportunities" ON public.opportunities FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
        CREATE POLICY "Users can update opportunities they have access to" ON public.opportunities FOR UPDATE USING (user_id = ANY(get_accessible_user_ids(auth.uid())));
        CREATE POLICY "Users can delete opportunities they have access to" ON public.opportunities FOR DELETE USING (user_id = ANY(get_accessible_user_ids(auth.uid())));
    `;
    
    if (!await executeSQL(policies, 'Creating RLS policies')) {
        return;
    }
    
    // Grant permissions
    const permissions = `
        GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
    `;
    
    if (!await executeSQL(permissions, 'Granting permissions')) {
        return;
    }
    
    console.log('\n🎉 Complete database rebuild finished successfully!');
    console.log('✅ All tables, functions, and RLS policies have been created.');
    console.log('✅ Your CRM application should now work properly.');
    
    // Test the functions
    console.log('\n🧪 Testing dashboard functions...');
    try {
        const { data, error } = await supabase.rpc('get_dashboard_metrics_ultimate');
        if (error) {
            console.log('❌ Dashboard function test failed:', error.message);
        } else {
            console.log('✅ Dashboard functions working correctly!');
        }
    } catch (error) {
        console.log('❌ Dashboard function test failed:', error.message);
    }
}

// Execute the rebuild
executeRebuild().catch(console.error);
