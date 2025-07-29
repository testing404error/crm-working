-- Debug script for User 3 access control and revoke functionality

-- 1. Check all users (newest first)
SELECT 
    id,
    raw_user_meta_data->>'role' as role,
    created_at
FROM auth.users 
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check all access control relationships (newest first)
SELECT 
    ac.id,
    ac.user_id as data_owner,
    ac.granted_to_user_id as access_granted_to,
    ac.granted_at
FROM access_control ac
ORDER BY ac.granted_at DESC;

-- 3. Check all pending access requests (newest first)
SELECT 
    par.id,
    par.requester_id,
    par.receiver_id,
    par.status,
    par.created_at,
    par.updated_at
FROM pending_access_requests par
ORDER BY par.created_at DESC;

-- 4. Check if User 3 has any access relationships
-- Replace 'USER_3_ID' with the actual User 3 ID when you get it from query 1
-- SELECT 
--     ac.id,
--     ac.user_id as data_owner,
--     ac.granted_to_user_id as access_granted_to,
--     ac.granted_at
-- FROM access_control ac
-- WHERE ac.granted_to_user_id = 'USER_3_ID' 
--    OR ac.user_id = 'USER_3_ID';

-- 5. Test dashboard function for current user
SELECT * FROM get_dashboard_stats();

-- 6. Test lead source function for current user
SELECT * FROM get_lead_source_data_ultimate();

-- Success message
SELECT 'Debug queries completed - check the results above' as status;
