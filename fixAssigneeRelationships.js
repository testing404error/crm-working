import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL || 'your-supabase-url',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function debugAndFixAssigneeRelationships() {
  try {
    console.log('🔍 Debugging assignee relationships...');
    
    // 1. Get all assignee users
    const { data: assigneeUsers, error: assigneeError } = await supabase
      .from('assignee_users')
      .select('*');
    
    if (assigneeError) {
      console.error('Error fetching assignee users:', assigneeError);
      return;
    }
    
    console.log('\n📋 Current assignee users:');
    assigneeUsers?.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);
    });
    
    // 2. Get all assignee relationships
    const { data: relationships, error: relationError } = await supabase
      .from('assignee_relationships')
      .select('*');
    
    if (relationError) {
      console.error('Error fetching relationships:', relationError);
      return;
    }
    
    console.log('\n🔗 Current assignee relationships:');
    relationships?.forEach(rel => {
      console.log(`- Assignee ID: ${rel.assignee_id} → User ID: ${rel.user_id}`);
    });
    
    // 3. Get all auth users to identify emails
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }
    
    console.log('\n👥 All users in the system:');
    users?.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Role: ${user.user_metadata?.role || 'none'}`);
    });
    
    // 4. Identify the real admin
    const realAdmin = users?.find(u => u.email === 'ankurmishrq575@gmail.com');
    const pandeyankit = users?.find(u => u.email === 'pandeyankit54562@gmail.com');
    const yaravij = users?.find(u => u.email === 'yaravij907@kissgy.com');
    
    console.log(`\n🎯 Key users identified:`);
    console.log(`Real admin (ankurmishrq575@gmail.com): ${realAdmin?.id || 'NOT FOUND'}`);
    console.log(`Pandeyankit (pandeyankit54562@gmail.com): ${pandeyankit?.id || 'NOT FOUND'}`);
    console.log(`Yaravij (yaravij907@kissgy.com): ${yaravij?.id || 'NOT FOUND'}`);
    
    // 5. Check what leads exist and who created them
    const { data: leads } = await supabase.from('leads').select('id, name, user_id');
    console.log(`\n📊 Leads in the system:`);
    leads?.forEach(lead => {
      const creator = users?.find(u => u.id === lead.user_id);
      console.log(`- Lead: ${lead.name}, Created by: ${creator?.email || 'Unknown'} (${lead.user_id})`);
    });
    
    // 6. Propose fixes
    console.log(`\n💡 PROPOSED FIXES:`);
    
    // Check if yaravij should be an assignee at all
    const yaravijAssignee = assigneeUsers?.find(a => a.email === 'yaravij907@kissgy.com');
    if (yaravijAssignee) {
      console.log(`\n❌ PROBLEM: yaravij907@kissgy.com is marked as an assignee`);
      console.log(`   SOLUTION: Remove them from assignee_users table OR fix their relationship`);
      
      // Check their current relationship
      const yaravijRelation = relationships?.find(r => r.assignee_id === yaravijAssignee.id);
      if (yaravijRelation) {
        const relationUser = users?.find(u => u.id === yaravijRelation.user_id);
        console.log(`   Current relationship: Points to ${relationUser?.email || 'Unknown'} (${yaravijRelation.user_id})`);
        
        if (relationUser?.email !== 'ankurmishrq575@gmail.com') {
          console.log(`   🚨 ISSUE: Should point to ankurmishrq575@gmail.com, not ${relationUser?.email}`);
        }
      }
    }
    
    console.log(`\n📝 RECOMMENDED ACTIONS:`);
    console.log(`1. If yaravij907@kissgy.com should NOT be an assignee:`);
    console.log(`   - Delete them from assignee_users table`);
    console.log(`   - Delete their relationship from assignee_relationships table`);
    console.log(`\n2. If yaravij907@kissgy.com SHOULD be an assignee:`);
    console.log(`   - Update their relationship to point to the real admin: ${realAdmin?.id}`);
    console.log(`\n3. Make sure ankurmishrq575@gmail.com has admin role set in user_metadata`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the debug
debugAndFixAssigneeRelationships();
