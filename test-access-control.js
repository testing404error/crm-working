import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

// Simplified version of access control logic
async function testAccessControl() {
  console.log('=== Testing Access Control Logic ===\n');
  
  // Test the assignee logic first
  console.log('1. Testing assignee detection...');
  
  // Check if yaravij907@kissgy.com is an assignee
  const testEmail = 'yaravij907@kissgy.com';
  
  const { data: assigneeUser, error: assigneeUserError } = await supabase
    .from('assignee_users')
    .select('id')
    .eq('email', testEmail)
    .single();
  
  if (!assigneeUserError && assigneeUser) {
    console.log(`✅ ${testEmail} is an assignee with ID: ${assigneeUser.id}`);
    
    // Check assignee relationship
    const { data: assigneeRelation, error: relationError } = await supabase
      .from('assignee_relationships')
      .select('user_id')
      .eq('assignee_id', assigneeUser.id)
      .single();
    
    if (!relationError && assigneeRelation) {
      console.log(`✅ Assignee is assigned to user: ${assigneeRelation.user_id}`);
      console.log('🎯 This means the assignee should ONLY see data from this user ID');
      
      // Test leads access
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, name, user_id')
        .eq('user_id', assigneeRelation.user_id);
      
      if (!leadsError) {
        console.log(`✅ Admin has ${leads?.length || 0} leads that assignee should see`);
      }
      
      // Test opportunities access
      const { data: opportunities, error: oppsError } = await supabase
        .from('opportunities')
        .select('id, name, user_id')
        .eq('user_id', assigneeRelation.user_id);
      
      if (!oppsError) {
        console.log(`✅ Admin has ${opportunities?.length || 0} opportunities that assignee should see`);
      }
      
    } else {
      console.log('❌ No assignee relationship found');
    }
  } else {
    console.log(`❌ ${testEmail} is not an assignee`);
  }
  
  // Test the new permissions table
  console.log('\n2. Testing user_permissions table...');
  try {
    const { data: permissions, error: permError } = await supabase
      .from('user_permissions')
      .select('*');
    
    if (permError) {
      console.log('❌ Cannot access user_permissions:', permError.message);
      console.log('💡 This might be due to RLS policies - that\'s normal');
    } else {
      console.log('✅ user_permissions table accessible');
      console.log('   Records found:', permissions?.length || 0);
    }
  } catch (error) {
    console.log('❌ Error accessing user_permissions:', error.message);
  }
  
  // Test if we can see all leads (current behavior)
  console.log('\n3. Testing current leads access...');
  const { data: allLeads, error: allLeadsError } = await supabase
    .from('leads')
    .select('id, name, user_id')
    .limit(10);
  
  if (!allLeadsError) {
    console.log(`✅ Can see ${allLeads?.length || 0} leads total`);
    const uniqueUserIds = [...new Set(allLeads?.map(l => l.user_id) || [])];
    console.log(`   From ${uniqueUserIds.length} different users:`, uniqueUserIds);
  } else {
    console.log('❌ Cannot access leads:', allLeadsError.message);
  }
  
  console.log('\n=== Summary ===');
  console.log('If yaravij907@kissgy.com is an assignee and has a relationship,');
  console.log('they should ONLY see leads/opportunities from their assigned user.');
  console.log('Currently, they can probably see all leads from all users.');
  console.log('\nTo fix: The frontend access control needs to be applied.');
}

testAccessControl();
