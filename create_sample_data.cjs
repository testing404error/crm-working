#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createSampleData() {
    console.log('🚀 Creating sample data for CRM application...\n');
    
    try {
        // First, create a demo user in auth.users
        console.log('📝 Creating demo user...');
        
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: 'demo@firstmoversai.com',
            password: 'Demo123!',
            email_confirm: true,
            user_metadata: {
                role: 'admin',
                name: 'Demo Admin'
            }
        });
        
        if (authError && !authError.message.includes('already registered')) {
            throw authError;
        }
        
        const userId = authUser?.user?.id || (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === 'demo@firstmoversai.com')?.id;
        
        if (!userId) {
            throw new Error('Could not create or find demo user');
        }
        
        console.log('✅ Demo user created/found:', userId);
        
        // Create user record in public.users
        const { data: publicUser, error: publicUserError } = await supabase
            .from('users')
            .upsert([{
                auth_user_id: userId,
                name: 'Demo Admin',
                email: 'demo@firstmoversai.com',
                role: 'admin',
                team: 'Sales',
                status: 'Active'
            }])
            .select()
            .single();
            
        if (publicUserError) {
            throw publicUserError;
        }
        
        console.log('✅ Public user record created');
        
        const publicUserId = publicUser.id;
        
        // Create sample leads
        console.log('📋 Creating sample leads...');
        
        const sampleLeads = [
            {
                user_id: publicUserId,
                name: 'John Smith',
                email: 'john.smith@techcorp.com',
                phone: '+1-555-0101',
                company: 'TechCorp Solutions',
                title: 'CTO',
                source: 'website',
                score: 85,
                status: 'qualified',
                assigned_to: publicUserId,
                location: 'San Francisco, CA',
                notes: 'Interested in our enterprise solution',
                tags: '["enterprise", "high-priority"]'
            },
            {
                user_id: publicUserId,  
                name: 'Sarah Johnson',
                email: 'sarah.j@innovateplus.com',
                phone: '+1-555-0102',
                company: 'InnovatePlus',
                title: 'VP Marketing',
                source: 'referral',
                score: 70,
                status: 'contacted',
                assigned_to: publicUserId,
                location: 'New York, NY',
                notes: 'Referred by existing client',
                tags: '["marketing", "referral"]'
            },
            {
                user_id: publicUserId,
                name: 'Mike Chen',
                email: 'mike.chen@startupx.io',
                phone: '+1-555-0103',
                company: 'StartupX',
                title: 'Founder',
                source: 'social',
                score: 60,
                status: 'new',
                assigned_to: publicUserId,
                location: 'Austin, TX', 
                notes: 'Early stage startup, budget constraints',
                tags: '["startup", "budget-conscious"]'
            }
        ];
        
        const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .insert(sampleLeads)
            .select();
            
        if (leadsError) {
            throw leadsError;
        }
        
        console.log(`✅ Created ${leads.length} sample leads`);
        
        // Create sample opportunities
        console.log('💼 Creating sample opportunities...');
        
        const sampleOpportunities = [
            {
                user_id: publicUserId,
                name: "TechCorp Enterprise License",
                lead_id: leads[0].id,
                value: 50000.00,
                currency: 'USD',
                stage: 'qualification', 
                probability: 70,
                expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                assigned_to: publicUserId,
                description: 'Enterprise license for 500 users',
                tags: '["enterprise", "high-value"]',
                company: 'TechCorp Solutions',
                contact_person: 'John Smith'
            },
            {
                user_id: publicUserId,
                name: "InnovatePlus Marketing Platform",  
                lead_id: leads[1].id,
                value: 25000.00,
                currency: 'USD',
                stage: 'proposal',
                probability: 80,
                expected_close_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                assigned_to: publicUserId,
                description: 'Marketing automation platform integration',
                tags: '["marketing", "automation"]',
                company: 'InnovatePlus',
                contact_person: 'Sarah Johnson'
            },
            {
                user_id: publicUserId,
                name: "StartupX Basic Package",
                lead_id: leads[2].id, 
                value: 5000.00,
                currency: 'USD',
                stage: 'prospecting',
                probability: 30,
                expected_close_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                assigned_to: publicUserId,
                description: 'Basic package for startup needs',
                tags: '["startup", "basic"]',
                company: 'StartupX',
                contact_person: 'Mike Chen'
            },
            {
                user_id: publicUserId,
                name: "Q4 Enterprise Deal",
                value: 75000.00,
                currency: 'USD',
                stage: 'closed-won',
                probability: 100,
                expected_close_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                assigned_to: publicUserId,
                description: 'Large enterprise deal closed in Q4',
                tags: '["enterprise", "closed"]',
                company: 'Global Tech Inc',
                contact_person: 'Alex Rodriguez'
            }
        ];
        
        const { data: opportunities, error: opportunitiesError } = await supabase
            .from('opportunities')
            .insert(sampleOpportunities)
            .select();
            
        if (opportunitiesError) {
            throw opportunitiesError;
        }
        
        console.log(`✅ Created ${opportunities.length} sample opportunities`);
        
        // Create sample customers
        console.log('👥 Creating sample customers...');
        
        const sampleCustomers = [
            {
                user_id: publicUserId,
                name: 'Global Tech Inc',
                email: 'contact@globaltech.com',
                phone: '+1-555-0201',
                company: 'Global Tech Inc',
                language: 'en',
                currency: 'USD',
                total_value: 125000.00,
                notes: 'Long-term enterprise client',
                tags: '["enterprise", "vip"]'
            },
            {
                user_id: publicUserId,
                name: 'Digital Innovations Ltd',
                email: 'hello@digitalinno.com', 
                phone: '+1-555-0202',
                company: 'Digital Innovations Ltd',
                language: 'en',
                currency: 'USD',
                total_value: 45000.00,
                notes: 'Mid-market customer with growth potential',
                tags: '["mid-market", "growth"]'
            }
        ];
        
        const { data: customers, error: customersError } = await supabase
            .from('customers')
            .insert(sampleCustomers)
            .select();
            
        if (customersError) {
            throw customersError;
        }
        
        console.log(`✅ Created ${customers.length} sample customers`);
        
        // Create sample activities
        console.log('📅 Creating sample activities...');
        
        const sampleActivities = [
            {
                user_id: publicUserId,
                type: 'call',
                title: 'Follow-up call with John Smith',
                description: 'Discuss enterprise requirements and timeline',
                related_to_type: 'Lead',
                related_to_id: leads[0].id,
                related_to_name: leads[0].name,
                assigned_to: publicUserId,
                due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'pending'
            },
            {
                user_id: publicUserId,
                type: 'email',
                title: 'Send proposal to InnovatePlus',
                description: 'Prepare and send detailed proposal document',
                related_to_type: 'Opportunity', 
                related_to_id: opportunities[1].id,
                related_to_name: opportunities[1].name,
                assigned_to: publicUserId,
                due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'pending'
            },
            {
                user_id: publicUserId,
                type: 'meeting',
                title: 'Demo presentation',
                description: 'Product demo for StartupX team',
                related_to_type: 'Lead',
                related_to_id: leads[2].id,
                related_to_name: leads[2].name,
                assigned_to: publicUserId,
                completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'completed'
            }
        ];
        
        const { data: activities, error: activitiesError } = await supabase
            .from('activities')
            .insert(sampleActivities)
            .select();
            
        if (activitiesError) {
            throw activitiesError;
        }
        
        console.log(`✅ Created ${activities.length} sample activities`);
        
        // Test dashboard functions
        console.log('\n🧪 Testing dashboard functions...');
        
        // Sign in as the demo user to test functions
        const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
            email: 'demo@firstmoversai.com',
            password: 'Demo123!'
        });
        
        if (signInError) {
            console.log('⚠️  Could not sign in for testing, but data was created');
        } else {
            try {
                const { data: metrics, error: metricsError } = await supabase
                    .rpc('get_dashboard_metrics_ultimate');
                    
                if (metricsError) {
                    throw metricsError;
                }
                
                console.log('📊 Dashboard Metrics:', {
                    totalLeads: metrics.total_leads,
                    totalOpportunities: metrics.total_opportunities,
                    activeOpportunities: metrics.active_opportunities,
                    totalRevenue: `$${metrics.total_revenue}`
                });
                
            } catch (error) {
                console.log('⚠️  Dashboard function test failed:', error.message);
            }
        }
        
        console.log('\n🎉 Sample data creation completed successfully!');
        console.log('\n📋 Summary:');
        console.log(`   ✅ ${leads.length} Leads created`);
        console.log(`   ✅ ${opportunities.length} Opportunities created`);
        console.log(`   ✅ ${customers.length} Customers created`);
        console.log(`   ✅ ${activities.length} Activities created`);
        console.log('\n🔐 Demo Login Credentials:');
        console.log('   Email: demo@firstmoversai.com');
        console.log('   Password: Demo123!');
        console.log('   Role: Admin');
        
        console.log('\n🚀 Your CRM application is now ready to use!');
        
    } catch (error) {
        console.error('❌ Error creating sample data:', error.message);
        process.exit(1);
    }
}

// Execute the script
createSampleData();
