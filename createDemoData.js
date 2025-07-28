import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function createDemoData() {
  try {
    console.log('=== Creating Demo Data ===\n');
    
    const demoAdminId = '12345678-1234-1234-1234-123456789012'; // Demo admin ID
    
    // Create a demo lead
    console.log('1. Creating demo lead...');
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert([{
        user_id: demoAdminId,
        name: 'Demo Lead',
        email: 'demo@example.com',
        phone: '+1234567890',
        company: 'Demo Company',
        source: 'manual',
        score: 75,
        status: 'new',
        assigned_to: 'yaravij907@kissgy.com',
        created_at: new Date().toISOString(),
        tags: ['demo', 'test']
      }])
      .select();
    
    if (leadError) {
      console.error('Error creating lead:', leadError.message);
    } else {
      console.log('✓ Created demo lead');
    }
    
    // Create a demo opportunity
    console.log('\n2. Creating demo opportunity...');
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .insert([{
        user_id: demoAdminId,
        name: 'Demo Opportunity',
        lead_id: lead?.[0]?.id,
        value: 50000,
        currency: 'INR',
        stage: 'prospecting',
        probability: 25,
        expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        assigned_to: 'yaravij907@kissgy.com',
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        description: 'Demo opportunity for testing access control',
        tags: ['demo', 'test']
      }])
      .select();
    
    if (oppError) {
      console.error('Error creating opportunity:', oppError.message);
    } else {
      console.log('✓ Created demo opportunity');
    }
    
    // Verify total data
    console.log('\n3. Verifying data...');
    const { data: leads } = await supabase.from('leads').select('*');
    const { data: opportunities } = await supabase.from('opportunities').select('*');
    
    console.log(`✓ Total leads: ${leads?.length || 0}`);
    console.log(`✓ Total opportunities: ${opportunities?.length || 0}`);
    
    console.log('\n=== Demo Data Created! ===');
    console.log('Now when yaravij907@kissgy.com logs in, they should be able to see:');
    console.log('- Demo leads and opportunities assigned to the admin user');
    console.log('- Because they have an assignee relationship with the admin');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

createDemoData();
