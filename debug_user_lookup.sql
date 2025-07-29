-- Debug script to check user ID lookup
-- Run this in Supabase SQL Editor to understand the issue

-- Check if the receiver_id exists in public.users table
SELECT 'Public Users Check' as check_type, id, auth_user_id, email, name
FROM public.users 
WHERE id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645';

-- Check if the receiver_id exists as auth_user_id in public.users table
SELECT 'Auth User ID Check' as check_type, id, auth_user_id, email, name
FROM public.users 
WHERE auth_user_id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645';

-- List all users to see what IDs we actually have
SELECT 'All Users' as check_type, id, auth_user_id, email, name, role
FROM public.users 
ORDER BY created_at DESC;

-- Check auth.users to see what auth user IDs exist
SELECT 'Auth Users' as check_type, id, email, created_at
FROM auth.users
ORDER BY created_at DESC;
