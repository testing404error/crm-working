-- ================================================
-- Automatic Role Assignment System
-- ================================================

-- 1. Create a function to automatically assign roles based on email
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  -- Insert user role based on email
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE 
      -- Admin emails (replace with your actual admin emails)
      WHEN NEW.email IN (
        'ankurmishrq575@gmail.com',
      ) THEN 'admin'
      
      -- Admin domain (optional - if you have a specific admin domain)
      WHEN NEW.email LIKE '%@admin.firstmoversai.com' THEN 'admin'
      
      -- All other users are regular users
      ELSE 'user'
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger to automatically assign roles on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Set existing users with roles (one-time setup)
-- This will assign roles to users who signed up before this system was in place

-- First, assign your current user as admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users 
WHERE email IN (
  'ankurmishrq575@gmail.com',
)
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Assign all other existing users as regular users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id) DO UPDATE SET role = 'user';

-- 4. Create a function to update role assignment rules (optional)
CREATE OR REPLACE FUNCTION public.update_user_role(user_email TEXT, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_roles 
  SET role = new_role
  WHERE user_id = (SELECT id FROM auth.users WHERE email = user_email);
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Verify the setup
SELECT 
    u.email,
    ur.role,
    u.created_at
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at;

-- Success message
SELECT 'Automatic role assignment system has been set up!' AS status;
