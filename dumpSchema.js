import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function dumpSchema() {
  try {
    // Query tables using RPC or direct SQL
    const { data, error } = await supabase.rpc('get_table_names');
    
    if (error) {
      console.error('Error with RPC, trying direct query:', error);
      
      // Fallback: Try to query known tables directly
      const tables = ['leads', 'opportunities', 'communications', 'pending_access_requests', 'assignee_users', 'assignee_relationships', 'profiles'];
      
      console.log('Checking known tables:');
      for (const table of tables) {
        try {
          const { data: tableData, error: tableError } = await supabase
            .from(table)
            .select('*')
            .limit(1);
          
          if (!tableError) {
            console.log(`✓ ${table} (exists)`);
            if (tableData && tableData.length > 0) {
              console.log(`  Sample columns: ${Object.keys(tableData[0]).join(', ')}`);
            }
          } else {
            console.log(`✗ ${table} (${tableError.message})`);
          }
        } catch (e) {
          console.log(`✗ ${table} (error: ${e.message})`);
        }
      }
      
      // Let's also check specific tables we care about
      console.log('\n=== DETAILED SCHEMA ANALYSIS ===');
      
      // Check assignee_users table structure
      console.log('\nAssignee Users table:');
      try {
        const { data: assigneesData, error: assigneesError } = await supabase
          .from('assignee_users')
          .select('*')
          .limit(5);
        
        if (!assigneesError && assigneesData) {
          console.log('Structure:', assigneesData.length > 0 ? Object.keys(assigneesData[0]) : 'Empty table');
          console.log('Sample data:', JSON.stringify(assigneesData, null, 2));
        } else {
          console.log('Error:', assigneesError?.message);
        }
      } catch (e) {
        console.log('Error:', e.message);
      }
      
      // Check assignee_relationships table structure
      console.log('\nAssignee Relationships table:');
      try {
        const { data: relationshipsData, error: relationshipsError } = await supabase
          .from('assignee_relationships')
          .select('*')
          .limit(5);
        
        if (!relationshipsError && relationshipsData) {
          console.log('Structure:', relationshipsData.length > 0 ? Object.keys(relationshipsData[0]) : 'Empty table');
          console.log('Sample data:', JSON.stringify(relationshipsData, null, 2));
        } else {
          console.log('Error:', relationshipsError?.message);
        }
      } catch (e) {
        console.log('Error:', e.message);
      }
      
      // Check pending_access_requests table structure
      console.log('\nPending Access Requests table:');
      try {
        const { data: requestsData, error: requestsError } = await supabase
          .from('pending_access_requests')
          .select('*')
          .limit(5);
        
        if (!requestsError && requestsData) {
          console.log('Structure:', requestsData.length > 0 ? Object.keys(requestsData[0]) : 'Empty table');
          console.log('Sample data:', JSON.stringify(requestsData, null, 2));
        } else {
          console.log('Error:', requestsError?.message);
        }
      } catch (e) {
        console.log('Error:', e.message);
      }
      return;
    }

    console.log('Tables in schema:');
    data.forEach((table) => console.log(table.table_name));

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

dumpSchema();
