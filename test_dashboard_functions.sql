-- Test all dashboard functions to verify they work correctly

-- 1. Test dashboard stats function
SELECT 'Testing get_dashboard_stats:' as test;
SELECT * FROM public.get_dashboard_stats();

-- 2. Test lead source data function
SELECT 'Testing get_lead_source_data_ultimate:' as test;
SELECT * FROM public.get_lead_source_data_ultimate();

-- 3. Test pipeline data function
SELECT 'Testing get_pipeline_data_ultimate:' as test;
SELECT * FROM public.get_pipeline_data_ultimate();

-- 4. Test top opportunities function
SELECT 'Testing get_top_opportunities_simple:' as test;
SELECT * FROM public.get_top_opportunities_simple();

-- 5. Test access control function
SELECT 'Testing get_accessible_user_ids:' as test;
SELECT public.get_accessible_user_ids(auth.uid()) as accessible_user_ids;

-- 6. Show current user info
SELECT 'Current user info:' as test;
SELECT auth.uid() as current_user_id, 
       (SELECT email FROM auth.users WHERE id = auth.uid()) as email,
       (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) as role;
