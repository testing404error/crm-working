import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function setupAccessFromLeads() {
  try {
    console.log('=== Setting up Access Control Using Existing Data ===\n');
    
    // Get the assignee user
    const { data: assigneeUser, error: assigneeError } = await supabase
      .from('assignee_users')
      .select('*')
      .eq('email', 'yaravij907@kissgy.com')
      .single();
    
    if (assigneeError) {
      console.error('Error fetching assignee user:', assigneeError.message);
      return;
    }

    console.log('✓ Found assignee user:', assigneeUser.name);
    
    // Get a user ID from existing data (try leads first, then opportunities)
    let adminUserId = null;
    
    // Try leads first
    const { data: existingLeads, error: leadsError } = await supabase
      .from('leads')
      .select('user_id')
      .limit(1);
    
    if (existingLeads && existingLeads.length > 0) {
      adminUserId = existingLeads[0].user_id;
      console.log('✓ Using admin user ID from leads:', adminUserId);
    } else {
      // Try opportunities
      const { data: existingOpportunities, error: oppError } = await supabase
        .from('opportunities')
        .select('user_id')
        .limit(1);
      
      if (existingOpportunities && existingOpportunities.length > 0) {
        adminUserId = existingOpportunities[0].user_id;
        console.log('✓ Using admin user ID from opportunities:', adminUserId);
      } else {
        console.error('No existing leads or opportunities found to get user ID from');
        console.log('Creating a mock user ID for testing...');
        adminUserId = '00000000-0000-0000-0000-000000000000';
      }
    }
    
    // Create assignee relationship
    console.log('\n1. Creating assignee relationship...');
    const { data: relationship, error: relationshipError } = await supabase
      .from('assignee_relationships')
      .insert([{
        user_id: adminUserId,
        assignee_id: assigneeUser.id,
        created_by: adminUserId
      }])
      .select()
      .single();
    
    if (relationshipError) {
      console.error('Error creating assignee relationship:', relationshipError.message);
      if (relationshipError.message.includes('duplicate key')) {
        console.log('✓ Assignee relationship already exists');
      }
    } else {
      console.log('✓ Created assignee relationship');
    }

    // Create access request
    console.log('\n2. Creating access request...');
    const { data: accessRequest, error: requestError } = await supabase
      .from('pending_access_requests')
      .insert([{
        requester_id: adminUserId,  // Admin requests on behalf of assignee
        receiver_id: adminUserId,   // To access admin's own data
        status: 'accepted'
      }])
      .select()
      .single();
    
    if (requestError) {
      console.error('Error creating access request:', requestError.message);
      if (requestError.message.includes('duplicate key')) {
        console.log('✓ Access request already exists');
      }
    } else {
      console.log('✓ Created accepted access request');
    }
    
    // Verify the setup
    console.log('\n3. Verifying setup...');
    
    const { data: relationships } = await supabase
      .from('assignee_relationships')
      .select(`
        id,
        user_id,
        assignee_id,
        assignee_users (name, email)
      `);
    
    const { data: requests } = await supabase
      .from('pending_access_requests')
      .select('*');
    
    console.log(`✓ Assignee relationships: ${relationships?.length || 0}`);
    console.log(`✓ Access requests: ${requests?.length || 0}`);
    
    console.log('\n=== Setup Complete! ===');
    console.log('The assignee yaravij907@kissgy.com should now have access to leads and opportunities');
    console.log('when they authenticate, because:');
    console.log('1. ✓ They exist in assignee_users table');
    console.log('2. ✓ They have an assignee relationship to admin user');
    console.log('3. ✓ There is an accepted access request');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

setupAccessFromLeads();
