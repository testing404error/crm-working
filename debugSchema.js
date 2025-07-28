import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Eyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function debugSchema() {
  console.log('=== Database Schema Debug ===\n');
  
  const tables = ['leads', 'opportunities', 'assignee_users', 'assignee_relationships', 'user_permissions'];
  
  for (const table of tables) {
    try {
      console.log(`Checking table: ${table}`);
      const { data, error } = await supabase.from(table).select('*').limit(1);
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: exists (${data?.length || 0} records found)`);
        if (data && data.length > 0) {
          console.log(`   Sample columns: ${Object.keys(data[0]).join(', ')}`);
        }
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
    }
    console.log('');
  }
  
  // Also check auth users
  try {
    console.log('Checking auth users...');
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.log(`❌ auth.users: ${error.message}`);
    } else {
      console.log(`✅ auth.users: ${users.users.length} users found`);
      users.users.forEach(user => {
        console.log(`   - ${user.email} (${user.id})`);
      });
    }
  } catch (err) {
    console.log(`❌ auth.users: ${err.message}`);
  }
}

debugSchema();
