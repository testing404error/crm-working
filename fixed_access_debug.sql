-- Fixed Access Control Debug Script
-- Based on the actual table structure

-- ===========================================
-- 1. CHECK USER DATA AND ACCESS CONTROL
-- ===========================================

-- Show users we're working with
SELECT 'USERS' as section;
SELECT 
    id as public_user_id,
    auth_user_id,
    name,
    email,
    role
FROM users
ORDER BY created_at;

-- Show access control relationships
SELECT 'ACCESS CONTROL RELATIONSHIPS' as section;
SELECT 
    ac.id,
    ac.user_id as data_owner_public_id,
    ac.granted_to_user_id as granted_to_public_id,
    ac.granted_at,
    owner.name as owner_name,
    owner.email as owner_email,
    owner.role as owner_role,
    grantee.name as grantee_name,
    grantee.email as grantee_email,
    grantee.role as grantee_role
FROM access_control ac
LEFT JOIN users owner ON owner.id = ac.user_id
LEFT JOIN users grantee ON grantee.id = ac.granted_to_user_id
ORDER BY ac.granted_at DESC;

-- ===========================================
-- 2. CHECK LEADS TABLE STRUCTURE AND DATA
-- ===========================================

-- First, let's see what columns the leads table actually has
SELECT 'LEADS TABLE COLUMNS' as section;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'leads'
ORDER BY ordinal_position;

-- Show all leads data
SELECT 'ALL LEADS DATA' as section;
SELECT * FROM leads ORDER BY created_at DESC;

-- ===========================================
-- 3. FOCUS ON TARGET USER ACCESS
-- ===========================================

-- Target user: auth_user_id = 2bca8ace-3204-44aa-b581-6bfa8f1c2645
-- Admin user: auth_user_id = 5110da6f-b086-4fdd-9474-f8fae28c56b4

SELECT 'TARGET USER ANALYSIS' as section;

-- Get the target user's public ID
WITH target_user AS (
    SELECT 
        id as public_id,
        auth_user_id,
        name,
        email,
        role
    FROM users 
    WHERE auth_user_id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645'
)
SELECT 'Target User Info' as step, * FROM target_user;

-- Check what access the target user has been granted
WITH target_user AS (
    SELECT id as public_id
    FROM users 
    WHERE auth_user_id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645'
)
SELECT 
    'Access Granted To Target User' as step,
    ac.user_id as can_access_data_from_user_id,
    owner.name as data_owner_name,
    owner.email as data_owner_email,
    owner.role as data_owner_role,
    owner.auth_user_id as data_owner_auth_id,
    ac.granted_at
FROM access_control ac
JOIN users owner ON owner.id = ac.user_id
WHERE ac.granted_to_user_id = (SELECT public_id FROM target_user);

-- ===========================================
-- 4. TEST ACCESS CONTROL LOGIC
-- ===========================================

SELECT 'ACCESS CONTROL LOGIC TEST' as section;

-- Check what user IDs the target user should have access to
WITH target_user AS (
    SELECT 
        id as public_id,
        auth_user_id
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
    'Users Target User Should Have Access To' as step,
    au.accessible_user_id,
    au.access_type,
    u.name as accessible_user_name,
    u.email as accessible_user_email,
    u.role as accessible_user_role
FROM accessible_users au
LEFT JOIN users u ON u.id = au.accessible_user_id;

-- ===========================================
-- 5. CHECK accessControlService.ts QUERY
-- ===========================================

SELECT 'ACCESS CONTROL SERVICE QUERY TEST' as section;

-- This simulates the query from accessControlService.ts line 126-132
-- BUT we need to handle the foreign key issue

WITH target_user_public_id AS (
    SELECT id FROM users WHERE auth_user_id = '2bca8ace-3204-44aa-b581-6bfa8f1c2645'
)
SELECT 
    'Access Control Service Query Result' as step,
    ac.user_id,
    u.auth_user_id,
    u.role,
    u.name,
    u.email
FROM access_control ac
JOIN users u ON u.id = ac.user_id  -- Direct join instead of foreign key
WHERE ac.granted_to_user_id = (SELECT id FROM target_user_public_id);

SELECT 'Debug complete - Review results to identify the issue' as final_message;
