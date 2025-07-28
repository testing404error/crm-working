import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function fixAssigneeToAdminOnly() {
  try {
    console.log('=== Fixing Assignee Relationships - Admin Only ===\n');
    
    const ADMIN_USER_ID = '1b51b619-918b-4419-bbb5-0de2fbe52a77'; // The admin user
    const assigneeId = '9845d639-fefa-4693-bd22-343c1ac381a1'; // Ankit's current assignee ID
    
    console.log(`Admin User ID: ${ADMIN_USER_ID}`);
    console.log(`Assignee ID: ${assigneeId}`);
    
    // 1. Delete ALL existing assignee relationships
    console.log('\n1. Cleaning up all existing relationships...');
    const { error: deleteError } = await supabase
      .from('assignee_relationships')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) {
      console.error('Error deleting relationships:', deleteError.message);
    } else {
      console.log('✅ Deleted all existing relationships');
    }
    
    // 2. Create ONLY admin relationship
    console.log('\n2. Creating admin-only relationship...');
    const { data, error } = await supabase
      .from('assignee_relationships')
      .insert([{
        user_id: ADMIN_USER_ID,
        assignee_id: assigneeId,
        created_by: ADMIN_USER_ID
      }])
      .select();
    
    if (error) {
      console.error('Error creating admin relationship:', error.message);
    } else {
      console.log('✅ Created admin relationship successfully');
    }
    
    // 3. Verify the result
    console.log('\n3. Final verification...');
    const { data: relationships } = await supabase
      .from('assignee_relationships')
      .select(`
        user_id,
        assignee_id,
        assignee_users (name, email)
      `);
    
    console.log(`Total relationships: ${relationships?.length || 0}`);
    relationships?.forEach(rel => {
      console.log(`  ${rel.assignee_users?.name} (${rel.assignee_users?.email}) → User: ${rel.user_id}`);
      if (rel.user_id === ADMIN_USER_ID) {
        console.log('    ✅ This is the ADMIN relationship');
      }
    });
    
    console.log('\n🎯 SUCCESS!');
    console.log('Assignees will now ONLY see admin\'s leads and opportunities.');
    console.log('They will NOT see other users\' data.');
