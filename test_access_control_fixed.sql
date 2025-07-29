-- Test script to verify access control is working
-- Run this to confirm the fix was successful

-- 1. Check if access_control table exists and has proper structure
SELECT 'access_control table structure:' as test;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'access_control' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if function exists and works
SELECT 'Testing get_accessible_user_ids function:' as test;
SELECT public.get_accessible_user_ids(auth.uid()) as accessible_user_ids;

-- 3. Check table permissions
SELECT 'access_control table permissions:' as test;
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'access_control' AND table_schema = 'public';

-- 4. Check RLS policies
SELECT 'access_control RLS policies:' as test;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'access_control';

-- 5. Test basic functionality (this should work without errors)
SELECT 'Testing basic access_control operations:' as test;
SELECT COUNT(*) as current_access_control_records FROM public.access_control;
