-- Check what tables exist in your database
SELECT table_name, table_schema
FROM information_schema.tables 
WHERE table_schema = 'public'  -- or 'auth' if you're using Supabase auth tables
ORDER BY table_name;

-- If you have a users table instead of profiles, let's see its structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check auth.users table (Supabase's built-in user table)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'auth'
ORDER BY ordinal_position;

-- Let's also check what user-related data we have
-- First, let's see if there's a users table in public schema
SELECT 'public.users' as table_name, COUNT(*) as row_count
FROM public.users
WHERE true
UNION ALL
-- Check auth.users
SELECT 'auth.users' as table_name, COUNT(*) as row_count  
FROM auth.users
WHERE true;
