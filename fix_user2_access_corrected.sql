-- Fix User 2's access control relationship
-- The relationship is currently backwards - User 2 gave Admin access instead of getting access to Admin

-- First, let's delete the incorrect relationship where User 2 gave Admin access
DELETE FROM access_control 
WHERE user_id = '19ac44c1-52b4-46c4-9371-f832f417bd7f' 
AND granted_to_user_id = 'b2801760-8e17-46aa-a127-daaa9f288778';

-- Now create the correct relationship - User 2 should have access to Admin's data
INSERT INTO access_control (user_id, granted_to_user_id, granted_at)
VALUES (
    'b2801760-8e17-46aa-a127-daaa9f288778', -- Admin's data
    '19ac44c1-52b4-46c4-9371-f832f417bd7f', -- User 2 gets access
    NOW()
);

-- Verify the fix
SELECT 
    ac.id,
    ac.user_id as data_owner,
    ac.granted_to_user_id as access_granted_to,
    ac.granted_at
FROM access_control ac
WHERE ac.user_id = 'b2801760-8e17-46aa-a127-daaa9f288778' 
   OR ac.granted_to_user_id = '19ac44c1-52b4-46c4-9371-f832f417bd7f'
ORDER BY ac.granted_at DESC;
