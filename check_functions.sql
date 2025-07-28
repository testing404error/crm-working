-- Check what functions exist in the database
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%dashboard%' 
  OR p.proname LIKE '%lead%'
  OR p.proname LIKE '%opportunity%'
  OR p.proname LIKE '%pipeline%'
  OR p.proname LIKE '%admin%'
ORDER BY p.proname;

-- Also check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('users', 'leads', 'opportunities', 'customers')
ORDER BY tablename, policyname;
