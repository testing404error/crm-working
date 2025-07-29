-- Fix the missing access control relationship
-- This creates the relationship that should exist based on the accepted request

-- From the accepted requests, we know:
-- Request ID: 3505a29b-f3cb-4b24-8373-0e9dd41f4524
-- Admin (requester): 5110da6f-b086-4fdd-9474-f8fae28c56b4 → public ID: b2801760-8e17-46aa-a127-daaa9f288778
-- User (receiver): 2bca8ace-3204-44aa-b581-6bfa8f1c2645 → public ID: a341254f-ea31-4193-89ca-d1252376b459

-- The user should have access to admin's data, so:
-- user_id = admin's public ID (data owner)
-- granted_to_user_id = user's public ID (who gets access)

INSERT INTO access_control (user_id, granted_to_user_id, granted_at)
VALUES (
    'b2801760-8e17-46aa-a127-daaa9f288778',  -- Admin's data (admin public ID)
    'a341254f-ea31-4193-89ca-d1252376b459',  -- User who gets access (user 1 public ID)
    '2025-07-29 07:29:25.915344+00'          -- When the request was accepted
)
ON CONFLICT (user_id, granted_to_user_id) DO NOTHING;

-- Verify the fix
SELECT 'After Fix - User Should Now Have Access To:' as verification;

SELECT 
    ac.user_id as can_access_data_from,
    u.name as data_owner_name,
    u.email as data_owner_email,
    u.role as data_owner_role,
    ac.granted_at
FROM access_control ac
JOIN users u ON u.id = ac.user_id
WHERE ac.granted_to_user_id = 'a341254f-ea31-4193-89ca-d1252376b459'
ORDER BY ac.granted_at DESC;
