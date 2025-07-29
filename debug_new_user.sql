-- Debug script for new user access control
-- Replace 'user2_public_id' with the actual public ID of user 2

-- 1. Check all users and their roles
SELECT 
    id,
    email,
    raw_user_meta_data->>'role' as role,
    created_at
FROM auth.users 
ORDER BY created_at DESC;

-- 2. Check access control relationships
SELECT 
    ac.id,
    u1.email as user_email,
    u2.email as has_access_to_email,
    ac.granted_at,
    ac.granted_by
FROM access_control ac
JOIN auth.users u1 ON ac.user_id = u1.id
JOIN auth.users u2 ON ac.has_access_to = u2.id
ORDER BY ac.granted_at DESC;

-- 3. Check pending access requests
SELECT 
    par.id,
    u1.email as requester_email,
    u2.email as target_email,
    par.status,
    par.created_at
FROM pending_access_requests par
JOIN auth.users u1 ON par.requester_id = u1.id
JOIN auth.users u2 ON par.target_user_id = u2.id
ORDER BY par.created_at DESC;

-- 4. Check all leads and their creators
SELECT 
    l.id,
    l.name,
    u.email as created_by_email,
    l.created_at
FROM leads l
JOIN auth.users u ON l.user_id = u.id
ORDER BY l.created_at DESC;

-- 5. Check all opportunities and their creators
SELECT 
    o.id,
    o.name,
    u.email as created_by_email,
    o.created_at
FROM opportunities o
JOIN auth.users u ON o.user_id = u.id
ORDER BY o.created_at DESC;
