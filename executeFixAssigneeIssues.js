import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL || 'your-supabase-url',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function executeFixAssigneeIssues() {
  try {
    console.log('🔧 Executing fixes for assignee relationship issues...');
    
    // Step 1: Remove yaravij907@kissgy.com from assignee_users table
    console.log('\n📝 Step 1: Removing yaravij907@kissgy.com from assignee_users...');
    
    const { data: deletedAssignee, error: deleteAssigneeError } = await supabase
      .from('assignee_users')
      .delete()
      .eq('email', 'yaravij907@kissgy.com')
      .select();
    
    if (deleteAssigneeError) {
      console.error('❌ Error deleting assignee user:', deleteAssigneeError);
    } else {
      console.log('✅ Successfully removed yaravij907@kissgy.com from assignee_users');
      console.log('   Deleted record:', deletedAssignee);
    }
    
    // Step 2: Remove the incorrect assignee relationship
    console.log('\n📝 Step 2: Removing incorrect assignee relationship...');
    
    const { data: deletedRelation, error: deleteRelationError } = await supabase
      .from('assignee_relationships')
      .delete()
      .eq('assignee_id', '8fc91b6a-998c-4357-8327-5eba7757c85a') // yaravij's assignee ID
      .select();
    
    if (deleteRelationError) {
      console.error('❌ Error deleting assignee relationship:', deleteRelationError);
    } else {
      console.log('✅ Successfully removed incorrect assignee relationship');
      console.log('   Deleted relationship:', deletedRelation);
    }
    
    // Step 3: Ensure ankurmishrq575@gmail.com has admin role
    console.log('\n📝 Step 3: Ensuring ankurmishrq575@gmail.com has admin role...');
    
    const { data: updatedAdmin, error: adminError } = await supabase.auth.admin.updateUserById(
      'bbce60e4-e132-4703-b393-fa8d89d40d54', // ankurmishrq575@gmail.com user ID
      {
        user_metadata: {
          role: 'admin'
        }
      }
    );
    
    if (adminError) {
      console.error('❌ Error setting admin role:', adminError);
    } else {
      console.log('✅ Successfully ensured ankurmishrq575@gmail.com has admin role');
    }
    
    // Step 4: Verify the fixes
    console.log('\n📝 Step 4: Verifying the fixes...');
    
    // Check assignee_users table
    const { data: remainingAssignees } = await supabase
      .from('assignee_users')
      .select('*');
    
    console.log('\n👥 Remaining assignee users:');
    remainingAssignees?.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`);
    });
    
    // Check assignee_relationships table
    const { data: remainingRelations } = await supabase
      .from('assignee_relationships')
      .select('*');
    
    console.log('\n🔗 Remaining assignee relationships:');
    remainingRelations?.forEach(rel => {
      console.log(`   - Assignee ID: ${rel.assignee_id} → User ID: ${rel.user_id}`);
    });
    
    // Check if yaravij is no longer an assignee
    const yaravijStillAssignee = remainingAssignees?.find(a => a.email === 'yaravij907@kissgy.com');
    if (!yaravijStillAssignee) {
      console.log('\n✅ SUCCESS: yaravij907@kissgy.com is no longer an assignee');
      console.log('   They will now only see their own data');
    } else {
      console.log('\n❌ ISSUE: yaravij907@kissgy.com is still marked as an assignee');
    }
    
    console.log('\n🎉 Fix execution completed!');
    console.log('\nExpected behavior after this fix:');
    console.log('✅ yaravij907@kissgy.com should only see their own leads (Kissegie)');
    console.log('✅ ankurmishrq575@gmail.com should see all leads as admin');
    console.log('✅ Other regular users should only see their own data');
    
  } catch (error) {
    console.error('❌ Unexpected error during fix execution:', error);
  }
}

// Run the fix
executeFixAssigneeIssues();
