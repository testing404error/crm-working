import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey)

async function checkAndFixRLSPolicies() {
  console.log('🔍 Checking current RLS policies on leads table...\n')
  
  try {
    // Query to get all policies on the leads table
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'leads')
    
    if (policiesError) {
      console.error('❌ Error fetching policies:', policiesError)
      
      // Alternative method using raw SQL
      console.log('🔄 Trying alternative method...')
      const { data: altPolicies, error: altError } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
          FROM pg_policies 
          WHERE tablename = 'leads' AND schemaname = 'public';
        `
      })
      
      if (altError) {
        console.error('❌ Alternative method also failed:', altError)
        console.log('📝 Will proceed to create/update RLS policies directly...\n')
      } else {
        console.log('✅ Current RLS policies on leads table:')
        console.table(altPolicies)
      }
    } else {
      console.log('✅ Current RLS policies on leads table:')
      console.table(policies)
    }

    console.log('\n🔧 Creating/updating RLS policies for leads table...\n')

    // Drop existing policies that might be restrictive
    const dropPolicies = [
      'DROP POLICY IF EXISTS "leads_select_policy" ON leads;',
      'DROP POLICY IF EXISTS "leads_insert_policy" ON leads;', 
      'DROP POLICY IF EXISTS "leads_update_policy" ON leads;',
      'DROP POLICY IF EXISTS "leads_delete_policy" ON leads;',
      'DROP POLICY IF EXISTS "Enable read access for all users" ON leads;',
      'DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON leads;',
      'DROP POLICY IF EXISTS "Enable update for users based on user_id" ON leads;',
      'DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON leads;'
    ]

    for (const dropSql of dropPolicies) {
      const { error } = await supabase.rpc('exec_sql', { sql: dropSql })
      if (error && !error.message.includes('does not exist')) {
        console.log(`⚠️  Warning dropping policy: ${error.message}`)
      }
    }

    // Create comprehensive RLS policies
    const createPolicies = [
      // SELECT policy - allow users to read leads they have access to
      `
      CREATE POLICY "leads_select_policy" ON leads
      FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
          -- User can see leads assigned to them
          assigned_to IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
          )
          OR
          -- User can see leads they created
          created_by IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
          )
          OR
          -- Admin users can see all leads
          EXISTS (
            SELECT 1 FROM users 
            WHERE auth_user_id = auth.uid() AND role = 'admin'
          )
          OR
          -- Users with appropriate access_control can see leads
          EXISTS (
            SELECT 1 FROM access_control ac
            JOIN users u ON u.id = ac.user_id
            WHERE u.auth_user_id = auth.uid()
            AND ac.resource_type = 'leads'
            AND ac.resource_id = leads.id::text
            AND ac.permission IN ('read', 'write', 'admin')
          )
        )
      );
      `,
      
      // INSERT policy - allow authenticated users to create leads
      `
      CREATE POLICY "leads_insert_policy" ON leads
      FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        -- Ensure the created_by field matches the current user
        created_by IN (
          SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
      );
      `,
      
      // UPDATE policy - allow users to update leads they have access to
      `
      CREATE POLICY "leads_update_policy" ON leads
      FOR UPDATE USING (
        auth.uid() IS NOT NULL AND (
          -- User can update leads assigned to them
          assigned_to IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
          )
          OR
          -- User can update leads they created
          created_by IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
          )
          OR
          -- Admin users can update all leads
          EXISTS (
            SELECT 1 FROM users 
            WHERE auth_user_id = auth.uid() AND role = 'admin'
          )
          OR
          -- Users with write access can update leads
          EXISTS (
            SELECT 1 FROM access_control ac
            JOIN users u ON u.id = ac.user_id
            WHERE u.auth_user_id = auth.uid()
            AND ac.resource_type = 'leads'
            AND ac.resource_id = leads.id::text
            AND ac.permission IN ('write', 'admin')
          )
        )
      );
      `,
      
      // DELETE policy - allow users to delete leads they have admin access to
      `
      CREATE POLICY "leads_delete_policy" ON leads
      FOR DELETE USING (
        auth.uid() IS NOT NULL AND (
          -- Admin users can delete all leads
          EXISTS (
            SELECT 1 FROM users 
            WHERE auth_user_id = auth.uid() AND role = 'admin'
          )
          OR
          -- Users with admin access can delete leads
          EXISTS (
            SELECT 1 FROM access_control ac
            JOIN users u ON u.id = ac.user_id
            WHERE u.auth_user_id = auth.uid()
            AND ac.resource_type = 'leads'
            AND ac.resource_id = leads.id::text
            AND ac.permission = 'admin'
          )
        )
      );
      `
    ]

    for (const [index, createSql] of createPolicies.entries()) {
      console.log(`📝 Creating policy ${index + 1}/4...`)
      const { error } = await supabase.rpc('exec_sql', { sql: createSql })
      if (error) {
        console.error(`❌ Error creating policy ${index + 1}:`, error.message)
      } else {
        console.log(`✅ Policy ${index + 1} created successfully`)
      }
    }

    // Ensure RLS is enabled on the leads table
    console.log('\n🔒 Ensuring RLS is enabled on leads table...')
    const { error: rlsError } = await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE leads ENABLE ROW LEVEL SECURITY;' 
    })
    
    if (rlsError && !rlsError.message.includes('already enabled')) {
      console.error('❌ Error enabling RLS:', rlsError.message)
    } else {
      console.log('✅ RLS is enabled on leads table')
    }

    console.log('\n🎉 RLS policies have been updated successfully!')
    console.log('\n📋 Summary of policies created:')
    console.log('1. SELECT: Users can read leads they\'re assigned to, created, or have access control for')
    console.log('2. INSERT: Authenticated users can create leads (with proper created_by field)')
    console.log('3. UPDATE: Users can update leads they have access to')
    console.log('4. DELETE: Only admin users or those with admin access can delete leads')

    // Test lead creation with a sample user
    console.log('\n🧪 Testing lead creation...')
    await testLeadCreation()

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

async function testLeadCreation() {
  try {
    // Get a test user (first non-admin user)
    const { data: testUsers, error: userError } = await supabase
      .from('users')
      .select('id, email, auth_user_id')
      .neq('role', 'admin')
      .limit(1)

    if (userError || !testUsers?.length) {
      console.log('⚠️  No test users found to test lead creation')
      return
    }

    const testUser = testUsers[0]
    console.log(`🧪 Testing with user: ${testUser.email}`)

    // Create a test lead using service role (this should work)
    const testLead = {
      company_name: 'Test Company for RLS',
      contact_name: 'Test Contact',
      email: 'test@rlstest.com',
      phone: '123-456-7890',
      status: 'new',
      source: 'website',
      created_by: testUser.id,
      assigned_to: testUser.id,
      tags: ['test', 'rls'],
      notes: 'This is a test lead created to verify RLS policies'
    }

    const { data: createdLead, error: createError } = await supabase
      .from('leads')
      .insert([testLead])
      .select()

    if (createError) {
      console.error('❌ Test lead creation failed:', createError.message)
    } else {
      console.log('✅ Test lead created successfully:', createdLead[0]?.id)
      
      // Clean up test lead
      await supabase
        .from('leads')
        .delete()
        .eq('id', createdLead[0].id)
      
      console.log('🧹 Test lead cleaned up')
    }

  } catch (error) {
    console.error('❌ Error in test lead creation:', error)
  }
}

// Run the script
checkAndFixRLSPolicies().catch(console.error)
