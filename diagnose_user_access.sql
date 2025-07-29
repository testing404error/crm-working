-- Diagnose user authentication and access control issues

-- Check current authenticated user
SELECT 
    'Current auth.uid()' as check_type,
    auth.uid() as value;

-- Check if current user exists in users table
SELECT 
    'User record exists' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid()) 
        THEN 'YES' 
        ELSE 'NO' 
    END as value;

-- Get current user's details from users table
SELECT 
    'Current user details' as check_type,
    json_build_object(
        'id', id,
        'name', name,
        'email', email,
        'role', role,
        'auth_user_id', auth_user_id
    ) as value
FROM public.users 
WHERE auth_user_id = auth.uid();

-- Check what user_id would be used for INSERT policy
SELECT 
    'Policy would allow user_ids' as check_type,
    array_agg(id) as value
FROM public.users 
WHERE auth_user_id = auth.uid();

-- Show all users for reference
SELECT 
    'All users in system' as check_type,
    json_agg(json_build_object(
        'id', id,
        'name', name,
        'email', email,
        'auth_user_id', auth_user_id
    )) as value
FROM public.users;
