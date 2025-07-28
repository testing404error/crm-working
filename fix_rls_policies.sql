-- Fix RLS policies for leads table
-- This script will drop existing policies and create new ones that allow proper access

-- First, drop all existing policies on leads table
DROP POLICY IF EXISTS "leads_select_policy" ON leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
DROP POLICY IF EXISTS "leads_update_policy" ON leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON leads;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON leads;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON leads;

-- Enable RLS on leads table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create new policies that allow proper access
-- Allow authenticated users to view all leads
CREATE POLICY "authenticated_users_select_leads" ON leads
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert leads
CREATE POLICY "authenticated_users_insert_leads" ON leads
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update leads they created or are assigned to
CREATE POLICY "authenticated_users_update_leads" ON leads
    FOR UPDATE
    TO authenticated
    USING (
        created_by = auth.uid() OR 
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_user_id = auth.uid() 
            AND users.role = 'admin'
        )
    )
    WITH CHECK (
        created_by = auth.uid() OR 
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_user_id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Allow authenticated users to delete leads they created or admins
CREATE POLICY "authenticated_users_delete_leads" ON leads
    FOR DELETE
    TO authenticated
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_user_id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Also ensure users table has proper RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing user policies
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;

-- Allow authenticated users to read all users (needed for assignee lookups)
CREATE POLICY "authenticated_users_select_users" ON users
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow users to insert their own record
CREATE POLICY "authenticated_users_insert_users" ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (auth_user_id = auth.uid());

-- Allow users to update their own record or admins to update any
CREATE POLICY "authenticated_users_update_users" ON users
    FOR UPDATE
    TO authenticated
    USING (
        auth_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_user_id = auth.uid() 
            AND users.role = 'admin'
        )
    )
    WITH CHECK (
        auth_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_user_id = auth.uid() 
            AND users.role = 'admin'
        )
    );
