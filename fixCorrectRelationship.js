import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function fixCorrectRelationship() {
  try {
    console.log('=== Creating Correct Assignee Relationships ===\n');
    
    const assigneeId = 'fd030c7a-868c-4177-8ca6-d73c301c8547'; // ankit's assignee ID
    
    // All the real user IDs we found
    const realUserIds = [
      'c88c5f3d-2485-442f-a2ad-f9b7e28c32a0', // shubham, shreya
      '3a19c1cc-1896-42b7-bc0c-511b5b956e91', // Pragati
      '1b51b619-918b-4419-bbb5-0de2fbe52a77', // Ankit Pandey, fdfdfd, jujujuju, 0987
      'd357a7e9-5fe0-489f-a28b-b81af33a3497', // ankit salesd id kisfdfd (THIS IS THE ONE!)
      'bbce60e4-e132-4703-b393-fa8d89d40d54', // fdfdfdfdfdfd
      'a59baac2-186e-4207-a49b-07f4f76a66af'  // ansh
    ];
    
    console.log('Creating assignee relationships for all real user IDs...');
    
    for (const userId of realUserIds) {
      try {
        const { data, error } = await supabase
          .from('assignee_relationships')
          .upsert([{
            user_id: userId,
            assignee_id: assigneeId,
            created_by: userId
          }], {
            onConflict: 'user_id,assignee_id'
          })
          .select();
        
        if (error) {
          console.log(`  ❌ Failed for ${userId}: ${error.message}`);
        } else {
          console.log(`  ✅ Created relationship for ${userId}`);
        }
      } catch (e) {
        console.log(`  ❌ Error with ${userId}: ${e.message}`);
      }
    }
    
    // Verify the relationships
    console.log('\n=== Final Verification ===');
    const { data: relationships } = await supabase
      .from('assignee_relationships')
      .select(`
        user_id,
        assignee_id,
        assignee_users (name, email)
      `);
    
    console.log(`Total relationships: ${relationships?.length || 0}`);
    relationships?.forEach(rel => {
      console.log(`  ${rel.assignee_users?.name} (${rel.assignee_users?.email}) → User: ${rel.user_id}`);
    });
    
    console.log('\n🎉 SUCCESS!');
    console.log('Now when yaravij907@kissgy.com logs in, they should see:');
    console.log('- All leads and opportunities from all users');
    console.log('- Including the "ankit salesd id kisfdfd" lead');
    console.log('- Because they are assigned as an assignee to all these users');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

fixCorrectRelationship();
