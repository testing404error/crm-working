-- ✅ Fix Admin Lead Assignment
-- This script ensures admin-created leads are automatically visible to assigned users
-- Run this in your Supabase SQL Editor

-- First, let's check current access control relationships
SELECT 
    ac.id,
    ac.user_id as admin_user_id,
    ac.granted_to_user_id as assignee_user_id,
    u1.name as admin_name,
    u1.email as admin_email,
    u2.name as assignee_name,
    u2.email as assignee_email
FROM access_control ac
LEFT JOIN users u1 ON ac.user_id = u1.id
LEFT JOIN users u2 ON ac.granted_to_user_id = u2.id
ORDER BY ac.granted_at DESC;

-- Create a function to ensure admin leads are properly accessible
CREATE OR REPLACE FUNCTION ensure_admin_lead_access()
RETURNS TRIGGER AS $$
DECLARE
    creator_auth_id UUID;
    creator_role TEXT;
    assignee_user_id UUID;
    admin_public_id UUID;
BEGIN
    -- Get the creator's auth user ID and role
    SELECT u.auth_user_id INTO creator_auth_id
    FROM users u 
    WHERE u.id = NEW.user_id;
    
    -- Get the creator's role from auth.users
    SELECT raw_user_meta_data->>'role' INTO creator_role
    FROM auth.users 
    WHERE id = creator_auth_id;
    
    -- If creator is admin and lead is assigned to someone
    IF creator_role = 'admin' AND NEW.assigned_to IS NOT NULL THEN
        -- Get the admin's public user ID
        admin_public_id := NEW.user_id;
        
        -- Ensure access control relationship exists from admin to assignee
        INSERT INTO access_control (user_id, granted_to_user_id, granted_at)
        VALUES (admin_public_id, NEW.assigned_to, NOW())
        ON CONFLICT (user_id, granted_to_user_id) DO NOTHING;
        
        -- Also ensure reverse relationship (assignee can access admin data)
        -- This is important for the current access control logic
        -- Comment this out if you only want one-way access
        -- INSERT INTO access_control (user_id, granted_to_user_id, granted_at)
        -- VALUES (NEW.assigned_to, admin_public_id, NOW())
        -- ON CONFLICT (user_id, granted_to_user_id) DO NOTHING;
        
        RAISE NOTICE 'Admin lead assignment: Admin % granted access to assignee %', admin_public_id, NEW.assigned_to;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger for new leads
DROP TRIGGER IF EXISTS ensure_admin_lead_access_trigger ON leads;
CREATE TRIGGER ensure_admin_lead_access_trigger
    AFTER INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION ensure_admin_lead_access();

-- Create the trigger for updated leads (assignment changes)
DROP TRIGGER IF EXISTS ensure_admin_lead_access_update_trigger ON leads;
CREATE TRIGGER ensure_admin_lead_access_update_trigger
    AFTER UPDATE ON leads
    FOR EACH ROW
    WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
    EXECUTE FUNCTION ensure_admin_lead_access();

-- Comment on the function
COMMENT ON FUNCTION ensure_admin_lead_access() IS 'Automatically grants access control permissions when admin creates or assigns leads';

-- Test the current setup
-- Show existing leads and their assignments
SELECT 
    l.id,
    l.name as lead_name,
    l.user_id as creator_id,
    l.assigned_to,
    u1.name as creator_name,
    u1.email as creator_email,
    u2.name as assigned_to_name,
    u2.email as assigned_to_email,
    au.raw_user_meta_data->>'role' as creator_role
FROM leads l
LEFT JOIN users u1 ON l.user_id = u1.id
LEFT JOIN users u2 ON l.assigned_to = u2.id
LEFT JOIN auth.users au ON u1.auth_user_id = au.id
ORDER BY l.created_at DESC
LIMIT 10;

-- Show what access control relationships should exist
SELECT 
    'EXPECTED ACCESS:' as note,
    l.user_id as admin_should_grant_to,
    l.assigned_to as this_assignee,
    u1.name as admin_name,
    u2.name as assignee_name
FROM leads l
LEFT JOIN users u1 ON l.user_id = u1.id
LEFT JOIN users u2 ON l.assigned_to = u2.id
LEFT JOIN auth.users au ON u1.auth_user_id = au.id
WHERE l.assigned_to IS NOT NULL 
  AND au.raw_user_meta_data->>'role' = 'admin';
