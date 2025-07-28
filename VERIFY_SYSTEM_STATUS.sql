-- ============================================
-- SYSTEM STATUS VERIFICATION SCRIPT
-- Run this in your Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Verify that user_permissions table exists and has data
SELECT 'Checking user_permissions table...' as step;
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN can_view_other_users_data = true THEN 1 END) as users_with_permission
FROM user_permissions;

-- 2. Check all users in the system and their roles
SELECT 'Checking users and their roles...' as step;
SELECT 
    id,
    email,
    raw_user_meta_data->>'role' as role,
    raw_user_meta_data->>'first_name' as first_name,
    raw_user_meta_data->>'last_name' as last_name,
    created_at
FROM auth.users
ORDER BY created_at;

-- 3. Check user permissions for each user
SELECT 'Checking user permissions status...' as step;
SELECT 
    u.id as user_id,
    u.email,
    u.raw_user_meta_data->>'role' as role,
    COALESCE(up.can_view_other_users_data, false) as can_view_other_users_data,
    up.granted_by,
    up.created_at as permission_created_at
FROM auth.users u
LEFT JOIN user_permissions up ON u.id = up.user_id
ORDER BY u.email;

-- 4. Check if the helper function works
SELECT 'Testing helper function...' as step;
-- This will test with the first user found
SELECT 
    u.id,
    u.email,
    user_can_view_other_users_data(u.id) as can_view_result
FROM auth.users u
LIMIT 3;

-- 5. Check RLS policies on user_permissions table
SELECT 'Checking RLS policies...' as step;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_permissions';

-- 6. Check if there are any assignee relationships
SELECT 'Checking assignee relationships...' as step;
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN raw_user_meta_data->>'role' = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN raw_user_meta_data->>'role' = 'assignee' THEN 1 END) as assignee_count,
    COUNT(CASE WHEN raw_user_meta_data->>'assigned_to' IS NOT NULL THEN 1 END) as users_with_assignment
FROM auth.users;

-- 7. Show sample assignee to admin relationships
SELECT 
    'Sample assignee relationships...' as step;
SELECT 
    u.email as assignee_email,
    u.raw_user_meta_data->>'assigned_to' as assigned_to_admin_id,
    admin_u.email as admin_email
FROM auth.users u
LEFT JOIN auth.users admin_u ON admin_u.id::text = u.raw_user_meta_data->>'assigned_to'
WHERE u.raw_user_meta_data->>'assigned_to' IS NOT NULL
LIMIT 5;

SELECT 'Verification complete!' as status;
