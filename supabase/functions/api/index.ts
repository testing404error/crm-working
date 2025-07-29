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
          console.log('Full payload received:', JSON.stringify(payload));
          const { receiver_id } = payload ?? {};
          
          if (!receiver_id) {
            console.log('Missing receiver_id in payload');
            return createCorsResponse({ error: 'receiver_id is required' }, 400);
          }
          
          console.log('Raw receiver_id received:', receiver_id);
          console.log('Type of receiver_id:', typeof receiver_id);
          
          // Check if receiver_id is an email (contains @) and convert to UUID
          let actualReceiverId = receiver_id;
          let targetUserPublicId: string | null = null;
          
          if (receiver_id.includes('@')) {
            console.log('receiver_id appears to be an email, looking up user...');
            try {
              // Look up the user by email to get their auth UUID
              const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
              
              if (listError) {
                console.error('Failed to list users:', listError);
                throw new Error(`Failed to lookup users: ${listError.message}`);
              }
              
              const targetUser = authUsers?.users?.find(u => u.email === receiver_id);
              
              if (!targetUser) {
                return createCorsResponse({ 
                  error: `User with email ${receiver_id} not found` 
                }, 404);
              }
              
              actualReceiverId = targetUser.id; // This is the auth user ID
              console.log('Converted email to auth UUID:', actualReceiverId);
              
              // Now get the public.users ID for this auth user
              const { data: publicUser, error: publicUserError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('auth_user_id', targetUser.id)
                .single();
                
              if (publicUserError || !publicUser) {
                console.error('Failed to find public user record:', publicUserError);
                return createCorsResponse({ 
                  error: `User profile not found for ${receiver_id}. Please ensure the user account is properly set up.` 
                }, 404);
              }
              
              targetUserPublicId = publicUser.id;
              console.log('Found public user ID:', targetUserPublicId);
              
            } catch (emailLookupError) {
              console.error('Email lookup failed:', emailLookupError);
              return createCorsResponse({ 
                error: `Failed to find user with email ${receiver_id}: ${emailLookupError.message}` 
              }, 500);
            }
          } else {
            // If it's already a UUID, check if it's auth ID or public ID
            console.log('receiver_id appears to be a UUID, determining type...');
            
            // First check if it's a public.users ID
            console.log('Checking if receiver_id is a public user ID...');
            const { data: publicUserCheck, error: publicCheckError } = await supabaseAdmin
              .from('users')
              .select('id, auth_user_id')
              .eq('id', receiver_id)
              .single();
              
            console.log('Public user check result:', { data: publicUserCheck, error: publicCheckError });
              
            if (!publicCheckError && publicUserCheck) {
              console.log('receiver_id is a public user ID');
              actualReceiverId = publicUserCheck.auth_user_id; // Use auth ID for access requests
              targetUserPublicId = publicUserCheck.id; // Store public ID
              console.log('Using auth_user_id:', actualReceiverId, 'public_id:', targetUserPublicId);
            } else {
              // Assume it's an auth user ID and try to find the public user
              console.log('Checking if receiver_id is an auth user ID...');
              const { data: publicUser, error: publicUserError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('auth_user_id', receiver_id)
                .single();
                
              console.log('Auth user check result:', { data: publicUser, error: publicUserError });
                
              if (!publicUserError && publicUser) {
                console.log('receiver_id is an auth user ID');
                actualReceiverId = receiver_id; // Keep as auth ID
                targetUserPublicId = publicUser.id; // Store public ID
                console.log('Using auth_user_id:', actualReceiverId, 'public_id:', targetUserPublicId);
              } else {
                console.error('Failed to find user in either table:', { publicCheckError, publicUserError });
                return createCorsResponse({ 
                  error: `Invalid user ID: ${receiver_id}. User not found in system.` 
                }, 400);
              }
            }
          }
          
          console.log('Attempting to insert request from', user.id, 'to', actualReceiverId);
          
          // Check if pending_access_requests table exists, create if not
          try {
            const { data, error } = await userClient
              .from('pending_access_requests')
              .insert({ requester_id: user.id, receiver_id: actualReceiverId })
              .select();

            if (error) {
              console.error('Database insert error:', error);
              
              // Handle table not found error
              if (error.message.includes('does not exist') || error.code === '42P01') {
                return createCorsResponse({ 
                  error: 'Access request system is not properly configured. Please contact your administrator.' 
                }, 503);
              }
              
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
          } catch (dbError) {
            console.error('Database operation failed:', dbError);
            return createCorsResponse({ 
              error: `Database operation failed: ${dbError.message}` 
            }, 500);
          }
        } catch (err) {
          console.error('SEND_REQUEST exception:', err);
          return createCorsResponse({ 
            error: `Internal server error: ${err.message}` 
          }, 500);
        }
      }

      case 'GET_PENDING_REQUESTS': {
        try {
          console.log('GET_PENDING_REQUESTS: Starting request for user:', user.id);
          
          // Try using RPC function first
          const { data: rpcData, error: rpcError } = await userClient.rpc('get_pending_requests_for_user');
          
          if (!rpcError && rpcData) {
            console.log('RPC function succeeded, returning data:', rpcData.length, 'requests');
            return createCorsResponse(rpcData, 200);
          }
          
          console.log('RPC function failed or unavailable, using fallback query. Error:', rpcError?.message);
          
          // Fallback: Direct query if function doesn't exist
          const { data, error } = await supabaseAdmin
            .from('pending_access_requests')
            .select(`
              id,
              requester_id,
              created_at,
              status
            `)
            .eq('receiver_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
          
          if (error) {
            console.error('Direct query failed:', error);
            throw new Error(`Failed to fetch pending requests: ${error.message}`);
          }
          
          console.log('Direct query succeeded, found', data?.length || 0, 'pending requests');
          
          // Get requester details
          const requests = [];
          for (const request of data || []) {
            try {
              const { data: requesterData, error: requesterError } = await supabaseAdmin.auth.admin.getUserById(request.requester_id);
              
              if (requesterError) {
                console.warn(`Failed to get requester data for ${request.requester_id}:`, requesterError);
              }
              
              requests.push({
                id: request.id,
                requester: {
                  email: requesterData?.user?.email || 'Unknown User',
                  id: request.requester_id,
                  name: requesterData?.user?.user_metadata?.name || requesterData?.user?.email || 'Unknown'
                },
                created_at: request.created_at,
                status: request.status
              });
            } catch (userError) {
              console.error(`Error processing request ${request.id}:`, userError);
              // Include the request even if we can't get user details
              requests.push({
                id: request.id,
                requester: {
                  email: 'Unknown User',
                  id: request.requester_id,
                  name: 'Unknown'
                },
                created_at: request.created_at,
                status: request.status
              });
            }
          }
          
          console.log('Processed pending requests successfully:', requests.length);
          return createCorsResponse(requests, 200);
          
        } catch (error) {
          console.error('GET_PENDING_REQUESTS error:', error);
          return createCorsResponse({ error: error.message || 'Failed to fetch pending requests' }, 500);
        }
      }

      case 'UPDATE_REQUEST_STATUS': {
        const { request_id, new_status } = payload ?? {};
        if (!request_id || !new_status) {
          return createCorsResponse({ error: 'request_id and new_status are required' }, 400);
        }

        if (!['accepted', 'rejected'].includes(new_status)) {
          return createCorsResponse({ error: 'new_status must be either "accepted" or "rejected"' }, 400);
        }

        try {
          // Update the request status
          const { data, error } = await supabaseAdmin
            .from('pending_access_requests')
            .update({ status: new_status, updated_at: new Date().toISOString() })
            .eq('id', request_id)
            .eq('receiver_id', user.id)
            .select()
            .single();

          if (error) throw new Error(error.message);
          if (!data) throw new Error('Request not found or you do not have permission to update it');

          // IMPORTANT: DO NOT automatically create access_control relationships here.
          // Access control relationships (assignee status) should ONLY be created
          // through the dedicated Assignees section in Settings.
          // 
          // Accepting an access request should only:
          // 1. Update the request status to 'accepted'
          // 2. Allow the admin to toggle "Can View Other Users' Data" permission
          // 
          // The assignee relationship is a separate concept and should be managed separately.
          
          console.log('Access request accepted. Assignee relationships must be created manually through Assignees section.');
          
          return createCorsResponse({ success: true, data }, 200);
        } catch (error) {
          console.error('UPDATE_REQUEST_STATUS error:', error);
          return createCorsResponse({ error: error.message }, 500);
        }
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

        try {
          // First get the request details to identify the users involved
          const { data: requestData, error: fetchError } = await supabaseAdmin
            .from('pending_access_requests')
            .select('requester_id, receiver_id, status')
            .eq('id', request_id)
            .eq('requester_id', user.id) // Only requester can revoke
            .single();

          if (fetchError || !requestData) {
            return createCorsResponse({ error: 'Access request not found or you do not have permission to revoke it' }, 404);
          }

          // Get auth user data to determine roles
          const [requesterAuth, receiverAuth] = await Promise.all([
            supabaseAdmin.auth.admin.getUserById(requestData.requester_id),
            supabaseAdmin.auth.admin.getUserById(requestData.receiver_id)
          ]);

          // Get the public.users IDs for cleanup
          const [requesterPublic, receiverPublic] = await Promise.all([
            supabaseAdmin.from('users').select('id').eq('auth_user_id', requestData.requester_id).single(),
            supabaseAdmin.from('users').select('id').eq('auth_user_id', requestData.receiver_id).single()
          ]);

          // Delete the access request
          const { error: deleteError } = await supabaseAdmin
            .from('pending_access_requests')
            .delete()
            .eq('id', request_id)
            .eq('requester_id', user.id);

          if (deleteError) throw new Error(deleteError.message);

          // Clean up related access control records if they exist and request was accepted
          if (requestData.status === 'accepted' && requesterPublic.data && receiverPublic.data) {
            const requesterIsAdmin = requesterAuth?.user?.raw_user_meta_data?.role === 'admin';
            const receiverIsAdmin = receiverAuth?.user?.raw_user_meta_data?.role === 'admin';
            
            console.log('Revoking access control:', {
              requesterIsAdmin,
              receiverIsAdmin,
              requesterId: requesterPublic.data.id,
              receiverId: receiverPublic.data.id
            });
            
            if (requesterIsAdmin && !receiverIsAdmin) {
              // Admin was requester, so receiver had access to admin's data
              await supabaseAdmin
                .from('access_control')
                .delete()
                .eq('user_id', requesterPublic.data.id)       // Admin's data
                .eq('granted_to_user_id', receiverPublic.data.id); // User who had access
            } else if (!requesterIsAdmin && receiverIsAdmin) {
              // Regular user was requester, so admin had access to user's data  
              await supabaseAdmin
                .from('access_control')
                .delete()
                .eq('user_id', requesterPublic.data.id)       // User's data
                .eq('granted_to_user_id', receiverPublic.data.id); // Admin who had access
            } else {
              // Both are regular users or both are admins - requester had access to receiver's data
              await supabaseAdmin
                .from('access_control')
                .delete()
                .eq('user_id', receiverPublic.data.id)       // Receiver's data
                .eq('granted_to_user_id', requesterPublic.data.id); // Requester who had access
            }

            // Remove user permissions for the receiver if they were granted by the requester
            await supabaseAdmin
              .from('user_permissions')
              .delete()
              .eq('user_id', requestData.receiver_id)
              .eq('granted_by', user.id);
          }

          return createCorsResponse({ success: true }, 200);
        } catch (error) {
          console.error('REVOKE_ACCESS error:', error);
          return createCorsResponse({ error: error.message }, 500);
        }
      }

      // ❌ REMOVED: Login As/Impersonation functionality
      // This has been replaced with the new access request flow where:
      // 1. Admin sends a Request Access to a user
      // 2. If the user accepts, they are added to the admin's access group
      // 3. Admin can then toggle "Can access other users' data" permission

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
            .select('id, receiver_id, created_at')
            .eq('requester_id', user.id)
            .eq('status', 'accepted');

          if (acceptedError) throw new Error(acceptedError.message);

          if (!acceptedUsers || acceptedUsers.length === 0) {
            return createCorsResponse([], 200);
          }

          // Deduplicate user IDs to prevent duplicate entries
          const uniqueUserIds = [...new Set(acceptedUsers.map(u => u.receiver_id))];
          const usersWithPermissions = [];

          for (const userId of uniqueUserIds) {
            // Get user details
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
            
            // Get user permissions
            const { data: permission } = await supabaseAdmin
              .from('user_permissions')
              .select('*')
              .eq('user_id', userId)
              .single();

            // Get user role from public users table
            const { data: publicUser } = await supabaseAdmin
              .from('users')
              .select('role')
              .eq('auth_user_id', userId)
              .single();

            usersWithPermissions.push({
              user_id: userId,
              email: userData?.user?.email || 'Unknown',
              name: userData?.user?.user_metadata?.name || userData?.user?.email || 'Unknown User',
              role: userData?.user?.user_metadata?.role || publicUser?.role || 'user',
              can_view_other_users_data: permission?.can_view_other_users_data || false,
              permission_granted_by: permission?.granted_by,
              permission_updated_at: permission?.updated_at,
              access_granted_at: acceptedUsers.find(u => u.receiver_id === userId)?.created_at,
              access_request_id: acceptedUsers.find(u => u.receiver_id === userId)?.id
            });
          }

          return createCorsResponse(usersWithPermissions, 200);
        } catch (error) {
          console.error('GET_USERS_WITH_PERMISSIONS error:', error);
          throw error;
        }
      }

      case 'UPDATE_USER_PERMISSION': {
        const { target_user_id, can_view_other_users_data } = payload ?? {};
        if (!target_user_id || typeof can_view_other_users_data !== 'boolean') {
          return createCorsResponse({ error: 'target_user_id and can_view_other_users_data are required' }, 400);
        }

        try {
          console.log('UPDATE_USER_PERMISSION: Starting permission update for user:', target_user_id);
          
          // Check if current user is admin - try multiple methods
          const { data: currentUserAuth, error: authError } = await supabaseAdmin.auth.admin.getUserById(user.id);
          
          if (authError) {
            console.error('Failed to get current user auth data:', authError);
            return createCorsResponse({ error: 'Failed to verify user permissions' }, 500);
          }
          
          console.log('Current user auth data:', {
            id: currentUserAuth?.user?.id,
            email: currentUserAuth?.user?.email,
            user_metadata: currentUserAuth?.user?.user_metadata,
            raw_user_meta_data: currentUserAuth?.user?.raw_user_meta_data
          });
          
          // Try different ways to check admin role
          const isAdminFromUserMetadata = currentUserAuth?.user?.user_metadata?.role === 'admin';
          const isAdminFromRawMetadata = currentUserAuth?.user?.raw_user_meta_data?.role === 'admin';
          
          // Also check from the public users table
          const { data: publicUser, error: publicUserError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('auth_user_id', user.id)
            .single();
            
          const isAdminFromPublicTable = publicUser?.role === 'admin';
          
          console.log('Admin role checks:', {
            isAdminFromUserMetadata,
            isAdminFromRawMetadata,
            isAdminFromPublicTable,
            publicUserError: publicUserError?.message
          });
          
          const isAdmin = isAdminFromUserMetadata || isAdminFromRawMetadata || isAdminFromPublicTable;
          
          if (!isAdmin) {
            console.log('Access denied: User is not admin');
            return createCorsResponse({ 
              error: 'Only admins can update user permissions. Please ensure your account has admin privileges.' 
            }, 403);
          }
          
          console.log('Admin check passed, proceeding with permission update');
          
          // Get the public user ID for the target user
          const { data: targetPublicUser, error: publicUserError2 } = await supabaseAdmin
            .from('users')
            .select('id, role')
            .eq('auth_user_id', target_user_id)
            .single();
            
          if (publicUserError2 || !targetPublicUser) {
            console.error('Target user not found:', publicUserError2);
            return createCorsResponse({ error: 'Target user not found' }, 404);
          }
          
          console.log('Target user found:', targetPublicUser.id, 'current role:', targetPublicUser.role);
          
          // Store the original role before making changes
          const originalRole = targetPublicUser.role;
          
          // Update user permissions table
          console.log('Updating user permissions table');
          const { error: permissionError } = await supabaseAdmin
            .from('user_permissions')
            .upsert({
              user_id: target_user_id,
              can_view_other_users_data,
              granted_by: user.id,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            
          console.log('Role permission update:', {
            userId: target_user_id,
            canView: can_view_other_users_data,
          });
          if (permissionError) {
            console.error('Permission update error:', permissionError);
            return createCorsResponse({ error: 'Failed to update user permissions' }, 500);
          }
          
          // Update user role based on access permission
          let newRole;
          if (can_view_other_users_data) {
            // When enabling access, change role to 'admin'
            newRole = 'admin';
            console.log('Enabling access - changing user role to admin');
          } else {
            // When disabling access, revert to regular 'user' role
            newRole = 'user';
            console.log(`Disabling access - reverting user role to ${newRole}`);
          }
          
          console.log(`About to update role from '${originalRole}' to '${newRole}' for user ${target_user_id}`);
          
          // Track if role updates succeed
          let publicRoleUpdateSuccess = false;
          let authRoleUpdateSuccess = false;
          
          // Update role in public.users table
          try {
            const { error: roleUpdateError, data: roleUpdateData } = await supabaseAdmin
              .from('users')
              .update({ role: newRole })
              .eq('auth_user_id', target_user_id)
              .select();
              
            if (roleUpdateError) {
              console.error('Public users table role update error:', roleUpdateError);
            } else {
              console.log(`Successfully updated public users table role to: ${newRole}`, roleUpdateData);
              publicRoleUpdateSuccess = true;
            }
          } catch (publicRoleError) {
            console.error('Exception during public role update:', publicRoleError);
          }
          
          // Update role in auth.users metadata
          try {
            const { error: authRoleError, data: authRoleData } = await supabaseAdmin.auth.admin.updateUserById(
              target_user_id,
              {
                user_metadata: {
                  role: newRole
                }
              }
            );
            
            if (authRoleError) {
              console.error('Auth metadata role update error:', authRoleError);
            } else {
              console.log(`Successfully updated auth metadata role to: ${newRole}`, authRoleData);
              authRoleUpdateSuccess = true;
            }
          } catch (authUpdateError) {
            console.error('Exception during auth metadata update:', authUpdateError);
          }
          
          console.log('Role update summary:', {
            originalRole,
            newRole,
            publicRoleUpdateSuccess,
            authRoleUpdateSuccess
          });
          
          console.log('Permission and role update completed successfully');
          return createCorsResponse({ 
            success: true, 
            message: `User permission ${can_view_other_users_data ? 'granted' : 'revoked'} successfully. Role updated to ${newRole}.`,
            newRole: newRole
          }, 200);
          
        } catch (error) {
          console.error('UPDATE_USER_PERMISSION error:', error);
          return createCorsResponse({ error: error.message || 'Failed to update permission' }, 500);
        }
      }

      case 'CREATE_ASSIGNEE_RELATIONSHIP': {
        const { admin_user_id, assignee_user_id } = payload ?? {};
        if (!admin_user_id || !assignee_user_id) {
          return createCorsResponse({ error: 'admin_user_id and assignee_user_id are required' }, 400);
        }

        try {
          console.log('CREATE_ASSIGNEE_RELATIONSHIP: Creating assignee relationship');
          
          // Use the database function to create the relationship
          const { data, error } = await supabaseAdmin.rpc('create_assignee_relationship', {
            admin_user_id: user.id,  // Use current authenticated user
            assignee_user_id: assignee_user_id
          });
          
          if (error) {
            console.error('Failed to create assignee relationship:', error);
            return createCorsResponse({ error: 'Failed to create assignee relationship' }, 500);
          }
          
          if (!data) {
            return createCorsResponse({ error: 'Permission denied: Only admins can create assignee relationships' }, 403);
          }
          
          console.log('Assignee relationship created successfully');
          return createCorsResponse({ success: true, message: 'Assignee relationship created successfully' }, 200);
          
        } catch (error) {
          console.error('CREATE_ASSIGNEE_RELATIONSHIP error:', error);
          return createCorsResponse({ error: error.message || 'Failed to create assignee relationship' }, 500);
        }
      }

      case 'REMOVE_ASSIGNEE_RELATIONSHIP': {
        const { admin_user_id, assignee_user_id } = payload ?? {};
        if (!admin_user_id || !assignee_user_id) {
          return createCorsResponse({ error: 'admin_user_id and assignee_user_id are required' }, 400);
        }

        try {
          console.log('REMOVE_ASSIGNEE_RELATIONSHIP: Removing assignee relationship');
          
          // Use the database function to remove the relationship
          const { data, error } = await supabaseAdmin.rpc('remove_assignee_relationship', {
            admin_user_id: user.id,  // Use current authenticated user
            assignee_user_id: assignee_user_id
          });
          
          if (error) {
            console.error('Failed to remove assignee relationship:', error);
            return createCorsResponse({ error: 'Failed to remove assignee relationship' }, 500);
          }
          
          if (!data) {
            return createCorsResponse({ error: 'Permission denied: Only admins can remove assignee relationships' }, 403);
          }
          
          console.log('Assignee relationship removed successfully');
          return createCorsResponse({ success: true, message: 'Assignee relationship removed successfully' }, 200);
          
        } catch (error) {
          console.error('REMOVE_ASSIGNEE_RELATIONSHIP error:', error);
          return createCorsResponse({ error: error.message || 'Failed to remove assignee relationship' }, 500);
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
