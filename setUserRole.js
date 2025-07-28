import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL || 'your-supabase-url',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function setUserRole(email, role) {
  try {
    console.log(`Setting role for user ${email} to ${role}...`);
    
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
    
    console.log(`Found user: ${user.id}`);
    
    // Update user metadata to set role
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        role: role
      }
    });
    
    if (error) {
      console.error('Error updating user role:', error);
      return;
    }
    
    console.log(`✅ Successfully set role for ${email} to ${role}`);
    console.log('Updated user:', data.user);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Usage
const userEmail = process.argv[2];
const userRole = process.argv[3] || 'admin';

if (!userEmail) {
  console.log('Usage: node setUserRole.js <email> [role]');
  console.log('Example: node setUserRole.js pandeyankit54562@gmail.com admin');
  process.exit(1);
}

setUserRole(userEmail, userRole);
