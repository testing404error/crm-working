-- Fix existing accepted access requests to ensure they have proper access_control relationships
-- Run this in your Supabase SQL Editor after the main database setup

-- This script will create missing access_control relationships for existing accepted requests

DO $$
DECLARE
    request_record RECORD;
    requester_public_id UUID;
    receiver_public_id UUID;
    requester_role TEXT;
BEGIN
    -- Loop through all accepted access requests
    FOR request_record IN 
        SELECT requester_id, receiver_id, id, created_at
        FROM pending_access_requests 
        WHERE status = 'accepted'
    LOOP
        -- Get the public.users IDs for both users
        SELECT id INTO requester_public_id 
        FROM users 
        WHERE auth_user_id = request_record.requester_id;
        
        SELECT id INTO receiver_public_id 
        FROM users 
        WHERE auth_user_id = request_record.receiver_id;
        
        -- Skip if we can't find the users in public.users table
        IF requester_public_id IS NULL OR receiver_public_id IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Get the requester's role from auth.users metadata
        -- Note: This is a simplified check, in a real scenario you'd query auth.users
        -- For now, we'll assume any user with 'admin' in their email or specific IDs are admins
        -- You may need to adjust this logic based on your admin identification method
        
        -- Check if an access_control relationship already exists
        IF NOT EXISTS (
            SELECT 1 FROM access_control 
            WHERE (user_id = requester_public_id AND granted_to_user_id = receiver_public_id)
               OR (user_id = receiver_public_id AND granted_to_user_id = requester_public_id)
        ) THEN
            -- For this fix, we'll create the relationship assuming admin->user pattern
            -- You can modify this logic if you have a different way to identify admins
            
            -- Create access_control relationship (admin's data shared with user)
            INSERT INTO access_control (user_id, granted_to_user_id, granted_at)
            VALUES (requester_public_id, receiver_public_id, request_record.created_at)
            ON CONFLICT (user_id, granted_to_user_id) DO NOTHING;
            
            RAISE NOTICE 'Created access_control relationship: user % granted access to user %''s data', 
                receiver_public_id, requester_public_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Finished processing existing access requests';
END $$;

-- Verify the results
SELECT 
    'Access Control Relationships Created' as status,
    COUNT(*) as count
FROM access_control;

-- Show current access relationships
SELECT 
    ac.user_id as data_owner,
    ac.granted_to_user_id as granted_to,
    ac.granted_at,
    u1.auth_user_id as owner_auth_id,
    u2.auth_user_id as granted_to_auth_id
FROM access_control ac
LEFT JOIN users u1 ON u1.id = ac.user_id
LEFT JOIN users u2 ON u2.id = ac.granted_to_user_id
ORDER BY ac.granted_at DESC;

-- Show accepted requests and their corresponding access_control relationships
SELECT 
    par.id as request_id,
    par.requester_id,
    par.receiver_id,
    par.status,
    par.created_at as request_created,
    CASE 
        WHEN ac.id IS NOT NULL THEN 'Has Access Control'
        ELSE 'Missing Access Control'
    END as access_control_status
FROM pending_access_requests par
LEFT JOIN users u1 ON u1.auth_user_id = par.requester_id
LEFT JOIN users u2 ON u2.auth_user_id = par.receiver_id
LEFT JOIN access_control ac ON (
    (ac.user_id = u1.id AND ac.granted_to_user_id = u2.id) OR
    (ac.user_id = u2.id AND ac.granted_to_user_id = u1.id)
)
WHERE par.status = 'accepted'
ORDER BY par.created_at DESC;
