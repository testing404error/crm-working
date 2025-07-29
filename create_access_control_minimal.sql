-- =====================================================
-- MINIMAL ACCESS CONTROL TABLE CREATION
-- Just creates the missing table without touching existing function
-- =====================================================

-- 1. Create access_control table (the main one causing 404 error)
CREATE TABLE IF NOT EXISTS public.access_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, granted_to_user_id)
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_access_control_user_id ON public.access_control(user_id);
CREATE INDEX IF NOT EXISTS idx_access_control_granted_to_user_id ON public.access_control(granted_to_user_id);

-- 3. Enable Row Level Security (RLS) if not already enabled
ALTER TABLE public.access_control ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view access control they are involved in" ON public.access_control;
DROP POLICY IF EXISTS "Users can grant access to their data" ON public.access_control;
DROP POLICY IF EXISTS "Users can revoke access they granted" ON public.access_control;

-- 5. Create RLS policies for access_control table
CREATE POLICY "Users can view access control they are involved in" ON public.access_control
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        granted_to_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can grant access to their data" ON public.access_control
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can revoke access they granted" ON public.access_control
    FOR DELETE USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- 6. Grant permissions to authenticated users
GRANT ALL ON public.access_control TO authenticated;
GRANT ALL ON public.access_control TO service_role;

-- 7. Verify the setup
SELECT 'Access control table created successfully!' AS status;

-- Check if table was created
SELECT 
    'access_control table columns:' AS info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'access_control' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
