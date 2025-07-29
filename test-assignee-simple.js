import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qgoqrozkqckgvdopbllg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAssigneeSystem() {
  console.log('🔍 Testing Assignee System...\n');

  try {
    // 1. Check if access_control table exists
    console.log('1. Testing access_control table...');
    try {
      const { data: acData, error: acError } = await supabase
        .from('access_control')
        .select('count(*)')
        .limit(1);
      
      if (acError) {
        console.log('❌ access_control table issue:', acError.message);
        console.log('   This explains why assignee feature is not working!\n');
      } else {
        console.log('✅ access_control table accessible\n');
      }
    } catch (error) {
      console.log('❌ access_control table error:', error.message);
    }

    // 2. Test accessControlService logic without the table
    console.log('2. Testing current user access...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('❌ No authenticated user');
      return;
    }
    
    console.log(`✅ Current user: ${user.email}`);
    console.log(`   Role: ${user.user_metadata?.role || 'user'}`);
    console.log(`   Is admin: ${user.user_metadata?.role === 'admin'}`);

    // 3. Check current user in database
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();
    
    if (dbUser) {
      console.log(`✅ Database user ID: ${dbUser.id}`);
      console.log(`   Database role: ${dbUser.role}\n`);
    } else {
      console.log('❌ User not found in database\n');
    }

    // 4. Test what happens when assignee feature is used
    console.log('3. Simulating assignee access check...');
    
    // This is what accessControlService.getAccessibleUserIds does
    let accessibleUserIds = [];
    
    // Always include own data
    if (dbUser) {
      accessibleUserIds.push(dbUser.id);
      console.log(`✅ Own access: ${dbUser.id}`);
    }
    
    // Check if admin (should get all users)
    const isAdmin = user.user_metadata?.role === 'admin';
    if (isAdmin) {
      console.log('✅ Admin detected - should get access to ALL users');
      const { data: allUsers } = await supabase
        .from('users')
        .select('id');
      
      if (allUsers) {
        accessibleUserIds.push(...allUsers.map(u => u.id));
        console.log(`✅ Admin access granted to ${allUsers.length} users`);
      }
    } else {
      console.log('❌ Not an admin - only own data accessible');
      console.log('   Assignee grants would come from access_control table (which has issues)');
    }

    // 5. Show the problem
    console.log('\n🎯 THE PROBLEM:');
    console.log('   - access_control table is not properly accessible');
    console.log('   - This means assignee grants cannot be checked');
    console.log('   - Non-admin users only see their own data');
    console.log('   - Assignee feature appears broken');

    console.log('\n🔧 SOLUTION NEEDED:');
    console.log('   - Fix access_control table permissions');
    console.log('   - Or implement alternative assignee logic');
    console.log('   - Or use different table structure');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testAssigneeSystem();
