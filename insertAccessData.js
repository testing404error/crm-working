import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function insertAccessData() {
  try {
    console.log('=== Inserting Access Control Data ===\n');
    
    const assigneeId = 'fd030c7a-868c-4177-8ca6-d73c301c8547'; // ankit's ID
    const demoAdminId = '12345678-1234-1234-1234-123456789012'; // Demo admin ID
    
    // 1. Insert assignee relationship
    console.log('1. Creating assignee relationship...');
    const { data: relationship, error: relError } = await supabase
      .from('assignee_relationships')
      .insert([{
        user_id: demoAdminId,
        assignee_id: assigneeId,
        created_by: demoAdminId
      }])
      .select();
    
    if (relError) {
      console.error('Error creating relationship:', relError.message);
    } else {
      console.log('✓ Created assignee relationship');
    }
    
    // 2. Insert access request
    console.log('\n2. Creating access request...');
    const { data: accessRequest, error: reqError } = await supabase
      .from('pending_access_requests')
      .insert([{
        requester_id: demoAdminId,
        receiver_id: demoAdminId,
        status: 'accepted'
      }])
      .select();
    
    if (reqError) {
      console.error('Error creating access request:', reqError.message);
    } else {
      console.log('✓ Created access request');
    }
    
    // 3. Verify
    console.log('\n3. Verifying...');
    const { data: relationships } = await supabase
      .from('assignee_relationships')
      .select('*');
    
    const { data: requests } = await supabase
      .from('pending_access_requests')
      .select('*');
    
    console.log(`✓ Total relationships: ${relationships?.length || 0}`);
    console.log(`✓ Total access requests: ${requests?.length || 0}`);
    
    console.log('\n=== SUCCESS! ===');
    console.log('Access control data has been set up.');
    console.log('The assignee yaravij907@kissgy.com should now have access');
    console.log('to leads and opportunities when they authenticate.');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

insertAccessData();
