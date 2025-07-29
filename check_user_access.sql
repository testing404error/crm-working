-- Check what access the target user (user 1) has

-- Target user: a341254f-ea31-4193-89ca-d1252376b459 (auth: 2bca8ace-3204-44aa-b581-6bfa8f1c2645)
-- Admin user: b2801760-8e17-46aa-a127-daaa9f288778 (auth: 5110da6f-b086-4fdd-9474-f8fae28c56b4)

SELECT 'Target User Should Have Access To:' as check_name;

SELECT 
    ac.user_id as can_access_data_from,
    u.name as data_owner_name,
    u.email as data_owner_email,
    u.role as data_owner_role
FROM access_control ac
JOIN users u ON u.id = ac.user_id
WHERE ac.granted_to_user_id = 'a341254f-ea31-4193-89ca-d1252376b459';

-- This should show that user 1 has access to admin's data, but currently it doesn't!
