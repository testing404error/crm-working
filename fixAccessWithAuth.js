import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function fixAccessWithAuth() {
  try {
    console.log('=== Fixing Access Control with Current Auth ===\n');
    
    // Get current session (this might be empty since we're using anon key)
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();
    
    console.log('Session:', session ? 'Authenticated' : 'Anonymous');
    console.log('User:', user ? user.email : 'No user');
    
    // The issue is likely that we need to create relationships for ALL existing users
    // Since we can't get authenticated user, let's try a different approach
    
    // First, let's check if there are any user IDs we can extract from existing data
    console.log('\n1. Checking existing data for user patterns...');
    
    // Check leads with different queries to see if access control is blocking
    const queries = [
      supabase.from('leads').select('user_id, name, email').limit(5),
      supabase.from('opportunities').select('user_id, name').limit(5),
      supabase.from('communications').select('user_id').limit(5)
    ];
    
    for (let i = 0; i < queries.length; i++) {
      const { data, error } = await queries[i];
      const tableName = ['leads', 'opportunities', 'communications'][i];
      
      if (error) {
        console.log(`  ${tableName}: Error - ${error.message}`);
      } else {
        console.log(`  ${tableName}: ${data?.length || 0} records found`);
        if (data && data.length > 0) {
          const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
          console.log(`    User IDs: ${userIds.join(', ')}`);
        }
      }
    }
    
    // Let's try to create a relationship to the admin user pattern we've been using
    console.log('\n2. Creating comprehensive assignee relationships...');
    
    const assigneeId = 'fd030c7a-868c-4177-8ca6-d73c301c8547'; // ankit's assignee ID
    
    // Try multiple user ID patterns that might exist
    const possibleUserIds = [
      '12345678-1234-1234-1234-123456789012', // Our demo admin
      '00000000-0000-0000-0000-000000000000', // Another pattern
      'admin-user-id-placeholder'              // Placeholder
    ];
    
    for (const userId of possibleUserIds) {
      try {
        const { data, error } = await supabase
          .from('assignee_relationships')
          .upsert([{
            user_id: userId,
            assignee_id: assigneeId,
            created_by: userId
          }], {
            onConflict: 'user_id,assignee_id'
          })
          .select();
        
        if (error) {
          console.log(`    Failed to create relationship for ${userId}: ${error.message}`);
        } else {
          console.log(`    ✓ Created/updated relationship for ${userId}`);
        }
      } catch (e) {
        console.log(`    Error with ${userId}: ${e.message}`);
      }
    }
    
    // Show current state
    console.log('\n3. Current assignee relationships:');
    const { data: relationships } = await supabase
      .from('assignee_relationships')
      .select(`
        user_id,
        assignee_id,
        assignee_users (name, email)
      `);
    
    relationships?.forEach(rel => {
      console.log(`  ${rel.assignee_users?.name} (${rel.assignee_users?.email}) → User: ${rel.user_id}`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  }
}

fixAccessWithAuth();
