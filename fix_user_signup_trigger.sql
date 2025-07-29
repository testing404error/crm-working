-- =====================================================
-- FIX USER SIGNUP TRIGGER
-- This script creates a proper trigger to handle new user signup
-- =====================================================

-- 1. Drop existing triggers and functions that might conflict
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

-- 5. Ensure the trigger function has proper permissions
-- Allow the function to insert into users table
GRANT INSERT ON public.users TO service_role;

-- 6. Create any missing users for existing auth users
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

-- 7. Verify the setup
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

-- Success message
SELECT 'User signup trigger fixed! New users will automatically get records in public.users table.' AS status;
