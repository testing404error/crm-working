import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL || 'your-supabase-url',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function findUserId(email) {
  try {
    console.log(`Looking for user with email: ${email}...`);
    
    // Get user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }
    
    const user = users.find(u => u.email === email);
    
    if (!user) {
      console.error(`User with email ${email} not found`);
      return;
    }
    
    console.log(`✅ Found user:`);
    console.log(`Email: ${user.email}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Role: ${user.user_metadata?.role || 'No role set'}`);
    console.log(`Created: ${user.created_at}`);
    
    return user.id;
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Usage
const userEmail = process.argv[2];

if (!userEmail) {
  console.log('Usage: node findUserId.js <email>');
  console.log('Example: node findUserId.js ankurmishrq575@gmail.com');
  process.exit(1);
}

findUserId(userEmail);
