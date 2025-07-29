import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qgoqrozkqckgvdopbllg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAssigneeIssue() {
  console.log('🔍 Debugging Assignee Feature...\n');

  try {
    // 1. Check access_control table structure
    console.log('1. Checking access_control table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('access_control')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('❌ access_control table not found or error:', tableError);
      return;
    }
    console.log('✅ access_control table exists');

    // 2. Check if there are any access_control records
    console.log('\n2. Checking existing access_control records...');
    const { data: allGrants, error: grantsError } = await supabase
      .from('access_control')
      .select('*');
    
    if (grantsError) {
      console.error('❌ Error fetching grants:', grantsError);
    } else {
      console.log(`✅ Found ${allGrants?.length || 0} access control grants:`);
      if (allGrants && allGrants.length > 0) {
        allGrants.forEach((grant, index) => {
          console.log(`   Grant ${index + 1}: user_id=${grant.user_id}, granted_to_user_id=${grant.granted_to_user_id}`);
        });
      }
    }

    // 3. Check users table and their roles
    console.log('\n3. Checking users table and roles...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, auth_user_id, email, role');
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
    } else {
      console.log(`✅ Found ${users?.length || 0} users:`);
      if (users && users.length > 0) {
        users.forEach((user, index) => {
          console.log(`   User ${index + 1}: id=${user.id}, email=${user.email}, role=${user.role}`);
        });
      }
    }

    // 4. Test the foreign key relationship
    console.log('\n4. Testing foreign key relationship...');
    const { data: joinTest, error: joinError } = await supabase
      .from('access_control')
      .select(`
        user_id,
        granted_to_user_id,
        users!access_control_user_id_fkey(id, email, role)
      `);
    
    if (joinError) {
      console.error('❌ Foreign key join error:', joinError);
    } else {
      console.log('✅ Foreign key join test successful');
      if (joinTest && joinTest.length > 0) {
        joinTest.forEach((item, index) => {
          console.log(`   Join ${index + 1}: user_id=${item.user_id}, grantor=${JSON.stringify(item.users)}`);
        });
      }
    }

    // 5. Test the specific query used in accessControlService
    console.log('\n5. Testing specific query from accessControlService...');
    
    // First, get current user to test with
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      console.log('❌ No authenticated user found');
      return;
    }

    // Get current user's database ID
    const { data: currentDbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', currentUser.id)
      .single();
    
    if (!currentDbUser) {
      console.log('❌ Current user not found in database');
      return;
    }

    console.log(`Current user DB ID: ${currentDbUser.id}`);

    // Test the exact query from accessControlService
    const { data: accessGrants, error: accessError } = await supabase
      .from('access_control')
      .select(`
        user_id,
        users!access_control_user_id_fkey(auth_user_id, role)
      `)
      .eq('granted_to_user_id', currentDbUser.id);
    
    if (accessError) {
      console.error('❌ Access grants query error:', accessError);
    } else {
      console.log(`✅ Access grants query successful - found ${accessGrants?.length || 0} grants`);
      if (accessGrants && accessGrants.length > 0) {
        accessGrants.forEach((grant, index) => {
          console.log(`   Grant ${index + 1}: user_id=${grant.user_id}, grantor_info=${JSON.stringify(grant.users)}`);
          
          // Check if grantor is admin
          const grantorUser = grant.users;
          if (grantorUser?.role === 'admin') {
            console.log(`   ✅ This grant is from an admin - should provide access to user ${grant.user_id}`);
          } else {
            console.log(`   ❌ This grant is NOT from an admin (role: ${grantorUser?.role})`);
          }
        });
      } else {
        console.log('   No grants found for current user');
      }
    }

    console.log('\n🎯 Debug Summary:');
    console.log('- Check if access_control records exist');
    console.log('- Verify foreign key relationships work');
    console.log('- Ensure the grantor users have admin role');
    console.log('- Confirm the query returns expected results');

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

debugAssigneeIssue();
