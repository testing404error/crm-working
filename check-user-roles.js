const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserRoles() {
  try {
    console.log('Checking user roles and metadata...\n');
    
    // Query auth.users table to get user metadata
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    console.log('Found', users.users.length, 'users in auth.users table:\n');
    
    users.users.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log('  ID:', user.id);
      console.log('  Email:', user.email);
      console.log('  Role:', user.user_metadata?.role || 'No role set');
      console.log('  User Metadata:', JSON.stringify(user.user_metadata, null, 2));
      console.log('  App Metadata:', JSON.stringify(user.app_metadata, null, 2));
      console.log('  Created:', user.created_at);
      console.log('  Last Sign In:', user.last_sign_in_at);
      console.log('---');
    });
    
    // Also check the leads table to see who created what
    console.log('\nChecking leads creators...\n');
    
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, title, created_by')
      .limit(10);
    
    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return;
    }
    
    console.log('Recent leads and their creators:');
    leads.forEach(lead => {
      const creator = users.users.find(u => u.id === lead.created_by);
      console.log(`Lead "${lead.title}" created by: ${creator?.email || lead.created_by} (${creator?.user_metadata?.role || 'unknown role'})`);
    });
    
    // Check assignee relationships
    console.log('\nChecking assignee relationships...\n');
    
    const { data: assigneeData, error: assigneeError } = await supabase
      .from('assignee_requests')
      .select('assignee_id, admin_id, status')
      .eq('status', 'accepted');
    
    if (assigneeError) {
      console.error('Error fetching assignee relationships:', assigneeError);
      return;
    }
    
    console.log('Active assignee relationships:');
    assigneeData.forEach(rel => {
      const assignee = users.users.find(u => u.id === rel.assignee_id);
      const admin = users.users.find(u => u.id === rel.admin_id);
      console.log(`Assignee: ${assignee?.email || rel.assignee_id} -> Admin: ${admin?.email || rel.admin_id}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUserRoles();
