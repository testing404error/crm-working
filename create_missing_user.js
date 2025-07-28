import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.log('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createMissingUser() {
  try {
    console.log('🔍 Creating missing user record...');
    
    // The user details from your console logs
    const authUserId = 'a9b32c60-dfdf-42c0-9ea3-1ecd5a16959f';
    const userEmail = 'pandeyankit54562@gmail.com';
    
    // First, check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();
    
    if (existingUser) {
      console.log('✅ User already exists:', existingUser);
      return;
    }
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking existing user:', checkError);
      return;
    }
    
    // Create the missing user record
    const userData = {
      auth_user_id: authUserId,
      email: userEmail,
      name: userEmail.split('@')[0], // Use email prefix as name
      role: 'user', // Default role
      status: 'Active', // Use correct status column
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Error creating user:', createError);
      return;
    }
    
    console.log('✅ Successfully created user record:');
    console.log('ID:', newUser.id);
    console.log('Auth User ID:', newUser.auth_user_id);
    console.log('Email:', newUser.email);
    console.log('Name:', newUser.name);
    console.log('Role:', newUser.role);
    
    // Verify the user can be found
    const { data: verifyUser, error: verifyError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
    } else {
      console.log('✅ User lookup verification successful:', verifyUser);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createMissingUser();
