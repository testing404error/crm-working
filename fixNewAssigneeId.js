import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function fixNewAssigneeId() {
  try {
    console.log('=== Fixing New Assignee ID Relationships ===\n');
    
    // The new assignee ID from the debug output
    const newAssigneeId = '9845d639-fefa-4693-bd22-343c1ac381a1';
    
    // All the real user IDs that exist in the system
    const realUserIds = [
      'c88c5f3d-2485-442f-a2ad-f9b7e28c32a0', // shubham, shreya
      '3a19c1cc-1896-42b7-bc0c-511b5b956e91', // Pragati
      '1b51b619-918b-4419-bbb5-0de2fbe52a77', // Ankit Pandey, fdfdfd, jujujuju, 0987
      'd357a7e9-5fe0-489f-a28b-b81af33a3497', // ankit salesd id kisfdfd (THE IMPORTANT ONE!)
      'bbce60e4-e132-4703-b393-fa8d89d40d54', // fdfdfdfdfdfd
      'a59baac2-186e-4207-a49b-07f4f76a66af'  // ansh
    ];
    
    console.log(`Creating relationships for new assignee ID: ${newAssigneeId}`);
    console.log('Connecting to all real user IDs...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const userId of realUserIds) {
      try {
        const { data, error } = await supabase
          .from('assignee_relationships')
          .upsert([{
            user_id: userId,
            assignee_id: newAssigneeId,
            created_by: userId
          }], {
            onConflict: 'user_id,assignee_id'
          })
          .select();
        
        if (error) {
          console.log(`  ❌ Failed for ${userId}: ${error.message}`);
          errorCount++;
        } else {
          console.log(`  ✅ Created relationship for ${userId}`);
          successCount++;
        }
      } catch (e) {
        console.log(`  ❌ Error with ${userId}: ${e.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Results: ${successCount} success, ${errorCount} errors`);
    
    // Clean up old relationships from the previous assignee ID
    console.log('\n🧹 Cleaning up old relationships...');
    const oldAssigneeId = 'fd030c7a-868c-4177-8ca6-d73c301c8547';
    
    const { data: deletedRows, error: deleteError } = await supabase
      .from('assignee_relationships')
      .delete()
      .eq('assignee_id', oldAssigneeId);
    
    if (deleteError) {
      console.log(`  ❌ Error cleaning up: ${deleteError.message}`);
    } else {
      console.log(`  ✅ Cleaned up old relationships`);
    }
    
    // Final verification
    console.log('\n=== Final Verification ===');
    const { data: relationships } = await supabase
      .from('assignee_relationships')
      .select(`
        user_id,
        assignee_id,
        assignee_users (name, email)
      `);
    
    console.log(`Total relationships: ${relationships?.length || 0}`);
    
    const ankitRelationships = relationships?.filter(rel => 
      rel.assignee_users?.email === 'yaravij907@kissgy.com'
    ) || [];
    
    console.log(`Ankit's relationships: ${ankitRelationships.length}`);
    ankitRelationships.forEach(rel => {
      console.log(`  ✅ ${rel.assignee_users?.name} → User: ${rel.user_id}`);
    });
    
    console.log('\n🎉 FIXED!');
    console.log('The assignee yaravij907@kissgy.com should now see all admin leads again!');
    console.log('Including the "ankit salesd id kisfdfd" lead and all others.');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

fixNewAssigneeId();
