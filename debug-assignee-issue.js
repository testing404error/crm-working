import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function debugAssigneeIssue() {
  console.log('🔍 DEBUGGING ASSIGNEE ACCESS ISSUE\n');
  
  const assigneeEmail = 'yaravij907@kissgy.com';
  const problemEmail = 'pandeyankit54562@gmail.com';
  
  // 1. Check assignee setup
  console.log('1. Checking assignee setup...');
  const { data: assigneeUser } = await supabase
    .from('assignee_users')
    .select('*')
    .eq('email', assigneeEmail)
    .single();
  
  if (assigneeUser) {
    console.log(`✅ Assignee found: ${assigneeUser.name} (${assigneeUser.email}) - ID: ${assigneeUser.id}`);
    
    // 2. Check assignee relationships
    console.log('\n2. Checking assignee relationships...');
    const { data: relationships } = await supabase
      .from('assignee_relationships')
      .select('*')
      .eq('assignee_id', assigneeUser.id);
    
    console.log(`Found ${relationships?.length || 0} relationships:`);
    relationships?.forEach(rel => {
      console.log(`   - Assigned to user: ${rel.user_id} (created by: ${rel.created_by})`);
    });
    
    // 3. Check the problem user's data
    console.log('\n3. Investigating problem user data...');
    const { data: problemLeads } = await supabase
      .from('leads')
      .select('id, name, email, user_id')
      .ilike('email', `%${problemEmail}%`);
    
    console.log(`Found ${problemLeads?.length || 0} leads with email ${problemEmail}:`);
    problemLeads?.forEach(lead => {
      console.log(`   - Lead: "${lead.name}" (${lead.email}) - Created by user: ${lead.user_id}`);
    });
    
    // 4. Check if the problem user ID matches any assignee relationship
    if (problemLeads && problemLeads.length > 0) {
      const problemUserId = problemLeads[0].user_id;
      console.log(`\n4. Checking if problem user (${problemUserId}) matches assignee relationship...`);
      
      const matchingRelation = relationships?.find(rel => rel.user_id === problemUserId);
      if (matchingRelation) {
        console.log(`⚠️ FOUND MATCH: Problem user ${problemUserId} IS in assignee relationships!`);
        console.log(`   This means assignee should see this data (working as intended)`);
      } else {
        console.log(`❌ NO MATCH: Problem user ${problemUserId} is NOT in assignee relationships`);
        console.log(`   This is the BUG - assignee shouldn't see this data!`);
      }
    }
    
    // 5. Check all users that assignee should have access to
    console.log('\n5. All users assignee should have access to:');
    relationships?.forEach(rel => {
      console.log(`   - User ID: ${rel.user_id}`);
    });
    
    // 6. Check what the access control service should return
    console.log('\n6. What accessControlService.getAccessibleUserIds() should return:');
    console.log(`   - Own ID: [would be auth user ID when logged in]`);
    relationships?.forEach(rel => {
      console.log(`   - Admin ID: ${rel.user_id}`);
    });
    
    console.log(`\n🎯 EXPECTED BEHAVIOR:`);
    console.log(`   Assignee should ONLY see leads from these user IDs:`);
    console.log(`   - Their own auth user ID`);
    relationships?.forEach(rel => {
      console.log(`   - Admin user ID: ${rel.user_id}`);
    });
    
  } else {
    console.log('❌ Assignee not found');
  }
}

debugAssigneeIssue();
