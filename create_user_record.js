import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Using service role key for admin operations
);

async function createUserRecord() {
  try {
    const email = 'pandeyankit54562@gmail.com';
    
    console.log('🔍 Checking for existing user record...');
    
    // First, get the auth user ID from Supabase Auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    const authUser = authUsers.users.find(user => user.email === email);
    
    if (!authUser) {
      console.error('❌ Auth user not found for email:', email);
      return;
    }
    
    console.log('✅ Found auth user:', {
      id: authUser.id,
      email: authUser.email,
      created_at: authUser.created_at
    });
    
    // Check if user record already exists in public.users
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('❌ Error checking existing user:', checkError);
      return;
    }
    
    if (existingUser) {
      console.log('✅ User record already exists:', existingUser);
      return;
    }
    
    console.log('📝 Creating new user record...');
    
    // Create the user record
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.name || authUser.email.split('@')[0],
        role: 'user', // Default role
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Error creating user record:', createError);
      return;
    }
    
    console.log('✅ Successfully created user record:', newUser);
    
    // Test the lead creation lookup to verify it works now
    console.log('🧪 Testing user lookup...');
    
    const { data: userLookup, error: lookupError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('auth_user_id', authUser.id)
      .single();
    
    if (lookupError) {
      console.error('❌ User lookup still failing:', lookupError);
    } else {
      console.log('✅ User lookup successful:', userLookup);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createUserRecord();
