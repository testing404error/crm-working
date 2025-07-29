import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qgoqrozkqckgvdopbllg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAccessIssues() {
  console.log('🔍 DEBUGGING ACCESS CONTROL ISSUES');
  console.log('=====================================');

  try {
    // 1. Check if access_control table exists and has data
    console.log('\n1. Checking access_control table...');
    const { data: accessControlData, error: accessError } = await supabase
      .from('access_control')
      .select('*')
      .limit(10);
    
    if (accessError) {
      console.error('❌ access_control table error:', accessError.message);
    } else {
      console.log('✅ access_control table data:', accessControlData.length, 'records');
      accessControlData.forEach(record => {
        console.log(`   - User ${record.user_id} granted access to ${record.granted_to_user_id}`);
      });
    }

    // 2. Check if pending_access_requests table exists and has data
    console.log('\n2. Checking pending_access_requests table...');
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('pending_access_requests')
      .select('*')
      .limit(10);
    
    if (pendingError) {
      console.error('❌ pending_access_requests table error:', pendingError.message);
    } else {
      console.log('✅ pending_access_requests table data:', pendingRequests.length, 'records');
      pendingRequests.forEach(record => {
        console.log(`   - Request from ${record.requester_id} to ${record.receiver_id}, status: ${record.status}`);
      });
    }

    // 3. Check users table structure
    console.log('\n3. Checking users table...');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, auth_user_id')
      .limit(5);
    
    if (usersError) {
      console.error('❌ users table error:', usersError.message);
    } else {
      console.log('✅ users table data:', usersData.length, 'records');
      usersData.forEach(record => {
        console.log(`   - User: ${record.name} (${record.email}) - Public ID: ${record.id}, Auth ID: ${record.auth_user_id}`);
      });
    }

    // 4. Check leads table and admin-created leads
    console.log('\n4. Checking leads table...');
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, user_id, assigned_to')
      .limit(10);
    
    if (leadsError) {
      console.error('❌ leads table error:', leadsError.message);
    } else {
      console.log('✅ leads table data:', leadsData.length, 'records');
      leadsData.forEach(record => {
        console.log(`   - Lead: ${record.name}, Created by: ${record.user_id}, Assigned to: ${record.assigned_to}`);
      });
    }

    // 5. Test email to UUID conversion
    console.log('\n5. Testing email to UUID conversion...');
    const testEmail = 'fomija9646@coursora.com';
    
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          action: 'GET_AVAILABLE_USERS'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const targetUser = data.users?.find(u => u.email === testEmail);
        if (targetUser) {
          console.log(`✅ Found user ${testEmail} with UUID: ${targetUser.id}`);
        } else {
          console.log(`❌ User ${testEmail} not found in available users`);
        }
      } else {
        console.error('❌ Failed to fetch available users:', response.status);
      }
    } catch (fetchError) {
      console.error('❌ Error testing email conversion:', fetchError.message);
    }

  } catch (error) {
    console.error('❌ Debug script error:', error.message);
  }
}

// Run the debug
debugAccessIssues().then(() => {
  console.log('\n🔍 Debug complete!');
}).catch(error => {
  console.error('Debug script failed:', error);
});
