import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Check your environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugAccessControl() {
  console.log('=== ACCESS CONTROL DIAGNOSTIC ===\n');

  try {
    // 1. List all users with their roles and metadata
    console.log('1. USER ROLES AND METADATA:');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }

    for (const user of users.users) {
      console.log(`User ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.user_metadata?.role || 'No role set'}`);
      console.log(`User Metadata:`, user.user_metadata);
      console.log(`App Metadata:`, user.app_metadata);
      console.log('---');
    }

    // 2. Check recent leads with their creators
    console.log('\n2. RECENT LEADS WITH CREATORS:');
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, company_name, created_by, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return;
    }

    for (const lead of leads) {
      const creator = users.users.find(u => u.id === lead.created_by);
      console.log(`Lead: ${lead.company_name} (ID: ${lead.id})`);
      console.log(`Created by: ${creator?.email || 'Unknown'} (Role: ${creator?.user_metadata?.role || 'No role'})`);
      console.log(`Created at: ${lead.created_at}`);
      console.log('---');
    }

    // 3. Check assignee relationships
    console.log('\n3. ASSIGNEE RELATIONSHIPS:');
    const { data: assignees, error: assigneesError } = await supabase
      .from('assignees')
      .select('id, assignee_id, admin_id, created_at');

    if (assigneesError) {
      console.error('Error fetching assignees:', assigneesError);
      return;
    }

    for (const assignee of assignees) {
      const assigneeUser = users.users.find(u => u.id === assignee.assignee_id);
      const adminUser = users.users.find(u => u.id === assignee.admin_id);
      
      console.log(`Assignee: ${assigneeUser?.email || 'Unknown'} (Role: ${assigneeUser?.user_metadata?.role || 'No role'})`);
      console.log(`Admin: ${adminUser?.email || 'Unknown'} (Role: ${adminUser?.user_metadata?.role || 'No role'})`);
      console.log(`Created at: ${assignee.created_at}`);
      console.log('---');
    }

    // 4. Check user permissions table if it exists
    console.log('\n4. USER PERMISSIONS (if table exists):');
    const { data: permissions, error: permissionsError } = await supabase
      .from('user_permissions')
      .select('user_id, can_view_other_users_data');

    if (permissionsError) {
      console.log('User permissions table not found or error:', permissionsError.message);
    } else {
      for (const permission of permissions) {
        const user = users.users.find(u => u.id === permission.user_id);
        console.log(`User: ${user?.email || 'Unknown'} - Can view other users' data: ${permission.can_view_other_users_data}`);
      }
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

debugAccessControl().then(() => {
  console.log('\n=== DIAGNOSTIC COMPLETE ===');
  process.exit(0);
});
