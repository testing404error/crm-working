-- ================================================
-- Automatic Role Assignment Based on Signup Form Selection
-- ================================================

-- 1. Drop the old trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create a new function to handle role assignment from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_with_role() 
RETURNS TRIGGER AS $$
BEGIN
  -- Insert user role based on the role selected during signup
  -- The role will be stored in user_metadata by the signup process
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE 
      -- Check if role is provided in raw_user_meta_data (from signup form)
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
      WHEN NEW.raw_user_meta_data->>'role' = 'manager' THEN 'admin'  -- Managers get admin privileges
      -- All other roles become regular users
      ELSE 'user'
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger to automatically assign roles on user signup
CREATE TRIGGER on_auth_user_created_with_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_with_role();

-- 4. Update existing users to have roles based on their current metadata (if any)
-- Set default roles for existing users who don't have roles yet
INSERT INTO public.user_roles (user_id, role)
SELECT 
  id,
  CASE 
    -- Check existing metadata for role
    WHEN raw_user_meta_data->>'role' = 'admin' THEN 'admin'
    WHEN raw_user_meta_data->>'role' = 'manager' THEN 'admin'
    -- Default to user for everyone else
    ELSE 'user'
  END
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id) DO NOTHING;

-- 5. Update your current user to admin (replace with your actual email)
UPDATE public.user_roles 
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'ankurmishrq575@gmail.com'  -- Replace with your actual email
);

-- If your user doesn't have a role record yet, create one
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users 
WHERE email = 'ankurmishrq575@gmail.com'  -- Replace with your actual email
  AND id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- 6. Create a function to manually update roles (for admin use)
CREATE OR REPLACE FUNCTION public.update_user_role_by_admin(target_user_email TEXT, new_role TEXT)
RETURNS VOID AS $$
DECLARE
  target_user_id UUID;
  admin_user_id UUID;
BEGIN
  -- Get current user ID (the one calling this function)
  admin_user_id := auth.uid();
  
  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;
  
  -- Get target user ID
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = target_user_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', target_user_email;
  END IF;
  
  -- Update the role
  UPDATE public.user_roles 
  SET role = new_role
  WHERE user_id = target_user_id;
  
  IF NOT FOUND THEN
    -- If no role record exists, create one
    INSERT INTO public.user_roles (user_id, role) 
    VALUES (target_user_id, new_role);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Verify the setup
SELECT 
    u.email,
    u.raw_user_meta_data->>'role' as signup_role,
    u.raw_user_meta_data->>'name' as name,
    ur.role as assigned_role,
    u.created_at
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at;

-- Success message
SELECT 'Role assignment now based on signup form selection!' AS status;
