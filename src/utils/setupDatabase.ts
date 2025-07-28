import { supabase } from '../lib/supabaseClient';

export const setupAccessControlDatabase = async () => {
  try {
    // First, check if the table exists by trying to select from it
    const { error: tableCheckError } = await supabase
      .from('pending_access_requests')
      .select('id')
      .limit(1);

    if (tableCheckError && tableCheckError.message.includes('relation "public.pending_access_requests" does not exist')) {
      console.log('Table does not exist. Creating table through SQL...');
      
      // Create the table through a raw SQL query
      const { error: createError } = await supabase.rpc('exec_sql', {
        query: `
          -- Create the pending_access_requests table
          CREATE TABLE IF NOT EXISTS pending_access_requests (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              requester_id UUID NOT NULL,
              receiver_id UUID NOT NULL,
              status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          -- Create indexes for better performance
          CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON pending_access_requests(requester_id);
          CREATE INDEX IF NOT EXISTS idx_access_requests_receiver ON pending_access_requests(receiver_id);
          CREATE INDEX IF NOT EXISTS idx_access_requests_status ON pending_access_requests(status);

          -- Enable Row Level Security
          ALTER TABLE pending_access_requests ENABLE ROW LEVEL SECURITY;
        `
      });

      if (createError) {
        console.error('Error creating table:', createError);
        return false;
      }
      
      console.log('Table created successfully!');
    } else {
      console.log('Table already exists or accessible');
    }
    
    return true;
  } catch (error) {
    console.error('Database setup error:', error);
    return false;
  }
};
