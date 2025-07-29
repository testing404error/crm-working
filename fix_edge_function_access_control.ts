// COMPLETE FIX FOR EDGE FUNCTION ACCESS CONTROL
// Replace the UPDATE_REQUEST_STATUS and REVOKE_ACCESS cases in your supabase/functions/api/index.ts

// FIXED UPDATE_REQUEST_STATUS case:
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

    // Only create access control relationship when request is accepted
    if (new_status === 'accepted') {
      try {
        const requestData = data;
        
        // Get the public.users IDs for both requester and receiver
        const [requesterAuth, receiverAuth] = await Promise.all([
          supabaseAdmin.auth.admin.getUserById(requestData.requester_id),
          supabaseAdmin.auth.admin.getUserById(requestData.receiver_id)
        ]);
        
        // Find their corresponding public.users records
        const { data: requesterPublic } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('auth_user_id', requestData.requester_id)
          .single();
          
        const { data: receiverPublic } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('auth_user_id', requestData.receiver_id)
          .single();
        
        if (requesterPublic && receiverPublic) {
          // CRITICAL FIX: Always check who has admin role to determine correct access direction
          const requesterIsAdmin = requesterAuth?.data?.user?.raw_user_meta_data?.role === 'admin';
          const receiverIsAdmin = receiverAuth?.data?.user?.raw_user_meta_data?.role === 'admin';
          
          console.log('Access control creation:', {
            requesterIsAdmin,
            receiverIsAdmin,
            requesterId: requesterPublic.id,
            receiverId: receiverPublic.id
          });
          
          if (requesterIsAdmin && !receiverIsAdmin) {
            // Admin requested access, so user (receiver) gets access to admin's (requester's) data
            const { error: accessError } = await supabaseAdmin
              .from('access_control')
              .insert({
                user_id: requesterPublic.id, // Admin's data that is being shared
                granted_to_user_id: receiverPublic.id, // User who gets access to admin's data
                granted_at: new Date().toISOString()
              })
              .select()
              .single();
              
            if (accessError && accessError.code !== '23505') { // Ignore duplicate key errors
              console.error('Failed to create admin-to-user access_control relationship:', accessError);
            } else {
              console.log('✅ User granted access to admin data successfully');
            }
          } else if (!requesterIsAdmin && receiverIsAdmin) {
            // Regular user requested access from admin, so admin gets access to user's data
            const { error: accessError } = await supabaseAdmin
              .from('access_control')
              .insert({
                user_id: requesterPublic.id, // User's data that is being shared
                granted_to_user_id: receiverPublic.id, // Admin who gets access to user's data
                granted_at: new Date().toISOString()
              })
              .select()
              .single();
              
            if (accessError && accessError.code !== '23505') { // Ignore duplicate key errors
              console.error('Failed to create user-to-admin access_control relationship:', accessError);
            } else {
              console.log('✅ Admin granted access to user data successfully');
            }
          } else {
            // Both are regular users or both are admins - requester gets access to receiver's data
            const { error: accessError } = await supabaseAdmin
              .from('access_control')
              .insert({
                user_id: receiverPublic.id, // Receiver's data that is being shared
                granted_to_user_id: requesterPublic.id, // Requester who gets access
                granted_at: new Date().toISOString()
              })
              .select()
              .single();
              
            if (accessError && accessError.code !== '23505') { // Ignore duplicate key errors
              console.error('Failed to create peer access_control relationship:', accessError);
            } else {
              console.log('✅ Peer access granted successfully');
            }
          }
        }
      } catch (relationshipError) {
        console.error('Error creating access relationship:', relationshipError);
        // Don't fail the request update if relationship creation fails
      }
    }
    
    return createCorsResponse({ success: true, data }, 200);
  } catch (error) {
    console.error('UPDATE_REQUEST_STATUS error:', error);
    return createCorsResponse({ error: error.message }, 500);
  }
}

// FIXED REVOKE_ACCESS case:
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

// ALSO ADD THIS NEW CASE for updating user permissions (toggle functionality):
case 'UPDATE_USER_PERMISSION': {
  const { target_user_id, can_view_other_users_data } = payload ?? {};
  if (!target_user_id || typeof can_view_other_users_data !== 'boolean') {
    return createCorsResponse({ error: 'target_user_id and can_view_other_users_data are required' }, 400);
  }

  try {
    // Check if current user is admin or has permission to update this user
    const { data: currentUserAuth } = await supabaseAdmin.auth.admin.getUserById(user.id);
    const isAdmin = currentUserAuth?.user?.raw_user_meta_data?.role === 'admin';
    
    if (!isAdmin) {
      return createCorsResponse({ error: 'Only admins can update user permissions' }, 403);
    }

    // Get the public user ID for the target user
    const { data: targetPublicUser, error: publicUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_user_id', target_user_id)
      .single();

    if (publicUserError || !targetPublicUser) {
      return createCorsResponse({ error: 'Target user not found' }, 404);
    }

    if (can_view_other_users_data) {
      // CREATE access control relationship: User gets access to admin's data
      const { data: adminPublicUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (adminPublicUser) {
        const { error: accessError } = await supabaseAdmin
          .from('access_control')
          .insert({
            user_id: adminPublicUser.id, // Admin's data
            granted_to_user_id: targetPublicUser.id, // User who gets access
            granted_at: new Date().toISOString()
          })
          .select()
          .single();

        if (accessError && accessError.code !== '23505') { // Ignore duplicate key errors
          console.error('Failed to create access control relationship:', accessError);
        }
      }
    } else {
      // REMOVE access control relationship: User loses access to admin's data
      const { data: adminPublicUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (adminPublicUser) {
        await supabaseAdmin
          .from('access_control')
          .delete()
          .eq('user_id', adminPublicUser.id) // Admin's data
          .eq('granted_to_user_id', targetPublicUser.id); // User who loses access
      }
    }

    // Update user permissions table
    const { error: permissionError } = await supabaseAdmin
      .from('user_permissions')
      .upsert({
        user_id: target_user_id,
        can_view_other_users_data,
        granted_by: user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (permissionError) {
      console.error('Permission update error:', permissionError);
    }

    return createCorsResponse({ success: true }, 200);
  } catch (error) {
    console.error('UPDATE_USER_PERMISSION error:', error);
    return createCorsResponse({ error: error.message }, 500);
  }
}
