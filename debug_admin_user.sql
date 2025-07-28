-- Debug script to check admin user detection issues
-- Run these queries in your Supabase SQL editor to diagnose the problem

-- 1. Check if the known admin email exists in profiles table
SELECT 'Checking profiles table for admin user' as step;
SELECT id, email, name, created_at 
FROM profiles 
WHERE email = 'ankurmishrq575@gmail.com';

-- 2. Check all profiles to see what's in the table
SELECT 'All profiles in the table' as step;
SELECT id, email, name, created_at 
FROM profiles 
ORDER BY created_at DESC;

-- 3. Check user_permissions table for any permissions granted by users
SELECT 'Checking user_permissions table' as step;
SELECT granted_by, user_id, can_view_other_users_data, created_at
FROM user_permissions 
WHERE granted_by IS NOT NULL;

-- 4. Check assignee_relationships table
SELECT 'Checking assignee_relationships table' as step;
SELECT user_id, assignee_id, created_at
FROM assignee_relationships;

-- 5. Check assignee_users table
SELECT 'Checking assignee_users table' as step;
SELECT id, email, name, created_at
FROM assignee_users;

-- 6. Check auth.users table for the admin user (if you have access)
-- Note: This might not be accessible depending on your RLS policies
SELECT 'Checking auth.users for admin email' as step;
SELECT id, email, raw_user_meta_data
FROM auth.users 
WHERE email = 'ankurmishrq575@gmail.com';

-- 7. Check leads and opportunities to see which users have data
SELECT 'Users with leads data' as step;
SELECT DISTINCT user_id, COUNT(*) as lead_count
FROM leads 
GROUP BY user_id
ORDER BY lead_count DESC;

SELECT 'Users with opportunities data' as step;
SELECT DISTINCT user_id, COUNT(*) as opp_count
FROM opportunities 
GROUP BY user_id
ORDER BY opp_count DESC;
