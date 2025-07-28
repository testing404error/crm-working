import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function setupAssigneeRelationships() {
  try {
    console.log('=== Setting up Assignee Relationships ===\n');
    
    // Retrieve the assignee user's ID
    const { data: assigneeUser, error: assigneeError } = await supabase
      .from('assignee_users')
      .select('*')
      .eq('email', 'yaravij907@kissgy.com')
      .single();
    
    if (assigneeError) {
      console.error('Error fetching assignee user:', assigneeError.message);
      return;
    }

    const assigneeId = assigneeUser.id;

    // Retrieve admin user ID (use existing user for demonstration)
    const { data: adminUser, error: adminError } = await supabase.auth.getUser();
    
    if (adminError || !adminUser) {
      console.error('Admin user not found or not logged in');
      return;
    }
    
    const adminUserId = adminUser.id;
    
    // Create assignee relationship
    const { data: relationship, error: relationshipError } = await supabase
      .from('assignee_relationships')
      .insert([{
        user_id: adminUserId,
        assignee_id: assigneeId,
        created_by: adminUserId
      }])
      .select()
      .single();
    
    if (relationshipError) {
      console.error('Error creating assignee relationship:', relationshipError.message);
    } else {
      console.log('✓ Created assignee relationship');
    }

    // Create access request
    const { data: accessRequest, error: requestError } = await supabase
      .from('pending_access_requests')
      .insert([{
        requester_id: assigneeId,
        receiver_id: adminUserId,
        status: 'accepted'
      }])
      .select()
      .single();
    
    if (requestError) {
      console.error('Error creating access request:', requestError.message);
    } else {
      console.log('✓ Created accepted access request');
    }
    
    console.log('=== Setup Complete! ===');
    console.log(`Assignee yaravij907@kissgy.com should now have access`);
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

setupAssigneeRelationships();
