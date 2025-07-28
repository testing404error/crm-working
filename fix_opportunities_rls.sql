-- Fix RLS policies for opportunities table
-- Run this in Supabase SQL Editor

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view opportunities they own or are assigned to" ON opportunities;
DROP POLICY IF EXISTS "Users can create opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can update opportunities they own or are assigned to" ON opportunities;
DROP POLICY IF EXISTS "Users can delete opportunities they own or are assigned to" ON opportunities;

-- Enable RLS on opportunities table
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT - Users can view opportunities they own or are assigned to
CREATE POLICY "Users can view opportunities they own or are assigned to" ON opportunities
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    user_id = auth.uid() OR
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.auth_user_id = auth.uid() 
      AND u.role IN ('admin', 'manager')
    )
  )
);

-- Policy 2: INSERT - Users can create opportunities
CREATE POLICY "Users can create opportunities" ON opportunities
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Policy 3: UPDATE - Users can update opportunities they own or are assigned to
CREATE POLICY "Users can update opportunities they own or are assigned to" ON opportunities
FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    user_id = auth.uid() OR
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.auth_user_id = auth.uid() 
      AND u.role IN ('admin', 'manager')
    )
  )
);

-- Policy 4: DELETE - Users can delete opportunities they own or are assigned to (admin/manager only)
CREATE POLICY "Users can delete opportunities they own or are assigned to" ON opportunities
FOR DELETE
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.role IN ('admin', 'manager')
    AND (user_id = auth.uid() OR assigned_to = auth.uid())
  )
);

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'opportunities'
ORDER BY policyname;
