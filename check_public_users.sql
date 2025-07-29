-- Check what's in the public.users table
SELECT 'Public Users' as check_type, id, auth_user_id, email, name, role, created_at
FROM public.users 
ORDER BY created_at DESC;

-- Check specifically for the auth_user_id we're looking for
SELECT 'Target User Check' as check_type, id, auth_user_id, email, name
FROM public.users 
WHERE auth_user_id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645';
