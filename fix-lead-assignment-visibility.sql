-- ================================================
-- COMPREHENSIVE FIX FOR LEAD ASSIGNMENT VISIBILITY ISSUES
-- This script will solve the problem where admin-created leads 
-- assigned to users are not visible to those users
-- ================================================

-- First, let's check the current state of our data
SELECT 
    'Current Users:' as info,
    u.id as user_id,
    u.name,
    u.email,
    u.auth_user_id,
    au.raw_user_meta_data->>'role' as role
FROM users u
LEFT JOIN auth.users au ON u.auth_user_id = au.id
ORDER BY u.name;

-- Check current leads and their assignments
SELECT 
    'Current Leads:' as info,
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
ORDER BY l.created_at DESC;

-- Check current access_control relationships
SELECT 
    'Current Access Control:' as info,
    ac.*,
    u1.name as grantor_name,
    u1.email as grantor_email,
    u2.name as grantee_name,
    u2.email as grantee_email
FROM access_control ac
LEFT JOIN users u1 ON ac.user_id = u1.id
LEFT JOIN users u2 ON ac.granted_to_user_id = u2.id;

-- ================================================
-- SOLUTION 1: Create auto-assignment trigger
-- This will automatically grant access when admin assigns leads
-- ================================================

CREATE OR REPLACE FUNCTION auto_grant_access_on_lead_assignment()
RETURNS TRIGGER AS $$
DECLARE
    creator_role TEXT;
    creator_auth_id UUID;
BEGIN
    -- Only process if the lead has an assigned_to user
    IF NEW.assigned_to IS NOT NULL THEN
        -- Get the creator's auth ID and role
        SELECT u.auth_user_id INTO creator_auth_id
        FROM users u 
        WHERE u.id = NEW.user_id;
        
        IF creator_auth_id IS NOT NULL THEN
            SELECT raw_user_meta_data->>'role' INTO creator_role
            FROM auth.users 
            WHERE id = creator_auth_id;
            
            -- If creator is admin and lead is assigned to someone else
            IF creator_role = 'admin' AND NEW.assigned_to != NEW.user_id THEN
                -- Grant access to the assigned user
                INSERT INTO access_control (user_id, granted_to_user_id, granted_at)
                VALUES (NEW.user_id, NEW.assigned_to, NOW())
                ON CONFLICT (user_id, granted_to_user_id) DO NOTHING;
                
                -- Also grant reverse access (assigned user's data to admin)
                INSERT INTO access_control (user_id, granted_to_user_id, granted_at)
                VALUES (NEW.assigned_to, NEW.user_id, NOW())
                ON CONFLICT (user_id, granted_to_user_id) DO NOTHING;
                
                RAISE NOTICE 'Auto-granted bidirectional access: Admin % <-> Assigned user %', NEW.user_id, NEW.assigned_to;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for both INSERT and UPDATE operations
DROP TRIGGER IF EXISTS auto_grant_access_on_lead_insert ON leads;
CREATE TRIGGER auto_grant_access_on_lead_insert
    AFTER INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION auto_grant_access_on_lead_assignment();

DROP TRIGGER IF EXISTS auto_grant_access_on_lead_update ON leads;
CREATE TRIGGER auto_grant_access_on_lead_update
    AFTER UPDATE ON leads
    FOR EACH ROW
    WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
    EXECUTE FUNCTION auto_grant_access_on_lead_assignment();

-- ================================================
-- SOLUTION 2: Fix existing assignments retroactively
-- Grant access for existing admin-created leads that are assigned
-- ================================================

DO $$
DECLARE
    lead_record RECORD;
    admin_user_id UUID;
    assigned_user_id UUID;
    creator_role TEXT;
BEGIN
    -- Process all existing leads that have assignments
    FOR lead_record IN 
        SELECT DISTINCT 
            l.id,
            l.user_id as creator_id,
            l.assigned_to,
            au.raw_user_meta_data->>'role' as creator_role
        FROM leads l
        LEFT JOIN users u ON l.user_id = u.id
        LEFT JOIN auth.users au ON u.auth_user_id = au.id
        WHERE l.assigned_to IS NOT NULL 
        AND l.assigned_to != l.user_id  -- Only where assignment differs from creator
        AND au.raw_user_meta_data->>'role' = 'admin'
    LOOP
        -- Create bidirectional access control
        INSERT INTO access_control (user_id, granted_to_user_id, granted_at)
        VALUES (lead_record.creator_id, lead_record.assigned_to, NOW())
        ON CONFLICT (user_id, granted_to_user_id) DO NOTHING;
        
        INSERT INTO access_control (user_id, granted_to_user_id, granted_at)
        VALUES (lead_record.assigned_to, lead_record.creator_id, NOW())
        ON CONFLICT (user_id, granted_to_user_id) DO NOTHING;
        
        RAISE NOTICE 'Fixed access for lead % - granted bidirectional access between % and %', 
                     lead_record.id, lead_record.creator_id, lead_record.assigned_to;
    END LOOP;
END $$;

-- ================================================
-- SOLUTION 3: Create/fix pending_access_requests table if needed
-- ================================================

CREATE TABLE IF NOT EXISTS pending_access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(requester_id, receiver_id)
);

-- Enable RLS on pending_access_requests
ALTER TABLE pending_access_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for pending_access_requests if they don't exist
DO $$
BEGIN
    -- Check if policy exists before creating
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'pending_access_requests' 
        AND policyname = 'Users can view their own requests'
    ) THEN
        CREATE POLICY "Users can view their own requests" 
        ON pending_access_requests
        FOR SELECT USING (requester_id = auth.uid() OR receiver_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'pending_access_requests' 
        AND policyname = 'Users can insert their own requests'
    ) THEN
        CREATE POLICY "Users can insert their own requests" 
        ON pending_access_requests
        FOR INSERT WITH CHECK (requester_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'pending_access_requests' 
        AND policyname = 'Receivers can update request status'
    ) THEN
        CREATE POLICY "Receivers can update request status" 
        ON pending_access_requests
        FOR UPDATE USING (receiver_id = auth.uid());
    END IF;
END $$;

-- ================================================
-- VERIFICATION: Check what we've accomplished
-- ================================================

SELECT 
    'FINAL VERIFICATION - Access Control After Fix:' as info,
    ac.*,
    u1.name as grantor_name,
    u1.email as grantor_email,
    u2.name as grantee_name,
    u2.email as grantee_email
FROM access_control ac
LEFT JOIN users u1 ON ac.user_id = u1.id
LEFT JOIN users u2 ON ac.granted_to_user_id = u2.id
ORDER BY ac.granted_at DESC;

-- Show leads with their access implications
SELECT 
    'FINAL VERIFICATION - Leads With Access:' as info,
    l.id,
    l.name as lead_name,
    l.user_id as created_by_user_id,
    l.assigned_to,
    u1.name as created_by_name,
    u2.name as assigned_to_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM access_control ac 
            WHERE ac.user_id = l.user_id 
            AND ac.granted_to_user_id = l.assigned_to
        ) THEN 'YES - Access Granted'
        ELSE 'NO - No Access'
    END as assigned_user_has_access
FROM leads l
LEFT JOIN users u1 ON l.user_id = u1.id
LEFT JOIN users u2 ON l.assigned_to = u2.id
WHERE l.assigned_to IS NOT NULL
ORDER BY l.created_at DESC;

COMMENT ON FUNCTION auto_grant_access_on_lead_assignment() IS 'Automatically grants bidirectional access between admin and assigned users when leads are created or updated';

-- ================================================
-- SUMMARY OF FIXES APPLIED:
-- 1. Created trigger to auto-grant access on future lead assignments
-- 2. Fixed existing lead assignments retroactively
-- 3. Created/fixed pending_access_requests table and policies
-- 4. Added verification queries to confirm fixes
-- ================================================

SELECT 'ALL FIXES COMPLETED SUCCESSFULLY!' as status;
