import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function debugAccessControl() {
  try {
    console.log('=== DEBUG: Current Access Control State ===\n');
    
    // 1. Check assignee_users
    console.log('1. Assignee Users:');
    const { data: assigneeUsers, error: assigneeError } = await supabase
      .from('assignee_users')
      .select('*');
    
    if (assigneeError) {
      console.error('Error:', assigneeError.message);
    } else {
      console.log(`Found ${assigneeUsers.length} assignee users:`);
      assigneeUsers.forEach(user => {
        console.log(`  - ${user.name} (${user.email}) - ID: ${user.id}`);
      });
    }
    
    // 2. Check assignee_relationships  
    console.log('\n2. Assignee Relationships:');
    const { data: relationships, error: relError } = await supabase
      .from('assignee_relationships')
      .select(`
        id,
        user_id,
        assignee_id,
        created_at,
        assignee_users (name, email)
      `);
    
    if (relError) {
      console.error('Error:', relError.message);
    } else {
      console.log(`Found ${relationships.length} assignee relationships:`);
      relationships.forEach(rel => {
        console.log(`  - User ${rel.user_id} assigned to ${rel.assignee_users?.name} (${rel.assignee_users?.email})`);
      });
    }
    
    // 3. Check pending_access_requests
    console.log('\n3. Access Requests:');
    const { data: requests, error: requestError } = await supabase
      .from('pending_access_requests')
      .select('*');
    
    if (requestError) {
      console.error('Error:', requestError.message);
    } else {
      console.log(`Found ${requests.length} access requests:`);
      requests.forEach(req => {
        console.log(`  - Requester: ${req.requester_id}, Receiver: ${req.receiver_id}, Status: ${req.status}`);
      });
    }
    
    // 4. Check current authenticated users (if any)
    console.log('\n4. Getting current auth state...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('No authenticated user found (using anon key)');
    } else {
      console.log(`Current user: ${user.email} (ID: ${user.id})`);
    }
    
    console.log('\n=== DIAGNOSIS ===');
    console.log('For access control to work, we need:');
    console.log('1. ✓ Assignee users exist in assignee_users table');
    console.log('2. ❓ Assignee relationships linking users to assignees');
    console.log('3. ❓ Accepted access requests between users');
    console.log('\nIssue: The assignee yaravij907@kissgy.com exists but:');
    console.log('- No assignee relationships are configured');
    console.log('- No access requests are set up');
    console.log('\nThis means the access control logic has nothing to grant access to.');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

debugAccessControl();
