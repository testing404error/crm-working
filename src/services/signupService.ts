import { supabase } from '../lib/supabaseClient';
import { User } from '../types';

// User Signup Service
// Handles new user registrations and sets initial roles

/**
 * Register a new user with given information
 * Ensures the user is NOT added to the assignee list automatically
 */
export const registerUser = async (name: string, email: string, password: string): Promise<User> => {
  try {
    // Create the user in auth
    const { user, error: signupError } = await supabase.auth.signUp({ email, password });
    if (signupError) throw new Error(`Signup failed: ${signupError.message}`);

    // Insert user profile in the users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .insert([{ id: user?.id, name, email, role: 'user', status: 'Active' }])
      .select()
      .single();

    if (profileError) throw new Error(`User profile creation failed: ${profileError.message}`);

    console.log('✅ User registered successfully, not added to assignee automatically');
    return { ...userProfile, email };
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

// Ensure new users are only added to assignees through admin management

/**
 * Assign user to an admin's data manually
 * Called by admin to set user as an assignee
 */
export const assignUserToAdmin = async (adminId: string, userId: string) => {
  try {
    const { error } = await supabase
      .from('access_control')
      .insert([{ user_id: adminId, granted_to_user_id: userId }])
      .single();

    if (error) throw new Error(`Assigning user to admin failed: ${error.message}`);
    console.log(`✅ User ${userId} assigned to admin ${adminId}`);
  } catch (error) {
    console.error('Error assigning user to admin:', error);
    throw error;
  }
};
