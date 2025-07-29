import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function inspectDatabase() {
  console.log('🔍 DATABASE INSPECTION\n');
  
  // Check all leads
  console.log('📋 ALL LEADS:');
  const { data: allLeads, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .limit(10);
    
  if (leadsError) {
    console.log('   Error:', leadsError.message);
  } else {
    console.log(`   Total leads found: ${allLeads?.length || 0}`);
    allLeads?.forEach(lead => {
      console.log(`   - ${lead.id}: "${lead.name}" by ${lead.user_id} → ${lead.assigned_to || 'unassigned'}`);
    });
  }
  
  // Check all users
  console.log('\n👥 ALL USERS:');
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select('*');
    
  if (usersError) {
    console.log('   Error:', usersError.message);
  } else {
    console.log(`   Total users found: ${allUsers?.length || 0}`);
    allUsers?.forEach(user => {
      console.log(`   - ${user.id}: ${user.name} (${user.email}) [${user.auth_user_id || 'no auth id'}]`);
    });
  }
  
  // Check access control
  console.log('\n🔐 ACCESS CONTROL:');
  const { data: accessControl, error: accessError } = await supabase
    .from('access_control')
    .select('*');
    
  if (accessError) {
    console.log('   Error:', accessError.message);
  } else {
    console.log(`   Total access grants: ${accessControl?.length || 0}`);
    accessControl?.forEach(grant => {
      console.log(`   - ${grant.user_id} → ${grant.granted_to_user_id} at ${grant.granted_at}`);
    });
  }
}

inspectDatabase();
