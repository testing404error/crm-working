-- ================================================
-- Set Current User as Admin
-- ================================================

-- First, let's see all users in the system
SELECT id, email, created_at FROM auth.users;

-- Set the first user (you) as admin - replace with your actual user ID
-- You can get your user ID from the query above
INSERT INTO public.user_roles (user_id, role) 
SELECT id, 'admin' 
FROM auth.users 
WHERE email = 'ankurmishrq575@gmail.com'  -- Replace with your actual email
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Verify the admin user was set
SELECT u.email, ur.role 
FROM auth.users u 
JOIN public.user_roles ur ON u.id = ur.user_id;

-- Success message
SELECT 'Admin user has been set!' AS status;
