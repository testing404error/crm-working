-- Setup script to establish proper access control relationships for admin auto-sharing
-- This script should be run in your Supabase SQL Editor

-- First, let's check what users we have
SELECT 
    u.id as public_user_id,
    u.name,
    u.email,
    u.auth_user_id,
    au.raw_user_meta_data->>'role' as role
FROM users u
LEFT JOIN auth.users au ON u.auth_user_id = au.id
ORDER BY u.name;

-- Check current access_control relationships
SELECT 
    ac.*,
    u1.name as grantor_name,
    u1.email as grantor_email,
    u2.name as grantee_name,
    u2.email as grantee_email
FROM access_control ac
LEFT JOIN users u1 ON ac.user_id = u1.id
LEFT JOIN users u2 ON ac.granted_to_user_id = u2.id;

-- Check recent leads to see who created them and who they're assigned to
SELECT 
    l.id,
    l.name as lead_name,
    l.user_id as created_by_user_id,
    l.assigned_to,
    u1.name as created_by_name,
    u1.email as created_by_email,
    u2.name as assigned_to_name,
    u2.email as assigned_to_email,
    au1.raw_user_meta_data->>'role' as creator_role
FROM leads l
LEFT JOIN users u1 ON l.user_id = u1.id
LEFT JOIN users u2 ON l.assigned_to = u2.id
LEFT JOIN auth.users au1 ON u1.auth_user_id = au1.id
ORDER BY l.created_at DESC
LIMIT 10;

-- SOLUTION: If you have an admin user and want to grant access to assigned users,
-- you need to create access_control relationships.
-- Replace the UUIDs below with actual values from your system:

-- Example: Grant admin's data access to assigned user (replace with actual UUIDs)
/*
INSERT INTO access_control (user_id, granted_to_user_id, granted_at)
VALUES 
    ('admin_public_user_id', 'assigned_user_public_id', NOW())
ON CONFLICT (user_id, granted_to_user_id) DO NOTHING;
*/

-- To make this work automatically, you can also create a trigger that auto-grants access
-- when an admin creates a lead assigned to someone

CREATE OR REPLACE FUNCTION auto_grant_access_on_lead_creation()
RETURNS TRIGGER AS $$
DECLARE
    creator_role TEXT;
    creator_auth_id UUID;
BEGIN
    -- Get the creator's auth ID and role
    SELECT u.auth_user_id INTO creator_auth_id
    FROM users u 
    WHERE u.id = NEW.user_id;
    
    SELECT raw_user_meta_data->>'role' INTO creator_role
    FROM auth.users 
    WHERE id = creator_auth_id;
    
    -- If creator is admin and lead is assigned to someone else
    IF creator_role = 'admin' AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.user_id THEN
        -- Grant access to the assigned user
        INSERT INTO access_control (user_id, granted_to_user_id, granted_at)
        VALUES (NEW.user_id, NEW.assigned_to, NOW())
        ON CONFLICT (user_id, granted_to_user_id) DO NOTHING;
        
        RAISE NOTICE 'Auto-granted access: Admin % granted access to assigned user %', NEW.user_id, NEW.assigned_to;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_grant_access_trigger ON leads;
CREATE TRIGGER auto_grant_access_trigger
    AFTER INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION auto_grant_access_on_lead_creation();

COMMENT ON FUNCTION auto_grant_access_on_lead_creation() IS 'Automatically grants admin data access to assigned users when admin creates leads';
