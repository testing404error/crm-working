import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function testAssigneeAccess() {
  try {
    console.log('=== Testing Assignee Access Control ===\n');
    
    const assigneeEmail = 'yaravij907@kissgy.com';
    const ADMIN_USER_ID = '1b51b619-918b-4419-bbb5-0de2fbe52a77';
    
    // Simulate the access control logic
    console.log('1. Testing if assignee exists...');
    const { data: assigneeUser, error: assigneeError } = await supabase
      .from('assignee_users')
      .select('id')
      .eq('email', assigneeEmail)
      .single();
    
    if (assigneeError) {
      console.log('❌ Assignee not found:', assigneeError.message);
      return;
    }
    
    console.log(`✅ Assignee found: ${assigneeUser.id}`);
    
    // Check assignee relationship
    console.log('\n2. Testing assignee relationship...');
    const { data: assigneeRelation, error: relationError } = await supabase
      .from('assignee_relationships')
      .select('user_id')
      .eq('assignee_id', assigneeUser.id)
      .single();
    
    if (relationError) {
      console.log('❌ No assignee relationship found:', relationError.message);
      return;
    }
    
    console.log(`✅ Assignee relationship found: assigned to user ${assigneeRelation.user_id}`);
    
    // Test if assignee should see admin's leads
    console.log('\n3. Testing admin\'s leads visibility...');
    const { data: adminLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, user_id')
      .eq('user_id', assigneeRelation.user_id);
    
    if (leadsError) {
      console.log('❌ Error fetching admin leads:', leadsError.message);
    } else {
      console.log(`✅ Admin has ${adminLeads?.length || 0} leads that assignee should see:`);
      adminLeads?.forEach(lead => {
        console.log(`  - ${lead.name} (ID: ${lead.id})`);
      });
    }
    
    // Test if assignee should see admin's opportunities
    console.log('\n4. Testing admin\'s opportunities visibility...');
    const { data: adminOpps, error: oppsError } = await supabase
      .from('opportunities')
      .select('id, name, user_id')
      .eq('user_id', assigneeRelation.user_id);
    
    if (oppsError) {
      console.log('❌ Error fetching admin opportunities:', oppsError.message);
    } else {
      console.log(`✅ Admin has ${adminOpps?.length || 0} opportunities that assignee should see:`);
      adminOpps?.forEach(opp => {
        console.log(`  - ${opp.name} (ID: ${opp.id})`);
      });
    }
    
    console.log('\n=== Summary ===');
    console.log('When yaravij907@kissgy.com logs in as an assignee, they should see:');
    console.log(`- Their own data (if any)`);
    console.log(`- Admin's ${adminLeads?.length || 0} leads`);
    console.log(`- Admin's ${adminOpps?.length || 0} opportunities`);
    console.log(`- Total leads/opportunities visible: ${(adminLeads?.length || 0) + (adminOpps?.length || 0)}`);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

testAssigneeAccess();
