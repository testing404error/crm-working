-- Debug script for new user access control - final version

-- 1. Check access_control table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'access_control' 
ORDER BY ordinal_position;

-- 2. Check all users and their roles (without emails)
SELECT 
    id,
    raw_user_meta_data->>'role' as role,
    created_at
FROM auth.users 
ORDER BY created_at DESC;

-- 3. Check access control relationships (using correct column names)
SELECT 
    ac.*
FROM access_control ac
ORDER BY ac.granted_at DESC;

-- 4. Check pending access requests
SELECT 
    par.*
FROM pending_access_requests par
ORDER BY par.created_at DESC;

-- 5. Check all leads and their creators (without emails)
SELECT 
    l.id,
    l.name,
    l.user_id as created_by_user_id,
    l.created_at
FROM leads l
ORDER BY l.created_at DESC;

-- 6. Check all opportunities and their creators (without emails)
SELECT 
    o.id,
    o.name,
    o.user_id as created_by_user_id,
    o.created_at
FROM opportunities o
ORDER BY o.created_at DESC;
