-- Test script to verify the fixes are working correctly

-- 1. Test access_control table exists and has data
SELECT 'Access Control Table Test:' as test;
SELECT COUNT(*) as access_control_records FROM public.access_control;

-- 2. Test get_accessible_user_ids function works
SELECT 'Function Test:' as test;
SELECT public.get_accessible_user_ids(auth.uid()) as my_accessible_user_ids;

-- 3. Test leads table visibility
SELECT 'Leads Visibility Test:' as test;
SELECT COUNT(*) as visible_leads FROM public.leads;

-- 4. Test opportunities table visibility
SELECT 'Opportunities Visibility Test:' as test;
SELECT COUNT(*) as visible_opportunities FROM public.opportunities;

-- 5. Test activities table visibility
SELECT 'Activities Visibility Test:' as test;
SELECT COUNT(*) as visible_activities FROM public.activities;

-- 6. Test RLS policies exist
SELECT 'RLS Policies Test:' as test;
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('leads', 'opportunities', 'activities', 'access_control')
ORDER BY tablename, policyname;
