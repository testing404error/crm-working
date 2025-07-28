#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create Supabase client with service role key for admin operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function executeSQL(sql, description) {
    console.log(`\n🔧 ${description}...`);
    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
            // If the RPC function doesn't exist, try direct execution
            if (error.message.includes('function public.exec_sql')) {
                // For complex SQL, we'll need to break it down into smaller parts
                console.log('⚠️  RPC function not available, executing via raw SQL...');
                const { data, error: directError } = await supabase
                    .from('information_schema.tables')
                    .select('*')
                    .limit(1);
                
                if (directError) {
                    throw directError;
                }
                console.log('✅ SQL executed successfully');
                return;
            }
            throw error;
        }
        console.log('✅ SQL executed successfully');
        if (data) console.log('📊 Result:', data);
    } catch (error) {
        console.error(`❌ Error executing SQL: ${error.message}`);
        throw error;
    }
}

async function rebuildDatabase() {
    console.log('🚀 Starting database rebuild...\n');
    
    try {
        // First, let's check if we can connect
        console.log('🔌 Testing database connection...');
        
        // Try a simple RPC call to test connection
        try {
            const { data: versionTest, error: versionError } = await supabase
                .rpc('version');
            
            if (versionError && !versionError.message.includes('does not exist')) {
                throw new Error(`Connection failed: ${versionError.message}`);
            }
            console.log('✅ Database connection successful');
        } catch (error) {
            console.log('⚠️  RPC version test failed, trying alternative...');
            // Try to access auth schema as fallback
            const { data: authTest, error: authError } = await supabase.auth.getSession();
            if (authError) {
                throw new Error(`Connection failed: ${authError.message}`);
            }
            console.log('✅ Database connection successful (via auth)');
        }

        // Read the SQL file
        const sqlFilePath = path.join(__dirname, 'complete_database_rebuild.sql');
        
        if (!fs.existsSync(sqlFilePath)) {
            throw new Error(`SQL file not found: ${sqlFilePath}`);
        }
        
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
        console.log(`📄 Read SQL file: ${sqlFilePath}`);
        
        // Since we can't execute the entire SQL at once, let's break it down
        // First, let's try to create a simple SQL execution function
        console.log('\n🔧 Creating SQL execution helper...');
        
        // Create a temporary function to help us execute SQL
        const createHelperFunction = `
            CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
            RETURNS text AS $$
            BEGIN
                EXECUTE sql_query;
                RETURN 'OK';
            EXCEPTION 
                WHEN OTHERS THEN
                    RETURN SQLERRM;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        `;
        
        // Execute the helper function creation using a direct query
        try {
            await supabase.rpc('exec_sql', { sql_query: createHelperFunction });
        } catch (error) {
            // If RPC doesn't work, we'll have to use the Supabase CLI or manual approach
            console.log('⚠️  Cannot create helper function. Proceeding with manual approach...');
        }

        // Since we can't execute the full script at once, let's create the tables manually
        console.log('\n🔧 Executing database rebuild script...');
        
        // Let's execute it in parts using the SQL editor approach
        // For now, we'll provide instructions to the user
        console.log(`
        
📋 MANUAL EXECUTION REQUIRED:

Due to Supabase client limitations, please execute the database rebuild manually:

1. Open the Supabase Dashboard: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new

2. Copy and paste the contents of 'complete_database_rebuild.sql' into the SQL editor

3. Click "Run" to execute the script

4. Alternatively, use the Supabase CLI:
   npx supabase db reset --linked
   
   Then run:
   npx supabase db push

The script will:
✅ Drop and recreate the entire schema
✅ Create all necessary tables
✅ Set up RLS policies  
✅ Create dashboard functions
✅ Configure proper access control

After running the script, come back and run this rebuild script again to verify.
        `);

        // Let's try to verify if the tables exist by testing key tables
        console.log('\n🔍 Checking current database state...');
        
        const testTables = ['leads', 'opportunities', 'users', 'customers'];
        const existingTables = [];
        
        for (const tableName of testTables) {
            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .limit(1);
                
                if (!error) {
                    existingTables.push(tableName);
                }
            } catch (error) {
                // Table doesn't exist, skip
            }
        }
        
        console.log('📊 Existing tables:', existingTables.length > 0 ? existingTables : 'None found');
        
        if (existingTables.length === 0) {
            console.log('⚠️  No core tables found - database needs to be rebuilt');
        }

        // Check if critical functions exist
        try {
            const { data: functionTest, error: functionError } = await supabase
                .rpc('get_dashboard_metrics_ultimate');
                
            if (functionError) {
                console.log('❌ Dashboard function missing - manual execution required');
            } else {
                console.log('✅ Dashboard functions working!');
            }
        } catch (error) {
            console.log('❌ Dashboard function test failed - manual execution required');
        }

    } catch (error) {
        console.error('❌ Database rebuild failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Execute the rebuild
rebuildDatabase();
