-- Fix RLS policies for opportunities table
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "opportunities_select_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_insert_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_update_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_delete_policy" ON opportunities;

-- Create new permissive policies for opportunities
CREATE POLICY "opportunities_select_policy" ON opportunities
FOR SELECT USING (
  auth.uid()::text IN (
    SELECT auth_user_id FROM users WHERE id = opportunities.user_id
    UNION
    SELECT auth_user_id FROM users WHERE id = opportunities.assigned_to
  )
);

CREATE POLICY "opportunities_insert_policy" ON opportunities
FOR INSERT WITH CHECK (
  auth.uid()::text IN (
    SELECT auth_user_id FROM users WHERE id = opportunities.user_id
  )
);

CREATE POLICY "opportunities_update_policy" ON opportunities
FOR UPDATE USING (
  auth.uid()::text IN (
    SELECT auth_user_id FROM users WHERE id = opportunities.user_id
    UNION
    SELECT auth_user_id FROM users WHERE id = opportunities.assigned_to
  )
) WITH CHECK (
  auth.uid()::text IN (
    SELECT auth_user_id FROM users WHERE id = opportunities.user_id
    UNION
    SELECT auth_user_id FROM users WHERE id = opportunities.assigned_to
  )
);

CREATE POLICY "opportunities_delete_policy" ON opportunities
FOR DELETE USING (
  auth.uid()::text IN (
    SELECT auth_user_id FROM users WHERE id = opportunities.user_id
    UNION
    SELECT auth_user_id FROM users WHERE id = opportunities.assigned_to
  )
);

-- Ensure RLS is enabled on opportunities table
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
