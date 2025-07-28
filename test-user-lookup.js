import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function authenticateUser() {
  console.log('\n=== Authentication Required ===');
  const email = await askQuestion('Enter your email: ');
  const password = await askQuestion('Enter your password: ');
  
  console.log('\nAttempting to sign in...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    console.error('Authentication failed:', error.message);
    return null;
  }
  
  console.log('✅ Authentication successful!');
  console.log('User ID:', data.user.id);
  console.log('Email:', data.user.email);
  return data.user;
}

async function testLeadCreation(userId) {
  console.log('\n--- Attempting to create a test lead ---');
  
  const testLeadData = {
    name: 'Test Lead - ' + new Date().toLocaleTimeString(),
    email: 'testlead@example.com',
    phone: '+1234567890',
    company: 'Test Company',
    status: 'new',
    source: 'manual',
    assigned_to: userId, // Use the user ID from users table
    tags: ['test', 'demo'],
    notes: 'This is a test lead created to verify the system is working.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  console.log('Creating lead with data:', testLeadData);
  
  const { data: createdLead, error: leadError } = await supabase
    .from('leads')
    .insert([testLeadData])
    .select()
    .single();
  
  if (leadError) {
    console.error('❌ Failed to create lead:', {
      message: leadError.message,
      details: leadError.details,
      hint: leadError.hint,
      code: leadError.code
    });
  } else {
    console.log('✅ Successfully created lead:', createdLead);
    console.log('\n🎉 Lead creation test PASSED! The system is working correctly.');
  }
}

async function testUserLookup() {
  try {
    console.log('=== Testing User Lookup and Lead Creation ===');
    
    // First, authenticate the user
    const user = await authenticateUser();
    if (!user) {
      console.log('❌ Authentication failed. Cannot proceed with tests.');
      return;
    }
    
    // Test direct query to users table
    console.log('\n--- Testing direct users table query ---');
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('*');
    
    if (allUsersError) {
      console.error('Error fetching all users:', allUsersError);
    } else {
      console.log('All users in database:', allUsers);
    }
    
    // Test specific user lookup
    console.log('\n--- Testing specific user lookup ---');
    const { data: specificUser, error: specificError } = await supabase
      .from('users')
      .select('id, auth_user_id, name, email')
      .eq('auth_user_id', user.id)
      .single();
    
    if (specificError) {
      console.error('Specific user lookup error:', {
        message: specificError.message,
        details: specificError.details,
        hint: specificError.hint,
        code: specificError.code
      });
    } else {
      console.log('Found user:', specificUser);
    }
    
    // Test with maybeSingle() instead of single()
    console.log('\n--- Testing with maybeSingle() ---');
    const { data: maybeSingleUser, error: maybeSingleError } = await supabase
      .from('users')
      .select('id, auth_user_id, name, email')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    
    if (maybeSingleError) {
      console.error('MaybeSingle user lookup error:', maybeSingleError);
    } else {
      console.log('MaybeSingle result:', maybeSingleUser);
      
      // If user doesn't exist in users table, create one
      if (!maybeSingleUser) {
        console.log('\n--- User not found in users table. Creating user record ---');
        
        const newUserData = {
          auth_user_id: user.id,
          name: user.email.split('@')[0], // Use email prefix as default name
          email: user.email,
          role: 'user', // Default role
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        console.log('Creating user with data:', newUserData);
        
        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .insert([newUserData])
          .select()
          .single();
        
        if (createError) {
          console.error('Failed to create user:', createError);
        } else {
          console.log('✅ Successfully created user:', createdUser);
          
          // Test lead creation with the newly created user
          console.log('\n--- Testing lead creation with new user ---');
          await testLeadCreation(createdUser.id);
        }
      } else {
        console.log('\n--- User exists, testing lead creation ---');
        await testLeadCreation(maybeSingleUser.id);
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the test and cleanup
testUserLookup().finally(() => {
  rl.close();
  process.exit(0);
});
