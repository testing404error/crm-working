import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS helper
const createCorsResponse = (body: any, status: number) =>
  new Response(JSON.stringify(body), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/json',
    },
    status,
  });

// Supabase Admin client
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    console.log('=== API FUNCTION START ===');
    console.log('Request URL:', req.url);
    console.log('Request method:', req.method);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    
    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody));
    
    const { action, payload } = requestBody;
    console.log(`Received action: ${action}`);

    // Log environment variables (without sensitive data)
    console.log('SUPABASE_URL available:', !!Deno.env.get('SUPABASE_URL'));
    console.log('SUPABASE_ANON_KEY available:', !!Deno.env.get('SUPABASE_ANON_KEY'));
    console.log('SUPABASE_SERVICE_ROLE_KEY available:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: authHeader ? {
            Authorization: authHeader,
          } : {},
        },
      }
    );

    // Handle setup action first (doesn't require auth)
    if (action === 'SETUP_DATABASE') {
      try {
        // Check if table exists
        const { error: tableCheckError } = await supabaseAdmin
          .from('pending_access_requests')
          .select('id')
          .limit(1);

        if (tableCheckError && tableCheckError.message.includes('does not exist')) {
          // Return instructions for manual setup since automatic creation might not work
          return createCorsResponse({
            success: false,
            requiresManualSetup: true,
            instructions: {
              message: 'Please create the table manually in your Supabase dashboard',
              steps: [
                '1. Go to your Supabase dashboard',
                '2. Navigate to the SQL Editor',
                '3. Run the SQL script provided',
                '4. Come back and refresh this page'
              ],
              sql: `-- Create the pending_access_requests table
CREATE TABLE IF NOT EXISTS pending_access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    can_view_other_users_data BOOLEAN DEFAULT FALSE,
    granted_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON pending_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_receiver ON pending_access_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON pending_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- Enable Row Level Security
ALTER TABLE pending_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for pending_access_requests
CREATE POLICY IF NOT EXISTS "Users can view their own requests" ON pending_access_requests
    FOR SELECT USING (requester_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can insert their own requests" ON pending_access_requests
    FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Receivers can update request status" ON pending_access_requests
    FOR UPDATE USING (receiver_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Requesters can delete their own requests" ON pending_access_requests
    FOR DELETE USING (requester_id = auth.uid());

-- Create policies for user_permissions
CREATE POLICY IF NOT EXISTS "Users can view own permissions" ON user_permissions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Only admin can manage permissions" ON user_permissions
    FOR ALL USING (granted_by = auth.uid());

-- Create stored function to set user data view permission
CREATE OR REPLACE FUNCTION set_user_data_view_permission(
    target_user_id UUID,
    can_view BOOLEAN,
    admin_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert or update the user permission
    INSERT INTO user_permissions (user_id, can_view_other_users_data, granted_by, updated_at)
    VALUES (target_user_id, can_view, admin_user_id, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        can_view_other_users_data = can_view,
        granted_by = admin_user_id,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$;

-- Create function to check if user can view other users' data
CREATE OR REPLACE FUNCTION user_can_view_other_users_data(
    check_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    can_view BOOLEAN := FALSE;
BEGIN
    SELECT can_view_other_users_data INTO can_view
    FROM user_permissions
    WHERE user_id = check_user_id;
    
    RETURN COALESCE(can_view, FALSE);
END;
$$;`
            }
          }, 200);
        } else {
          // Table exists
          return createCorsResponse({ success: true, message: 'Database is already set up' }, 200);
        }
      } catch (error: any) {
        console.error('Database setup error:', error);
        return createCorsResponse({ error: error.message || 'Database setup failed' }, 500);
      }
    }

    // Auth check for all other actions
    console.log('Auth header present:', !!authHeader);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    
    if (userError) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: `User not authenticated: ${userError.message}` }, 401);
    }
    
    if (!userData?.user) {
      console.error('No user data available');
      return createCorsResponse({ error: 'User not authenticated.' }, 401);
    }
    
    console.log('Authenticated user:', userData.user.id);

    const user = userData.user;

    switch (action) {
      case 'GET_AVAILABLE_USERS': {
        try {
          console.log('Fetching available users...');
          const { data, error } = await supabaseAdmin.auth.admin.listUsers();
          
          if (error) {
            console.error('listUsers error:', error);
            throw new Error(`Failed to list users: ${error.message}`);
          }
          
          console.log('Users fetched successfully:', data?.users?.length || 0, 'users');
          return createCorsResponse(data, 200);
        } catch (err) {
          console.error('GET_AVAILABLE_USERS exception:', err);
          throw err;
        }
      }

      case 'SEND_REQUEST': {
        try {
          console.log('Processing SEND_REQUEST...');
          const { receiver_id } = payload ?? {};
          
          if (!receiver_id) {
            console.log('Missing receiver_id in payload');
            return createCorsResponse({ error: 'receiver_id is required' }, 400);
          }
          
          console.log('Attempting to insert request from', user.id, 'to', receiver_id);
          
          const { data, error } = await supabaseAdmin
            .from('pending_access_requests')
            .insert({ requester_id: user.id, receiver_id })
            .select();

          if (error) {
            console.error('Database insert error:', error);
            
            // Handle duplicate request error specifically
            if (error.code === '23505' || error.message.includes('duplicate key')) {
              return createCorsResponse({ 
                error: 'An access request between these users already exists. Please check your pending requests.' 
              }, 409); // 409 Conflict
            }
            
            throw new Error(`Database insert failed: ${error.message}`);
          }
          
          console.log('Request inserted successfully:', data);
          return createCorsResponse({ success: true, data }, 201);
        } catch (err) {
          console.error('SEND_REQUEST exception:', err);
          throw err;
        }
      }

      case 'GET_PENDING_REQUESTS': {
        try {
          const { data, error } = await userClient.rpc('get_pending_requests_for_user');
          if (error) throw new Error(error.message);
          return createCorsResponse(data, 200);
        } catch (err) {
          // Fallback: Direct query if function doesn't exist
          const { data, error } = await supabaseAdmin
            .from('pending_access_requests')
            .select(`
              id,
              requester_id
            `)
            .eq('receiver_id', user.id)
            .eq('status', 'pending');
          
          if (error) throw new Error(error.message);
          
          // Get requester emails
          const requests = [];
          for (const request of data || []) {
            const { data: requesterData } = await supabaseAdmin.auth.admin.getUserById(request.requester_id);
            requests.push({
              id: request.id,
              requester: {
                email: requesterData?.user?.email || 'Unknown',
                id: request.requester_id
              }
            });
          }
          return createCorsResponse(requests, 200);
        }
      }

      case 'UPDATE_REQUEST_STATUS': {
        const { request_id, new_status } = payload ?? {};
        if (!request_id || !new_status) {
          return createCorsResponse({ error: 'request_id and new_status are required' }, 400);
        }

        // First verify the user has permission to update this request (must be the receiver)
        const { data: requestData, error: fetchError } = await supabaseAdmin
          .from('pending_access_requests')
          .select('receiver_id')
          .eq('id', request_id)
          .single();

        if (fetchError || !requestData) {
          return createCorsResponse({ error: 'Request not found' }, 404);
        }

        if (requestData.receiver_id !== user.id) {
          return createCorsResponse({ error: 'You can only update requests sent to you' }, 403);
        }

        // Update the request status with admin privileges
        const { data, error } = await supabaseAdmin
          .from('pending_access_requests')
          .update({ 
            status: new_status,
            updated_at: new Date().toISOString()
          })
          .eq('id', request_id)
          .eq('receiver_id', user.id); // Extra security check

        if (error) throw new Error(error.message);
        return createCorsResponse({ success: true, data }, 200);
      }

      case 'GET_MANAGED_USERS': {
        try {
          const { data, error } = await userClient.rpc('get_managed_users_for_requester');
          if (error) throw new Error(error.message);
          return createCorsResponse(data, 200);
        } catch (err) {
          // Fallback: Direct query if function doesn't exist
          const { data, error } = await supabaseAdmin
            .from('pending_access_requests')
            .select(`
              id,
              receiver_id,
              created_at
            `)
            .eq('requester_id', user.id)
            .eq('status', 'accepted');
          
          if (error) throw new Error(error.message);
          
          // Get user emails
          const managedUsers = [];
          for (const request of data || []) {
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(request.receiver_id);
            managedUsers.push({
              access_request_id: request.id,
              user_id: request.receiver_id,
              email: userData?.user?.email || 'Unknown',
              created_at: request.created_at
            });
          }
          return createCorsResponse(managedUsers, 200);
        }
      }

      case 'REVOKE_ACCESS': {
        const { request_id } = payload ?? {};
        if (!request_id) return createCorsResponse({ error: 'request_id is required' }, 400);

        const { data, error } = await supabaseAdmin
          .from('pending_access_requests')
          .delete()
          .eq('id', request_id)
          .eq('requester_id', user.id);

        if (error) throw new Error(error.message);
        return createCorsResponse({ success: true }, 200);
      }

      case 'IMPERSONATE_USER': {
        const { user_id_to_impersonate } = payload ?? {};
        if (!user_id_to_impersonate) {
          return createCorsResponse({ error: 'user_id_to_impersonate is required' }, 400);
        }

        // Permission check
        const { data: request, error: checkError } = await supabaseAdmin
          .from('pending_access_requests')
          .select('id')
          .eq('requester_id', user.id)
          .eq('receiver_id', user_id_to_impersonate)
          .eq('status', 'accepted')
          .single();

        if (checkError || !request) {
          return createCorsResponse({
            error: 'Access denied. You do not have permission to impersonate this user.',
          }, 403);
        }

        // Fetch target user
        const { data: impersonatedUser, error: fetchUserError } =
          await supabaseAdmin.auth.admin.getUserById(user_id_to_impersonate);

        if (fetchUserError || !impersonatedUser?.user?.email) {
          return createCorsResponse({ error: 'Could not fetch user to impersonate.' }, 404);
        }

        // For now, let's use a simpler approach
        // Return user info and let the client handle the impersonation via admin auth
        console.log('Impersonation approved for user:', impersonatedUser.user.email);

        const response = {
          success: true,
          user: impersonatedUser.user,
          message: 'Impersonation approved'
        };

        console.log('Impersonation response created');
        return createCorsResponse(response, 200);
      }

      case 'GET_ACCESS_HISTORY': {
        try {
          const { data, error } = await userClient.rpc('get_access_history_for_user');
          if (error) throw new Error(error.message);
          return createCorsResponse(data, 200);
        } catch (err) {
          // Fallback: Direct query if function doesn't exist
          const { data, error } = await supabaseAdmin
            .from('pending_access_requests')
            .select(`
              id,
              requester_id,
              receiver_id,
              status,
              created_at,
              updated_at
            `)
            .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('updated_at', { ascending: false });
          
          if (error) throw new Error(error.message);
          
          // Get user emails for each request
          const history = [];
          for (const request of data || []) {
            const [requesterData, receiverData] = await Promise.all([
              supabaseAdmin.auth.admin.getUserById(request.requester_id),
              supabaseAdmin.auth.admin.getUserById(request.receiver_id)
            ]);
            
            history.push({
              id: request.id,
              requester_id: request.requester_id,
              receiver_id: request.receiver_id,
              requester_email: requesterData?.data?.user?.email || 'Unknown',
              receiver_email: receiverData?.data?.user?.email || 'Unknown',
              status: request.status,
              created_at: request.created_at,
              updated_at: request.updated_at
            });
          }
          return createCorsResponse(history, 200);
        }
      }

      case 'GET_USERS_WITH_PERMISSIONS': {
        try {
          // Get all users who have accepted access requests from this admin
          const { data: acceptedUsers, error: acceptedError } = await supabaseAdmin
            .from('pending_access_requests')
            .select('receiver_id, created_at')
            .eq('requester_id', user.id)
            .eq('status', 'accepted');

          if (acceptedError) throw new Error(acceptedError.message);

          if (!acceptedUsers || acceptedUsers.length === 0) {
            return createCorsResponse([], 200);
          }

          const userIds = acceptedUsers.map(u => u.receiver_id);
          const usersWithPermissions = [];

          for (const userId of userIds) {
            // Get user details
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
            
            // Get user permissions
            const { data: permission } = await supabaseAdmin
              .from('user_permissions')
              .select('*')
              .eq('user_id', userId)
              .single();

            usersWithPermissions.push({
              user_id: userId,
              email: userData?.user?.email || 'Unknown',
              name: userData?.user?.user_metadata?.name || userData?.user?.email || 'Unknown User',
              can_view_other_users_data: permission?.can_view_other_users_data || false,
              permission_granted_by: permission?.granted_by,
              permission_updated_at: permission?.updated_at,
              access_granted_at: acceptedUsers.find(u => u.receiver_id === userId)?.created_at
            });
          }

          return createCorsResponse(usersWithPermissions, 200);
        } catch (error) {
          console.error('GET_USERS_WITH_PERMISSIONS error:', error);
          throw error;
        }
      }

      case 'UPDATE_USER_PERMISSION': {
        try {
          const { target_user_id, can_view_other_users_data } = payload ?? {};
          
          if (!target_user_id || typeof can_view_other_users_data !== 'boolean') {
            return createCorsResponse({ 
              error: 'target_user_id and can_view_other_users_data (boolean) are required' 
            }, 400);
          }

          // Verify admin has permission to manage this user (user accepted admin's access request)
          const { data: accessRequest, error: accessError } = await supabaseAdmin
            .from('pending_access_requests')
            .select('id')
            .eq('requester_id', user.id)
            .eq('receiver_id', target_user_id)
            .eq('status', 'accepted')
            .single();

          if (accessError || !accessRequest) {
            return createCorsResponse({ 
              error: 'You do not have permission to manage this user' 
            }, 403);
          }

          // Use the stored function to update the permission
          const { data, error } = await supabaseAdmin.rpc('set_user_data_view_permission', {
            target_user_id,
            can_view: can_view_other_users_data,
            admin_user_id: user.id
          });

          if (error) throw new Error(error.message);

          if (data !== true) {
            return createCorsResponse({ 
              error: 'Failed to update permission - admin verification failed' 
            }, 403);
          }

          return createCorsResponse({ 
            success: true, 
            message: `Permission ${can_view_other_users_data ? 'granted' : 'revoked'} successfully` 
          }, 200);
        } catch (error) {
          console.error('UPDATE_USER_PERMISSION error:', error);
          throw error;
        }
      }


      default:
        return createCorsResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error('Unhandled error:', err);
    return createCorsResponse({ error: err.message || 'Internal Server Error' }, 500);
  }
});
