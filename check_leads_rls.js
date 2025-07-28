import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
// Initialize Supabase client with service role key to bypass RLS
const supabase = createClient(
  'https://spiqmafocyspuhcbpqhx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwaXFtYWZvY3lzcHVoY2JwcWh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDMwNzAwMCwiZXhwIjoyMDQ5ODgzMDAwfQ.2uTLnGJq2q8A8bWFGHJDLjqv8TLqCMbgNTHi6ycF4YQ' // service role key
);

async function checkLeadsRLS() {
  console.log('Checking RLS policies on leads table...\n');
  
  try {
    // Query to get all RLS policies for leads table
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'leads');
    
    if (error) {
      console.error('Error fetching policies:', error);
      return;
    }
    
    console.log('Current RLS policies on leads table:');
    if (policies && policies.length > 0) {
      policies.forEach(policy => {
        console.log(`\nPolicy: ${policy.policyname}`);
        console.log(`  Command: ${policy.cmd}`);
        console.log(`  Permissive: ${policy.permissive}`);
        console.log(`  Roles: ${policy.roles}`);
        console.log(`  Qual: ${policy.qual}`);
        console.log(`  With Check: ${policy.with_check}`);
      });
    } else {
      console.log('No RLS policies found for leads table');
    }
    
    // Also check if RLS is enabled on the table
    const { data: tableInfo, error: tableError } = await supabase.rpc('check_table_rls', {
      table_name: 'leads'
    });
    
    if (tableError) {
      console.log('\nChecking RLS status directly...');
      // Try alternative method
      const { data: rlsCheck, error: rlsError } = await supabase
        .from('information_schema.tables')
        .select('*')
        .eq('table_name', 'leads')
        .eq('table_schema', 'public');
        
      console.log('Table info:', rlsCheck);
    }
    
  } catch (err) {
    console.error('Script error:', err);
  }
}

checkLeadsRLS();
