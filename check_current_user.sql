-- Check current user authentication status

SELECT auth.uid() as current_auth_uid;

SELECT 
    id,
    name,
    email,
    auth_user_id
FROM public.users 
WHERE auth_user_id = auth.uid();
