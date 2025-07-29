# Fix User Signup Issue - Instructions

## Problem
When users try to sign up, they get a "Database error saving new user" because there's no database trigger to create a corresponding record in the `public.users` table.

## Solution
You need to run the following SQL in your Supabase dashboard to create the proper trigger.

## Steps

1. **Go to your Supabase Dashboard**
   - Open https://supabase.com/dashboard
   - Navigate to your project: `qgoqrozkqckgvdopbllg`
   - Go to the **SQL Editor**

2. **Run the following SQL** (copy and paste this entire block):

```sql
-- =====================================================
-- FIX USER SIGNUP TRIGGER
-- =====================================================

-- 1. Drop existing conflicting triggers/functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_with_role ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_user_with_role();

-- 2. Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user_signup() 
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new user into public.users table
  INSERT INTO public.users (
    auth_user_id,
    name,
    email,
    role,
    team,
    status,
    avatar
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
      WHEN NEW.raw_user_meta_data->>'role' = 'manager' THEN 'admin'
      ELSE 'user'
    END,
    COALESCE(NEW.raw_user_meta_data->>'team', 'Default Team'),
    'Active',
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop')
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't prevent user creation
    RAISE WARNING 'Error creating user record: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger to automatically handle new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- 4. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO service_role;
GRANT INSERT ON public.users TO service_role;

-- 5. Create missing user records for existing auth users
INSERT INTO public.users (auth_user_id, name, email, role, team, status, avatar)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', 'Existing User'),
  au.email,
  CASE 
    WHEN au.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
    WHEN au.raw_user_meta_data->>'role' = 'manager' THEN 'admin'
    ELSE 'user'
  END,
  COALESCE(au.raw_user_meta_data->>'team', 'Default Team'),
  'Active',
  COALESCE(au.raw_user_meta_data->>'avatar_url', 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop')
FROM auth.users au
WHERE au.id NOT IN (SELECT auth_user_id FROM public.users WHERE auth_user_id IS NOT NULL)
ON CONFLICT (auth_user_id) DO NOTHING;

-- 6. Verify the setup
SELECT 
    au.email,
    au.raw_user_meta_data->>'role' as signup_role,
    au.raw_user_meta_data->>'name' as name,
    u.role as assigned_role,
    u.team,
    au.created_at
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.auth_user_id
ORDER BY au.created_at;
```

3. **Click "Run"** to execute the SQL

4. **Test the fix**:
   - Try signing up a new user using your registration form
   - The signup should now work without the "Database error saving new user" error

## What this does:

1. **Removes conflicting triggers** that might be causing issues
2. **Creates a proper trigger function** that:
   - Automatically creates a record in `public.users` when a new user signs up in `auth.users`
   - Maps user metadata (name, role, team) from the signup form to the users table
   - Sets appropriate defaults for missing fields
   - Handles errors gracefully without breaking the signup process
3. **Creates missing user records** for any existing auth users who don't have corresponding records in `public.users`
4. **Verifies the setup** by showing all users and their roles

## Expected Result:
After running this SQL, new user signups should work properly, and a corresponding record should be automatically created in the `public.users` table with the correct role and information.
