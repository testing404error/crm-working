import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function testCompleteFix() {
  console.log('🧪 TESTING COMPLETE FIX\n');
  
  // 1. Test current user relationships
  console.log('1. 📊 Current Access Control Status:');
  
  const adminUserId = 'b2801760-8e17-46aa-a127-daaa9f288778'; // admin user
  const ankitUserId = '60778fd4-4753-4ad9-91c0-98fce6d21a92'; // ankit user
  
  const { data: accessControl } = await supabase
    .from('access_control')
    .select('*');
    
  console.log(`   Access Control Entries: ${accessControl?.length || 0}`);
  accessControl?.forEach(ac => {
    console.log(`   - ${ac.user_id} → ${ac.granted_to_user_id}`);
  });
  
  // 2. Test admin leads and their assignments
  console.log('\n2. 📋 Admin Leads Status:');
  
  const { data: adminLeads } = await supabase
    .from('leads')
    .select('id, name, user_id, assigned_to')
    .eq('user_id', adminUserId);
    
  console.log(`   Admin-created leads: ${adminLeads?.length || 0}`);
  const assignedLeads = adminLeads?.filter(l => l.assigned_to) || [];
  const unassignedLeads = adminLeads?.filter(l => !l.assigned_to) || [];
  
  console.log(`   ✅ Assigned leads: ${assignedLeads.length}`);
  console.log(`   ❌ Unassigned leads: ${unassignedLeads.length}`);
  
  assignedLeads.forEach(lead => {
    console.log(`      - "${lead.name}" → ${lead.assigned_to}`);
  });
  
  // 3. Test what ankit should see
  console.log('\n3. 👤 What Ankit Should See:');
  
  // Get leads visible to ankit through access control
  const { data: ankitAccessibleLeads } = await supabase
    .from('leads')
    .select('id, name, user_id, assigned_to')
    .in('user_id', [ankitUserId, adminUserId]); // Own + admin's data
    
  console.log(`   Total accessible leads: ${ankitAccessibleLeads?.length || 0}`);
  
  const ankitOwnLeads = ankitAccessibleLeads?.filter(l => l.user_id === ankitUserId) || [];
  const adminLeadsVisible = ankitAccessibleLeads?.filter(l => l.user_id === adminUserId) || [];
  
  console.log(`   📝 Own leads: ${ankitOwnLeads.length}`);
  console.log(`   👔 Admin leads visible: ${adminLeadsVisible.length}`);
  
  // 4. Test assignee display
  console.log('\n4. 🏷️ Assignee Display Test:');
  
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email');
    
  console.log('   User mapping:');
  users?.forEach(user => {
    console.log(`   - ${user.id} = ${user.name} (${user.email})`);
  });
  
  // 5. Summary
  console.log('\n📋 SUMMARY:');
  
  const hasAccessControl = accessControl && accessControl.length > 0;
  const hasAssignedLeads = assignedLeads.length > 0;
  const ankitCanSeeAdminData = adminLeadsVisible.length > 0;
  
  console.log(`✅ Access Control Setup: ${hasAccessControl ? 'WORKING' : 'MISSING'}`);
  console.log(`✅ Admin Lead Assignment: ${hasAssignedLeads ? 'WORKING' : 'NEEDS ASSIGNMENT'}`);
  console.log(`✅ Ankit Can See Admin Data: ${ankitCanSeeAdminData ? 'WORKING' : 'BLOCKED'}`);
  
  // 6. Recommendations
  console.log('\n🎯 NEXT STEPS:');
  
  if (!hasAssignedLeads) {
    console.log('1. 📝 CREATE NEW LEAD: When creating a lead as admin, assign it to "ankit"');
    console.log('   - Go to Leads page');
    console.log('   - Click "Create Lead"');
    console.log('   - Fill the form');
    console.log('   - In "Assigned To" dropdown, select "ankit"');
    console.log('   - Save the lead');
  }
  
  if (!ankitCanSeeAdminData) {
    console.log('2. 🔧 RUN SQL TRIGGER: Execute the fix-admin-lead-assignment.sql script');
  } else {
    console.log('2. ✅ ACCESS WORKING: Ankit should see admin leads when logged in');
  }
  
  console.log('3. 🧪 TEST UI: Login as ankit and check if assigned leads appear');
  console.log('4. 🔄 TEST ACCESS REQUEST: Try sending access request via UI');
  
  console.log('\n🎉 TEST COMPLETE!');
}

testCompleteFix();
