import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function findAdminUser() {
  try {
    console.log('=== Finding Admin User ===\n');
    
    // Get all leads and opportunities to analyze user data
    const { data: leads } = await supabase.from('leads').select('user_id, name, created_at');
    const { data: opportunities } = await supabase.from('opportunities').select('user_id, name, created_at');
    
    // Combine all user IDs and count their records
    const userStats = {};
    
    leads?.forEach(lead => {
      if (!userStats[lead.user_id]) {
        userStats[lead.user_id] = { leads: 0, opportunities: 0, firstSeen: lead.created_at };
      }
      userStats[lead.user_id].leads++;
    });
    
    opportunities?.forEach(opp => {
      if (!userStats[opp.user_id]) {
        userStats[opp.user_id] = { leads: 0, opportunities: 0, firstSeen: opp.created_at };
      }
      userStats[opp.user_id].opportunities++;
      
      // Update firstSeen if this is earlier
      if (opp.created_at < userStats[opp.user_id].firstSeen) {
        userStats[opp.user_id].firstSeen = opp.created_at;
      }
    });
    
    console.log('User Statistics:');
    console.log('================');
    
    Object.entries(userStats).forEach(([userId, stats]) => {
      const total = stats.leads + stats.opportunities;
      console.log(`User ID: ${userId}`);
      console.log(`  Leads: ${stats.leads}, Opportunities: ${stats.opportunities}, Total: ${total}`);
      console.log(`  First seen: ${stats.firstSeen}`);
      console.log('');
    });
    
    // Find the user with the most records (likely the admin)
    const sortedUsers = Object.entries(userStats)
      .map(([userId, stats]) => ({
        userId,
        total: stats.leads + stats.opportunities,
        ...stats
      }))
      .sort((a, b) => b.total - a.total);
    
    if (sortedUsers.length > 0) {
      const likelyAdmin = sortedUsers[0];
      console.log('🎯 LIKELY ADMIN USER:');
      console.log(`User ID: ${likelyAdmin.userId}`);
      console.log(`Total Records: ${likelyAdmin.total} (${likelyAdmin.leads} leads, ${likelyAdmin.opportunities} opportunities)`);
      console.log(`First Activity: ${likelyAdmin.firstSeen}`);
      
      return likelyAdmin.userId;
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
}

findAdminUser();
