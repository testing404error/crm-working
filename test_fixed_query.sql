-- Test the fixed access control query
-- This tests what the accessControlService should return

WITH target_user_public_id AS (
    SELECT id FROM users WHERE auth_user_id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645'
)
SELECT 
    'Fixed Access Control Query Test' as test_name,
    ac.user_id,
    u.auth_user_id,
    u.role,
    u.name,
    u.email
FROM access_control ac
JOIN users u ON u.id = ac.user_id
WHERE ac.granted_to_user_id = (SELECT id FROM target_user_public_id);
