import { createClient } from '@supabase/supabase-js';

// Hardcoded values for debugging - replace with your actual values
const SUPABASE_URL = 'https://qgoqrozkqckgvdopbllg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTYxMjA4OCwiZXhwIjoyMDY3MTg4MDg4fQ.UEMhBdHK8iamLlLWKGOXfvC7HUL6dABPsSnMppZ6UMw';

async function runDiagnostics() {
  console.log('🔍 Starting comprehensive permissions diagnostics...\n');
  
  // Create Supabase client with service role
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Test 1: Verify connection and service role
    console.log('1️⃣ Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Connection failed:', testError.message);
      return;
    }
    console.log('✅ Supabase connection successful\n');

    // Test 2: Check if user_permissions table exists
    console.log('2️⃣ Checking user_permissions table...');
    const { data: permissionsTable, error: permError } = await supabase
      .from('user_permissions')
      .select('*')
      .limit(5);
    
    if (permError) {
      console.error('❌ user_permissions table error:', permError.message);
      console.log('📝 You may need to run the migration to create this table\n');
    } else {
      console.log('✅ user_permissions table exists');
      console.log('📊 Sample permissions:', JSON.stringify(permissionsTable, null, 2));
      console.log();
    }

    // Test 3: Get all users and their basic info
    console.log('3️⃣ Fetching all users...');
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('id, email, raw_user_meta_data');
    
    if (usersError) {
      console.error('❌ Users fetch failed:', usersError.message);
    } else {
      console.log('✅ Found', users.length, 'users:');
      users.forEach(user => {
        const role = user.raw_user_meta_data?.role || 'No role set';
        const assignedTo = user.raw_user_meta_data?.assigned_to || 'Not assigned';
        console.log(`  📧 ${user.email} (ID: ${user.id})`);
        console.log(`     Role: ${role}, Assigned to: ${assignedTo}`);
      });
      console.log();
    }

    // Test 4: Check leads table and ownership
    console.log('4️⃣ Checking leads ownership...');
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, email, assigned_to, created_by')
      .limit(10);
    
    if (leadsError) {
      console.error('❌ Leads fetch failed:', leadsError.message);
    } else {
      console.log('✅ Found', leads.length, 'leads (showing first 10):');
      leads.forEach(lead => {
        console.log(`  📋 Lead ${lead.id}: ${lead.email}`);
        console.log(`     Assigned to: ${lead.assigned_to || 'Unassigned'}`);
        console.log(`     Created by: ${lead.created_by || 'Unknown'}`);
      });
      console.log();
    }

    // Test 5: Check opportunities table and ownership
    console.log('5️⃣ Checking opportunities ownership...');
    const { data: opportunities, error: oppsError } = await supabase
      .from('opportunities')
      .select('id, name, assigned_to, created_by')
      .limit(10);
    
    if (oppsError) {
      console.error('❌ Opportunities fetch failed:', oppsError.message);
    } else {
      console.log('✅ Found', opportunities.length, 'opportunities (showing first 10):');
      opportunities.forEach(opp => {
        console.log(`  💼 Opportunity ${opp.id}: ${opp.name}`);
        console.log(`     Assigned to: ${opp.assigned_to || 'Unassigned'}`);
        console.log(`     Created by: ${opp.created_by || 'Unknown'}`);
      });
      console.log();
    }

    // Test 6: Check RLS status on tables
    console.log('6️⃣ Checking RLS (Row Level Security) status...');
    const { data: rlsData, error: rlsError } = await supabase
      .rpc('check_table_rls_status');
    
    if (rlsError) {
      console.log('⚠️ Could not check RLS status automatically');
      console.log('💡 You can check manually in Supabase dashboard under Authentication > Policies');
    } else {
      console.log('✅ RLS status:', JSON.stringify(rlsData, null, 2));
    }

    // Test 7: Test a specific user's access (replace with actual user ID)
    const testUserId = users?.find(u => u.email === 'pandeyankit54562@gmail.com')?.id;
    if (testUserId) {
      console.log('7️⃣ Testing specific user access...');
      console.log(`Testing access for user: pandeyankit54562@gmail.com (${testUserId})`);
      
      // Simulate what this user should see
      const userMeta = users.find(u => u.id === testUserId)?.raw_user_meta_data;
      const userRole = userMeta?.role;
      const assignedToAdmin = userMeta?.assigned_to;
      
      console.log(`  User role: ${userRole}`);
      console.log(`  Assigned to admin: ${assignedToAdmin}`);
      
      if (userRole === 'assignee' && assignedToAdmin) {
        // This user should only see their own leads + their admin's leads
        const visibleLeads = leads?.filter(lead => 
          lead.assigned_to === testUserId || lead.created_by === assignedToAdmin
        );
        console.log(`  Should see ${visibleLeads?.length || 0} leads based on access control`);
      }
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the diagnostics
runDiagnostics().then(() => {
  console.log('\n🎯 Diagnostics complete!');
  console.log('\n📋 Next steps based on results:');
  console.log('1. If user_permissions table is missing, run the migration');
  console.log('2. If RLS is disabled, re-enable it with proper policies');  
  console.log('3. If user roles/assignments are incorrect, update user metadata');
  console.log('4. If data ownership is wrong, update assigned_to and created_by fields');
});
