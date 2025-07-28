import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function fixAssigneeAdmin() {
  try {
    console.log('=== Fixing Assignee - Admin Only Access ===\n');
    
    const ADMIN_USER_ID = '1b51b619-918b-4419-bbb5-0de2fbe52a77';
    const assigneeId = '58ffc001-8507-4416-8ee7-3f1cb2c82cbc';
    
    console.log(`Admin User: ${ADMIN_USER_ID}`);
    console.log(`Assignee: ${assigneeId}`);
    
    // Clear all relationships
    console.log('\n1. Clearing all relationships...');
    const { error: deleteError } = await supabase
      .from('assignee_relationships')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      console.error('Delete error:', deleteError.message);
    } else {
      console.log('✅ Cleared relationships');
    }
    
    // Create admin-only relationship
    console.log('\n2. Creating admin relationship...');
    const { data, error } = await supabase
      .from('assignee_relationships')
      .insert([{
        user_id: ADMIN_USER_ID,
        assignee_id: assigneeId
      }])
      .select();
    
    if (error) {
      console.error('Insert error:', error.message);
    } else {
      console.log('✅ Created admin relationship');
    }
    
    // Verify
    console.log('\n3. Verification...');
    const { data: relationships } = await supabase
      .from('assignee_relationships')
      .select(`
        user_id,
        assignee_users (name, email)
      `);
    
    console.log(`Total: ${relationships?.length || 0}`);
    relationships?.forEach(rel => {
      const isAdmin = rel.user_id === ADMIN_USER_ID;
      console.log(`  ${rel.assignee_users?.name} → ${rel.user_id} ${isAdmin ? '(ADMIN)' : ''}`);
    });
    
    console.log('\n🎯 DONE! Assignees now only see admin data.');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

fixAssigneeAdmin();
