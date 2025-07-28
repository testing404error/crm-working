import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function createSampleData() {
  try {
    console.log('=== Creating Sample Data ===\n');
    
    // 1. Create assignee users (these would be the assignees available in the system)
    console.log('1. Creating assignee users...');
    const assigneeUsers = [
      { name: 'John Doe', email: 'john.doe@example.com' },
      { name: 'Jane Smith', email: 'jane.smith@example.com' },
      { name: 'Bob Johnson', email: 'bob.johnson@example.com' }
    ];
    
    const { data: createdAssignees, error: assigneeError } = await supabase
      .from('assignee_users')
      .insert(assigneeUsers)
      .select();
    
    if (assigneeError) {
      console.error('Error creating assignee users:', assigneeError.message);
      return;
    }
    
    console.log('✓ Created', createdAssignees.length, 'assignee users');
    console.log('  Assignees:', createdAssignees.map(a => a.name).join(', '));
    
    // Now we would need actual user IDs from auth.users to create relationships and access requests
    // For demonstration, let's show what the data structure would look like
    
    console.log('\n2. To complete the access control setup, you would need to:');
    console.log('   a) Have actual authenticated users in the system');
    console.log('   b) Create assignee relationships (user_id -> assignee_id)');
    console.log('   c) Create access requests (requester_id -> receiver_id)');
    
    console.log('\n3. Example workflow:');
    console.log('   - Admin assigns John Doe as assignee for User A');
    console.log('   - Admin sends access request from John Doe to User A');
    console.log('   - User A accepts the access request');
    console.log('   - Now John Doe can see User A\'s leads and opportunities');
    
    console.log('\n4. Current assignee users in system:');
    createdAssignees.forEach((assignee, index) => {
      console.log(`   ${index + 1}. ${assignee.name} (${assignee.email}) - ID: ${assignee.id}`);
    });
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

createSampleData();
