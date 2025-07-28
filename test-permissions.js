import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function testPermissionsSetup() {
  try {
    console.log('=== Testing User Permissions Setup ===\n');
    
    // Test 1: Check if user_permissions table exists
    console.log('1. Testing user_permissions table...');
    const { data: permissionsTest, error: permissionsError } = await supabase
      .from('user_permissions')
      .select('*')
      .limit(1);
    
    if (permissionsError) {
      console.log('❌ user_permissions table error:', permissionsError.message);
    } else {
      console.log('✅ user_permissions table exists');
      console.log('   Sample data:', permissionsTest);
    }
    
    // Test 2: Test API endpoint for getUsersWithPermissions
    console.log('\n2. Testing getUsersWithPermissions API...');
    const { data: apiResponse, error: apiError } = await supabase.functions.invoke('api', {
      body: { action: 'GET_USERS_WITH_PERMISSIONS' }
    });
    
    if (apiError) {
      console.log('❌ API error:', apiError.message);
    } else {
      console.log('✅ API response:', apiResponse);
    }
    
    // Test 3: Check current user context
    console.log('\n3. Testing current user context...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ User not authenticated:', userError?.message || 'No user');
    } else {
      console.log('✅ Current user:', user.email);
      console.log('   User role:', user.user_metadata?.role || 'No role set');
      console.log('   User ID:', user.id);
    }
    
    // Test 4: Check assignee_users table
    console.log('\n4. Testing assignee_users table...');
    const { data: assigneeUsers, error: assigneeError } = await supabase
      .from('assignee_users')
      .select('*');
    
    if (assigneeError) {
      console.log('❌ assignee_users error:', assigneeError.message);
    } else {
      console.log('✅ assignee_users data:', assigneeUsers);
    }
    
    // Test 5: Check pending_access_requests table
    console.log('\n5. Testing pending_access_requests table...');
    const { data: accessRequests, error: requestsError } = await supabase
      .from('pending_access_requests')
      .select('*')
      .eq('status', 'accepted');
    
    if (requestsError) {
      console.log('❌ pending_access_requests error:', requestsError.message);
    } else {
      console.log('✅ accepted access requests:', accessRequests);
    }
    
    // Test 6: Test the new API directly
    console.log('\n6. Testing raw API call...');
    try {
      const response = await fetch('https://qgoqrozkqckgvdopbllg.supabase.co/functions/v1/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`
        },
        body: JSON.stringify({
          action: 'GET_USERS_WITH_PERMISSIONS'
        })
      });
      
      const rawResult = await response.json();
      console.log('✅ Raw API response:', rawResult);
    } catch (fetchError) {
      console.log('❌ Raw fetch error:', fetchError.message);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testPermissionsSetup();
