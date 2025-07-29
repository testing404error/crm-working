-- Check the actual structure of all relevant tables

-- Check leads table structure
SELECT 
    'LEADS TABLE COLUMNS' as table_info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'leads'
ORDER BY ordinal_position;

-- Check opportunities table structure  
SELECT 
    'OPPORTUNITIES TABLE COLUMNS' as table_info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'opportunities'
ORDER BY ordinal_position;

-- Check users table structure
SELECT 
    'USERS TABLE COLUMNS' as table_info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- Show sample data from leads table
SELECT 'LEADS SAMPLE DATA' as sample_info;
SELECT * FROM leads LIMIT 3;

-- Show sample data from opportunities table
SELECT 'OPPORTUNITIES SAMPLE DATA' as sample_info;
SELECT * FROM opportunities LIMIT 3;

-- Show sample data from users table
SELECT 'USERS SAMPLE DATA' as sample_info;
SELECT * FROM users LIMIT 3;
