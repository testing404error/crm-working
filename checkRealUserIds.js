import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function checkRealUserIds() {
  try {
    console.log('=== Finding Real User IDs ===\n');
    
    // Check leads for user IDs
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('user_id, name, email')
      .limit(10);
    
    if (leadsError) {
      console.error('Error fetching leads:', leadsError.message);
    } else {
      console.log(`Found ${leads?.length || 0} leads:`);
      const uniqueUserIds = [...new Set(leads?.map(l => l.user_id) || [])];
      uniqueUserIds.forEach(userId => {
        const userLeads = leads?.filter(l => l.user_id === userId) || [];
        console.log(`  User ID: ${userId}`);
        console.log(`    Leads: ${userLeads.map(l => l.name).join(', ')}`);
      });
    }
    
    // Check opportunities for user IDs
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('user_id, name')
      .limit(10);
    
    if (oppError) {
      console.error('Error fetching opportunities:', oppError.message);
    } else {
      console.log(`\nFound ${opportunities?.length || 0} opportunities:`);
      const uniqueUserIds = [...new Set(opportunities?.map(o => o.user_id) || [])];
      uniqueUserIds.forEach(userId => {
        const userOpps = opportunities?.filter(o => o.user_id === userId) || [];
        console.log(`  User ID: ${userId}`);
        console.log(`    Opportunities: ${userOpps.map(o => o.name).join(', ')}`);
      });
    }
    
    // Check current assignee relationships
    console.log('\n=== Current Assignee Relationships ===');
    const { data: relationships, error: relError } = await supabase
      .from('assignee_relationships')
      .select(`
        user_id,
        assignee_id,
        assignee_users (name, email)
      `);
    
    if (relError) {
      console.error('Error fetching relationships:', relError.message);
    } else {
      console.log(`Found ${relationships?.length || 0} relationships:`);
      relationships?.forEach(rel => {
        console.log(`  ${rel.assignee_users?.name} (${rel.assignee_users?.email}) assigned to user: ${rel.user_id}`);
      });
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
}

checkRealUserIds();
