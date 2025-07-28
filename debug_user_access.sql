-- ================================================
-- Debug User Access and Roles
-- ================================================

-- 1. Check all users and their roles
SELECT 
    u.id,
    u.email,
    u.created_at,
    ur.role,
    u.raw_user_meta_data->>'name' as signup_name,
    u.raw_user_meta_data->>'role' as signup_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at;

-- 2. Check current user's info
SELECT 
    'Current user info:' as section,
    u.email,
    ur.role,
    u.id as user_id
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.id = auth.uid();

-- 3. Check leads and their owners
SELECT 
    'Leads data:' as section,
    l.id,
    l.name,
    l.assigned_to,
    u.email as owner_email,
    ur.role as owner_role
FROM public.leads l
LEFT JOIN auth.users u ON l.user_id = u.id
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY l.created_at DESC
LIMIT 10;

-- 4. Check opportunities and their owners
SELECT 
    'Opportunities data:' as section,
    o.id,
    o.name,
    o.assigned_to,
    u.email as owner_email,
    ur.role as owner_role
FROM public.opportunities o
LEFT JOIN auth.users u ON o.user_id = u.id
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY o.created_at DESC
LIMIT 10;

-- 5. Check what the current user can see (with RLS enabled)
SELECT 'What current user can see:' as section;

-- Re-enable RLS to test
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Test current user's access
SELECT 
    'Leads visible to current user:' as type,
    COUNT(*) as count
FROM public.leads;

SELECT 
    'Opportunities visible to current user:' as type,
    COUNT(*) as count
FROM public.opportunities;

-- 6. Check RLS policies
SELECT 
    'RLS Policies:' as section,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('leads', 'opportunities')
ORDER BY tablename, policyname;
