-- Fix type mismatch in get_managed_users_for_requester function
-- This addresses the error where email column type doesn't match the function return type

CREATE OR REPLACE FUNCTION get_managed_users_for_requester(requester_email TEXT)
RETURNS TABLE(id UUID, email TEXT, full_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email::TEXT, -- Explicit cast to TEXT to match return type
    u.full_name
  FROM users u
  JOIN access_requests ar ON u.id = ar.user_id
  WHERE ar.assignee_email = requester_email
    AND ar.status = 'accepted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
