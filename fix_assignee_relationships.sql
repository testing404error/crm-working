-- Migration to fix assignee relationships
-- This creates a proper many-to-many relationship between users and assignees

-- First, let's rename the current assignees table to assignee_users 
-- since it stores basic assignee user information
ALTER TABLE assignees RENAME TO assignee_users;

-- Create the new assignee_relationships table to store the many-to-many relationship
CREATE TABLE IF NOT EXISTS assignee_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assignee_id UUID NOT NULL REFERENCES assignee_users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(user_id, assignee_id) -- Prevent duplicate assignments
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignee_relationships_user ON assignee_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_assignee_relationships_assignee ON assignee_relationships(assignee_id);

-- Enable Row Level Security
ALTER TABLE assignee_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignee_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignee_relationships
CREATE POLICY "Users can view their own assignee relationships" ON assignee_relationships
    FOR SELECT USING (user_id = auth.uid() OR assignee_id IN (
        SELECT id FROM assignee_users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Admins can manage all assignee relationships" ON assignee_relationships
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (raw_user_meta_data->>'role' = 'admin' OR user_metadata->>'role' = 'admin')
        )
    );

-- RLS Policies for assignee_users 
CREATE POLICY "Users can view all assignee users" ON assignee_users
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage assignee users" ON assignee_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (raw_user_meta_data->>'role' = 'admin' OR user_metadata->>'role' = 'admin')
        )
    );

-- Function to get assignee relationships for a user
CREATE OR REPLACE FUNCTION get_user_assignees(target_user_id UUID)
RETURNS TABLE (
    assignee_id UUID,
    assignee_name TEXT,
    assignee_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        au.id as assignee_id,
        au.name as assignee_name,
        au.email as assignee_email,
        ar.created_at
    FROM assignee_relationships ar
    JOIN assignee_users au ON ar.assignee_id = au.id
    WHERE ar.user_id = target_user_id;
END;
$$;

-- Function to check if a user is assigned to another user
CREATE OR REPLACE FUNCTION is_assignee_for_user(assignee_user_id UUID, target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM assignee_relationships ar
        JOIN assignee_users au ON ar.assignee_id = au.id
        WHERE ar.user_id = target_user_id 
        AND au.email = (
            SELECT email FROM auth.users WHERE id = assignee_user_id
        )
    );
END;
$$;
