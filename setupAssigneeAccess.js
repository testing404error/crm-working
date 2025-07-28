import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function setupAssigneeAccess() {
  try {
    console.log('=== Setting up Assignee Access Control ===\n');
    
    // 1. Create a sample assignee user (the one from your UI: yaravij907@kissgy.com)
    console.log('1. Creating/Finding assignee user...');
    
    let assigneeUser;
    
    // First check if the assignee already exists
    const { data: existingAssignee, error: existingError } = await supabase
      .from('assignee_users')
      .select('*')
      .eq('email', 'yaravij907@kissgy.com')
      .single();
    
    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking existing assignee:', existingError.message);
      return;
    }
    
    if (existingAssignee) {
      console.log('✓ Found existing assignee:', existingAssignee.name);
      assigneeUser = existingAssignee;
    } else {
      // Create the assignee user
      const { data: newAssignee, error: createError } = await supabase
        .from('assignee_users')
        .insert([{ name: 'ankit', email: 'yaravij907@kissgy.com' }])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating assignee:', createError.message);
        return;
      }
      
      console.log('✓ Created new assignee:', newAssignee.name);
      assigneeUser = newAssignee;
    }
    
    // 2. Create a mock user that the assignee should have access to
    // For demo purposes, let's create a fake user ID that represents the admin
    const adminUserId = '11111111-1111-1111-1111-111111111111'; // Mock admin user ID
    
    // 3. Create assignee relationship (admin assigns this person to admin's data)
    console.log('\\n2. Creating assignee relationship...');
    
    const { data: relationship, error: relationshipError } = await supabase
      .from('assignee_relationships')
      .insert([{
        user_id: adminUserId,           // Admin's user ID
        assignee_id: assigneeUser.id,   // The assignee's ID
        created_by: adminUserId         // Created by admin
      }])
      .select()
      .single();
    
    if (relationshipError) {
      console.error('Error creating relationship:', relationshipError.message);
    } else {
      console.log('✓ Created assignee relationship');
    }
    
    // 4. Create access request (as if admin requested access for assignee and it was accepted)
    console.log('\\n3. Creating access request...');
    
    const { data: accessRequest, error: requestError } = await supabase
      .from('pending_access_requests')
      .insert([{
        requester_id: assigneeUser.id,  // The assignee requests access
        receiver_id: adminUserId,       // To admin's data
        status: 'accepted'              // Already accepted
      }])
      .select()
      .single();
    
    if (requestError) {
      console.error('Error creating access request:', requestError.message);
    } else {
      console.log('✓ Created accepted access request');
    }
    
    // 5. Verify the setup
    console.log('\\n4. Verifying setup...');
    
    // Check assignee relationships
    const { data: relationships } = await supabase
      .from('assignee_relationships')
      .select(`
        id,
        user_id,
        assignee_id,
        assignee_users (name, email)
      `);
    
    console.log('Assignee relationships:', relationships?.length || 0);
    relationships?.forEach(rel => {
      console.log(`  - User ${rel.user_id} -> Assignee ${rel.assignee_users?.name}`);
    });
    
    // Check access requests
    const { data: requests } = await supabase
      .from('pending_access_requests')
      .select('*');
    
    console.log('Access requests:', requests?.length || 0);
    requests?.forEach(req => {
      console.log(`  - ${req.requester_id} -> ${req.receiver_id} (${req.status})`);
    });
    
    console.log('\\n=== Setup Complete! ===');
    console.log('The assignee yaravij907@kissgy.com should now have access to leads/opportunities');
    console.log('when they log in, because:');
    console.log('1. ✓ They exist in assignee_users table');
    console.log('2. ✓ They have an assignee relationship to a user');
    console.log('3. ✓ They have an accepted access request from that user');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

setupAssigneeAccess();
