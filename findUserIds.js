import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function findUserIds() {
  try {
    console.log('=== Finding Real User IDs ===\n');
    
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('user_id, name')
      .limit(10);
    
    if (leadsError) {
      console.error('Error fetching leads:', leadsError.message);
    } else {
      console.log(`Found ${leads?.length || 0} leads:`);
      leads?.forEach(lead => console.log(`  Lead: ${lead.name}, UserId: ${lead.user_id}`));
    }

    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('user_id, name')
      .limit(10);
    
    if (oppError) {
      console.error('Error fetching opportunities:', oppError.message);
    } else {
      console.log(`\nFound ${opportunities?.length || 0} opportunities:`);
      opportunities?.forEach(opportunity => console.log(`  Opportunity: ${opportunity.name}, UserId: ${opportunity.user_id}`));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

findUserIds();
