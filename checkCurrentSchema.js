import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qgoqrozkqckgvdopbllg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTYxMjA4OCwiZXhwIjoyMDY3MTg4MDg4fQ.-wohIGKgFu6gX-36CTsin_pDDmg6AbM7H_rQKeLZXOg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking database schema...\n');

  try {
    // Check what tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) {
      console.log('Cannot query information_schema.tables:', tablesError.message);
    } else {
      console.log('Public tables:', tables?.map(t => t.table_name) || []);
    }

    // Check auth.users
    console.log('\n--- Checking auth.users ---');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.log('Error fetching users:', usersError.message);
    } else {
      console.log('Users found:', users.users.length);
      users.users.forEach(user => {
        console.log(`- ${user.email} (ID: ${user.id})`);
        console.log(`  Metadata:`, user.user_metadata || {});
        console.log(`  App metadata:`, user.app_metadata || {});
      });
    }

    // Try to check each expected table
    const expectedTables = ['leads', 'opportunities', 'assignee_users', 'assignee_relationships', 'user_permissions'];
    
    for (const table of expectedTables) {
      console.log(`\n--- Checking ${table} table ---`);
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(5);
      
      if (error) {
        console.log(`${table} table error:`, error.message);
      } else {
        console.log(`${table} table exists with ${data?.length || 0} rows`);
        if (data && data.length > 0) {
          console.log('Sample data:', data[0]);
        }
      }
    }

  } catch (error) {
    console.error('General error:', error);
  }
}

checkSchema();
