import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function testAccessControl() {
  try {
    console.log('=== Testing Access Control Functionality ===\n');
    
    // Test getting assignee users
    console.log('1. Testing assignee_users table:');
    const { data: assigneeUsers, error: assigneeUsersError } = await supabase
      .from('assignee_users')
      .select('*');
    
    if (assigneeUsersError) {
      console.error('Error:', assigneeUsersError.message);
    } else {
      console.log('✓ Assignee users:', assigneeUsers.length, 'records');
      if (assigneeUsers.length > 0) {
        console.log('  Sample:', assigneeUsers[0]);
      }
    }
    
    // Test getting assignee relationships
    console.log('\n2. Testing assignee_relationships table:');
    const { data: relationships, error: relationshipsError } = await supabase
      .from('assignee_relationships')
      .select('*');
    
    if (relationshipsError) {
      console.error('Error:', relationshipsError.message);
    } else {
      console.log('✓ Assignee relationships:', relationships.length, 'records');
      if (relationships.length > 0) {
        console.log('  Sample:', relationships[0]);
      }
    }
    
    // Test getting pending access requests
    console.log('\n3. Testing pending_access_requests table:');
    const { data: requests, error: requestsError } = await supabase
      .from('pending_access_requests')
      .select('*');
    
    if (requestsError) {
      console.error('Error:', requestsError.message);
    } else {
      console.log('✓ Pending access requests:', requests.length, 'records');
      if (requests.length > 0) {
        console.log('  Sample:', requests[0]);
      }
    }
    
    // Test creating a sample access request (if we can authenticate)
    console.log('\n4. Testing access control logic (simulated):');
    console.log('The access control logic requires:');
    console.log('  - User has accepted access requests (receiver_id in pending_access_requests)');
    console.log('  - User is assigned as assignee (assignee_id in assignee_relationships)');
    console.log('  - Both conditions must be met for data access');
    
    // Show current structure
    console.log('\n5. Current table structures:');
    console.log('pending_access_requests: requester_id, receiver_id, status');
    console.log('assignee_relationships: user_id, assignee_id');
    console.log('assignee_users: id, name, email');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testAccessControl();
