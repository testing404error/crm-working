-- Strict Admin Role Assignment
-- Only users who explicitly sign up with role 'admin' in metadata become admins
-- All other users are assigned 'user' role by default

-- Drop existing trigger and function to recreate with strict logic
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_role();

-- Create strict role assignment function
CREATE OR REPLACE FUNCTION handle_new_user_role()
RETURNS TRIGGER AS $$
DECLARE
    signup_role TEXT;
    assigned_role TEXT;
BEGIN
    -- Get the role from signup metadata
    signup_role := NEW.raw_user_meta_data->>'role';
    
    -- STRICT POLICY: Only explicit 'admin' signup gets admin role
    -- All other cases (including null, empty, or any other value) get 'user' role
    IF signup_role = 'admin' THEN
        assigned_role := 'admin';
    ELSE
        assigned_role := 'user';
    END IF;
    
    -- Insert the role assignment
    INSERT INTO public.user_roles (user_id, role, assigned_at, assigned_by)
    VALUES (
        NEW.id,
        assigned_role,
        NOW(),
        'system'  -- System assigned during signup
    );
    
    -- Log the assignment for audit purposes
    RAISE NOTICE 'User % assigned role % based on signup metadata role: %', 
        NEW.id, assigned_role, COALESCE(signup_role, 'null');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user role assignment
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_role();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;

-- Verify existing role assignments (optional - for checking current state)
-- This query shows current role distribution:
-- SELECT role, COUNT(*) as count FROM public.user_roles GROUP BY role;

-- Optional: Update existing users to follow strict policy
-- WARNING: This will change existing role assignments!
-- Uncomment the following block if you want to apply strict policy to existing users:

/*
UPDATE public.user_roles 
SET role = CASE 
    WHEN EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = user_roles.user_id 
        AND auth.users.raw_user_meta_data->>'role' = 'admin'
    ) THEN 'admin'
    ELSE 'user'
END
WHERE user_id IN (SELECT id FROM auth.users);
*/

-- Create function to manually assign admin role (only admins can use this)
CREATE OR REPLACE FUNCTION assign_user_role(target_user_id UUID, new_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_role TEXT;
BEGIN
    -- Check if current user is admin
    SELECT role INTO current_user_role 
    FROM public.user_roles 
    WHERE user_id = auth.uid();
    
    -- Only admins can assign roles
    IF current_user_role != 'admin' THEN
        RAISE EXCEPTION 'Permission denied: Only admins can assign roles';
    END IF;
    
    -- Validate role
    IF new_role NOT IN ('admin', 'user') THEN
        RAISE EXCEPTION 'Invalid role: %', new_role;
    END IF;
    
    -- Update role
    UPDATE public.user_roles 
    SET role = new_role, 
        assigned_at = NOW(),
        assigned_by = auth.uid()::TEXT
    WHERE user_id = target_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (but function checks admin status internally)
GRANT EXECUTE ON FUNCTION assign_user_role(UUID, TEXT) TO authenticated;

COMMIT;
