-- Debug script for new user access control
-- First check table structures

-- 1. Check access_control table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'access_control' 
ORDER BY ordinal_position;

-- 2. Check all users and their roles
SELECT 
    id,
    email,
    raw_user_meta_data->>'role' as role,
    created_at
FROM auth.users 
ORDER BY created_at DESC;

-- 3. Check access control relationships (using correct column names)
SELECT 
    ac.*
FROM access_control ac
ORDER BY ac.created_at DESC;

-- 4. Check pending access requests
SELECT 
    par.*
FROM pending_access_requests par
ORDER BY par.created_at DESC;

-- 5. Check all leads and their creators
SELECT 
    l.id,
    l.name,
    u.email as created_by_email,
    l.created_at
FROM leads l
JOIN auth.users u ON l.user_id = u.id
ORDER BY l.created_at DESC;

-- 6. Check all opportunities and their creators
SELECT 
    o.id,
    o.name,
    u.email as created_by_email,
    o.created_at
FROM opportunities o
JOIN auth.users u ON o.user_id = u.id
ORDER BY o.created_at DESC;
