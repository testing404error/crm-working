-- Comprehensive Access Control Debug Script
-- Run this in Supabase SQL Editor to diagnose why user can't see admin's data

-- ===========================================
-- 1. CHECK USER DATA STRUCTURE
-- ===========================================

SELECT '=== 1. USER TABLE STRUCTURE ===' as debug_section;

-- Check what's in the users table
SELECT 
    'Users Table Content' as step,
    id as public_user_id,
    auth_user_id,
    email,
    role,
    created_at
FROM users
ORDER BY created_at;

-- ===========================================
-- 2. CHECK ACCESS CONTROL RELATIONSHIPS  
-- ===========================================

SELECT '=== 2. ACCESS CONTROL RELATIONSHIPS ===' as debug_section;

-- Show all access control relationships
SELECT 
    'Access Control Table' as step,
    ac.id,
    ac.user_id as data_owner_public_id,
    ac.granted_to_user_id as granted_to_public_id,
    ac.granted_at,
    owner.email as owner_email,
    owner.role as owner_role,
    grantee.email as grantee_email,
    grantee.role as grantee_role
FROM access_control ac
LEFT JOIN users owner ON owner.id = ac.user_id
LEFT JOIN users grantee ON grantee.id = ac.granted_to_user_id
ORDER BY ac.granted_at DESC;

-- ===========================================
-- 3. FOCUS ON SPECIFIC USER
-- ===========================================

SELECT '=== 3. SPECIFIC USER ANALYSIS ===' as debug_section;

-- Target user: auth_user_id = 2bca8ace-3204-44aa-b581-6bfa8f1c2645
-- Admin user: auth_user_id = 5110da6f-b086-4fdd-9474-f8fae28c56b4

-- Get public IDs for both users
WITH user_mapping AS (
    SELECT 
        'Target User' as user_type,
        id as public_id,
        auth_user_id,
        email,
        role
    FROM users 
    WHERE auth_user_id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645'
    
    UNION ALL
    
    SELECT 
        'Admin User' as user_type,
        id as public_id,
        auth_user_id,
        email,
        role
    FROM users 
    WHERE auth_user_id = '5110da6f-b086-4fdd-9474-f8fae28c56b4'
)
SELECT * FROM user_mapping;

-- ===========================================
-- 4. CHECK ACCESS GRANTS FOR TARGET USER
-- ===========================================

SELECT '=== 4. ACCESS GRANTS FOR TARGET USER ===' as debug_section;

-- Check what access the target user has been granted
WITH target_user AS (
    SELECT id as public_id
    FROM users 
    WHERE auth_user_id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645'
)
SELECT 
    'Access Granted To Target User' as step,
    ac.user_id as can_access_data_from_user_id,
    owner.email as data_owner_email,
    owner.role as data_owner_role,
    owner.auth_user_id as data_owner_auth_id,
    ac.granted_at
FROM access_control ac
JOIN users owner ON owner.id = ac.user_id
WHERE ac.granted_to_user_id = (SELECT public_id FROM target_user);

-- ===========================================
-- 5. CHECK LEADS DATA
-- ===========================================

SELECT '=== 5. LEADS DATA ANALYSIS ===' as debug_section;

-- Check all leads and their creators
SELECT 
    'All Leads' as step,
    l.id,
    l.company_name,
    l.created_by as creator_public_id,
    creator.email as creator_email,
    creator.role as creator_role,
    creator.auth_user_id as creator_auth_id,
    l.created_at
FROM leads l
LEFT JOIN users creator ON creator.id = l.created_by
ORDER BY l.created_at DESC;

-- ===========================================
-- 6. SIMULATE ACCESS CONTROL LOGIC
-- ===========================================

SELECT '=== 6. ACCESS CONTROL SIMULATION ===' as debug_section;

-- Simulate what leads the target user should be able to see
WITH target_user AS (
    SELECT 
        id as public_id,
        auth_user_id,
        email
    FROM users 
    WHERE auth_user_id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645'
),
accessible_users AS (
    -- Own data
    SELECT 
        tu.public_id as accessible_user_id,
        'own_data' as access_type
    FROM target_user tu
    
    UNION
    
    -- Data from users who granted access via access_control
    SELECT 
        ac.user_id as accessible_user_id,
        'access_control_grant' as access_type
    FROM access_control ac
    JOIN target_user tu ON ac.granted_to_user_id = tu.public_id
    JOIN users owner ON owner.id = ac.user_id
    WHERE owner.role = 'admin'  -- Only from admin users
)
SELECT 
    'Users Target User Can Access' as step,
    au.accessible_user_id,
    au.access_type,
    u.email as accessible_user_email,
    u.role as accessible_user_role
FROM accessible_users au
LEFT JOIN users u ON u.id = au.accessible_user_id;

-- ===========================================
-- 7. FINAL LEADS VISIBILITY TEST
-- ===========================================

SELECT '=== 7. LEADS VISIBILITY TEST ===' as debug_section;

-- Show which leads the target user should see based on access control
WITH target_user AS (
    SELECT 
        id as public_id,
        auth_user_id,
        email
    FROM users 
    WHERE auth_user_id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645'
),
accessible_users AS (
    -- Own data
    SELECT tu.public_id as accessible_user_id
    FROM target_user tu
    
    UNION
    
    -- Data from users who granted access via access_control
    SELECT ac.user_id as accessible_user_id
    FROM access_control ac
    JOIN target_user tu ON ac.granted_to_user_id = tu.public_id
    JOIN users owner ON owner.id = ac.user_id
    WHERE owner.role = 'admin'
)
SELECT 
    'Lead Visibility Results' as step,
    l.id,
    l.company_name,
    l.created_by,
    creator.email as creator_email,
    creator.role as creator_role,
    CASE 
        WHEN l.created_by IN (SELECT accessible_user_id FROM accessible_users) 
        THEN '✅ SHOULD BE VISIBLE' 
        ELSE '❌ SHOULD NOT BE VISIBLE' 
    END as visibility_status
FROM leads l
LEFT JOIN users creator ON creator.id = l.created_by
ORDER BY l.created_at DESC;

-- ===========================================
-- 8. CHECK FOREIGN KEY RELATIONSHIPS
-- ===========================================

SELECT '=== 8. FOREIGN KEY CHECK ===' as debug_section;

-- Check if foreign key constraints exist (for the accessControlService query)
SELECT 
    'Foreign Key Constraints' as step,
    conname as constraint_name,
    contype as constraint_type,
    confrelid::regclass as foreign_table,
    conrelid::regclass as local_table
FROM pg_constraint
WHERE conrelid IN ('access_control'::regclass, 'users'::regclass)
  AND contype = 'f';

-- ===========================================
-- 9. TEST THE EXACT QUERY FROM ACCESS CONTROL SERVICE
-- ===========================================

SELECT '=== 9. ACCESS CONTROL SERVICE QUERY SIMULATION ===' as debug_section;

-- This simulates the exact query from accessControlService.ts line 126-132
-- We need to test if this query works correctly

WITH target_user_public_id AS (
    SELECT id FROM users WHERE auth_user_id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645'
)
SELECT 
    'Access Control Service Query Test' as step,
    ac.user_id,
    u.auth_user_id,
    u.role
FROM access_control ac
JOIN users u ON u.id = ac.user_id  -- This replaces the foreign key reference
WHERE ac.granted_to_user_id = (SELECT id FROM target_user_public_id);

SELECT 'Debug complete - check results above' as final_message;
