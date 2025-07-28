// debug-roles.mjs
import supabase from './supabaseClient.js';

async function debugRoles() {
  try {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, role');

    if (userError) throw userError;

    const { data: leads, error: leadError } = await supabase
      .from('leads')
      .select('id, created_by');

    if (leadError) throw leadError;

    users.forEach(user => {
      console.log(`User: ${user.email}, Role: ${user.role}`);
    });

    leads.forEach(lead => {
      console.log(`Lead ID: ${lead.id}, Created By: ${lead.created_by}`);
    });

  } catch (err) {
    console.error('Error fetching data:', err);
  }
}

debugRoles();