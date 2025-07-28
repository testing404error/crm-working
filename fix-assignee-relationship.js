import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Make sure to replace these with your actual Supabase URL and service role key
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseServiceKey = 'YOUR_SUPABASE_SERVICE_ROLE_KEY'; // Use service role key for admin operations

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixAssigneeRelationship() {
  try {
    console.log('🔧 Starting assignee relationship fix...');
    
    // First, let's check the current state of the assignee relationships
    console.log('\n📋 Current assignee relationships:');
    const { data: currentRelations, error: fetchError } = await supabase
      .from('assignee_relationships')
      .select(`
        id,
        assignee_id,
        user_id,
        assignee_users!inner(email),
        created_at
      `);
    
    if (fetchError) {
      console.error('Error fetching current relations:', fetchError);
      return;
    }
    
    currentRelations?.forEach(relation => {
      console.log(`- Assignee: ${relation.assignee_users.email} (ID: ${relation.assignee_id})`);
      console.log(`  Points to user_id: ${relation.user_id}`);
      console.log(`  Created: ${relation.created_at}`);
      console.log('');
    });
    
    // Find the specific assignee relationship for yaravij907@kissgy.com
    const targetAssigneeEmail = 'yaravij907@kissgy.com';
    const targetRelation = currentRelations?.find(rel => 
      rel.assignee_users.email === targetAssigneeEmail
    );
    
    if (!targetRelation) {
      console.error(`❌ Could not find assignee relationship for ${targetAssigneeEmail}`);
      return;
    }
    
    console.log(`✅ Found target relationship for ${targetAssigneeEmail}:`);
    console.log(`   Assignee ID: ${targetRelation.assignee_id}`);
    console.log(`   Current user_id: ${targetRelation.user_id}`);
    
    // The correct admin user ID (for ankurmishrq575@gmail.com)
    const correctAdminUserId = 'bbce60e4-e132-4703-b393-fa8d89d40d54';
    
    // Check if the relationship already points to the correct admin
    if (targetRelation.user_id === correctAdminUserId) {
      console.log('✅ Relationship already points to the correct admin user ID!');
      return;
    }
    
    // Update the assignee relationship
    console.log(`🔄 Updating assignee relationship...`);
    console.log(`   From user_id: ${targetRelation.user_id}`);
    console.log(`   To user_id:   ${correctAdminUserId}`);
    
    const { data: updateResult, error: updateError } = await supabase
      .from('assignee_relationships')
      .update({ 
        user_id: correctAdminUserId,
        updated_at: new Date().toISOString()
      })
      .eq('assignee_id', targetRelation.assignee_id)
      .select();
    
    if (updateError) {
      console.error('❌ Error updating assignee relationship:', updateError);
      return;
    }
    
    console.log('✅ Successfully updated assignee relationship!');
    console.log('Updated record:', updateResult);
    
    // Verify the update
    console.log('\n🔍 Verifying the update...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('assignee_relationships')
      .select(`
        id,
        assignee_id,
        user_id,
        assignee_users!inner(email),
        updated_at
      `)
      .eq('assignee_id', targetRelation.assignee_id)
      .single();
    
    if (verifyError) {
      console.error('Error verifying update:', verifyError);
      return;
    }
    
    console.log(`✅ Verification successful:`);
    console.log(`   Assignee: ${verifyData.assignee_users.email}`);
    console.log(`   Now points to user_id: ${verifyData.user_id}`);
    console.log(`   Updated at: ${verifyData.updated_at}`);
    
    // Optional: Get user details for the new user_id to confirm it's the right admin
    console.log('\n🔍 Getting details for the target admin user...');
    const { data: userData } = await supabase.auth.admin.getUserById(correctAdminUserId);
    
    if (userData?.user) {
      console.log(`✅ Target user details:`);
      console.log(`   Email: ${userData.user.email}`);
      console.log(`   Role: ${userData.user.user_metadata?.role || 'Not set'}`);
      console.log(`   Created: ${userData.user.created_at}`);
    }
    
    console.log('\n🎉 Assignee relationship fix completed successfully!');
    console.log(`Now ${targetAssigneeEmail} should see data from ${userData?.user?.email} instead of the previous user.`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixAssigneeRelationship();
