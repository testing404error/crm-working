-- Simple step-by-step debug - run these one at a time

-- Step 1: Check access control table
SELECT 
    ac.id,
    ac.user_id as data_owner_public_id,
    ac.granted_to_user_id as granted_to_public_id,
    ac.granted_at
FROM access_control ac
ORDER BY ac.granted_at DESC;
