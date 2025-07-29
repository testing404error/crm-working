const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTYxMjA4OCwiZXhwIjoyMDY3MTg4MDg4fQ.-wohIGKgFu6gX-36CTsin_pDDmg6AbM7H_rQKeLZXOg'
);

async function fixUserSignupTrigger() {
  try {
    console.log('🔧 Fixing user signup trigger...');
    
    // First, drop existing trigger
    console.log('1. Dropping existing trigger...');
    await supabase.rpc('query', { 
      query: "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;" 
    });
    
    // Create the function
    console.log('2. Creating trigger function...');
    const functionSQL = `
      CREATE OR REPLACE FUNCTION public.handle_new_user_signup() 
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.users (
          auth_user_id,
          name,
          email,
          role,
          team,
          status,
          avatar
        ) VALUES (
          NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
          NEW.email,
          CASE 
            WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
            WHEN NEW.raw_user_meta_data->>'role' = 'manager' THEN 'admin'
            ELSE 'user'
          END,
          COALESCE(NEW.raw_user_meta_data->>'team', 'Default Team'),
          'Active',
          COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop')
        );
        
        RETURN NEW;
      EXCEPTION
        WHEN others THEN
          RAISE WARNING 'Error creating user record: %', SQLERRM;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    const { error: funcError } = await supabase.rpc('query', { query: functionSQL });
    
    if (funcError) {
      console.error('❌ Error creating function:', funcError);
      return;
    }
    
    console.log('✅ Function created successfully!');
    
    // Create the trigger
    console.log('3. Creating trigger...');
    const triggerSQL = `
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();
    `;
    
    const { error: triggerError } = await supabase.rpc('query', { query: triggerSQL });
    
    if (triggerError) {
      console.error('❌ Error creating trigger:', triggerError);
      return;
    }
    
    console.log('✅ Trigger created successfully!');
    
    // Create missing user records for existing auth users
    console.log('4. Creating missing user records...');
    const insertSQL = `
      INSERT INTO public.users (auth_user_id, name, email, role, team, status, avatar)
      SELECT 
        au.id,
        COALESCE(au.raw_user_meta_data->>'name', 'Existing User'),
        au.email,
        CASE 
          WHEN au.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
          WHEN au.raw_user_meta_data->>'role' = 'manager' THEN 'admin'
          ELSE 'user'
        END,
        COALESCE(au.raw_user_meta_data->>'team', 'Default Team'),
        'Active',
        COALESCE(au.raw_user_meta_data->>'avatar_url', 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop')
      FROM auth.users au
      WHERE au.id NOT IN (SELECT auth_user_id FROM public.users WHERE auth_user_id IS NOT NULL)
      ON CONFLICT (auth_user_id) DO NOTHING;
    `;
    
    const { error: insertError } = await supabase.rpc('query', { query: insertSQL });
    
    if (insertError) {
      console.error('❌ Error creating missing user records:', insertError);
    } else {
      console.log('✅ Missing user records created!');
    }
    
    console.log('🎉 User signup trigger fix completed!');
    
  } catch (err) {
    console.error('❌ Script execution failed:', err);
  }
}

fixUserSignupTrigger();
