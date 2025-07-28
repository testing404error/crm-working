import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOpportunitiesSchema() {
  try {
    console.log('Checking opportunities table...');
    
    // Test basic select to see structure
    const { data: sample, error: sampleError } = await supabase
      .from('opportunities')
      .select('*')
      .limit(3);

    if (sampleError) {
      console.error('Error fetching sample data:', sampleError);
    } else {
      console.log('Sample opportunity data:');
      console.log(JSON.stringify(sample, null, 2));
    }

    // Check if there are any existing opportunities
    const { count, error: countError } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting opportunities:', countError);
    } else {
      console.log(`\nTotal opportunities in database: ${count}`);
    }

    // Try to simulate the same insert that's failing
    console.log('\nTesting opportunity creation with sample data...');
    
    // First, let's see what leads exist
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name')
      .limit(1);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return;
    }

    if (leads.length === 0) {
      console.log('No leads found to test with');
      return;
    }

    const testLead = leads[0];
    console.log('Testing with lead:', testLead);

    // Get current user info
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .limit(1);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }

    if (users.length === 0) {
      console.log('No users found to test with');
      return;
    }

    const testUser = users[0];
    console.log('Testing with user:', testUser);

    // Try to create a test opportunity
    const testOpportunity = {
      name: `Test Opportunity - ${Date.now()}`,
      lead_id: testLead.id,
      user_id: testUser.id,
      status: 'OPEN',
      value: 5000,
      probability: 50,
      expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    console.log('Attempting to create opportunity:', testOpportunity);

    const { data: newOpp, error: createError } = await supabase
      .from('opportunities')
      .insert([testOpportunity])
      .select();

    if (createError) {
      console.error('Error creating test opportunity:', createError);
      console.error('Error details:', JSON.stringify(createError, null, 2));
    } else {
      console.log('Successfully created test opportunity:', newOpp);
      
      // Clean up - delete the test opportunity
      if (newOpp && newOpp.length > 0) {
        await supabase
          .from('opportunities')
          .delete()
          .eq('id', newOpp[0].id);
        console.log('Cleaned up test opportunity');
      }
    }

  } catch (error) {
    console.error('Error checking opportunities:', error);
  }
}

checkOpportunitiesSchema();
