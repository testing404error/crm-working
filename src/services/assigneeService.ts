import { supabase } from '../lib/supabaseClient';
import { Assignee } from '../types';

// ✅ ASSIGNEE MANAGEMENT - Only for lead/opportunity assignment, not user creation
// This service manages which existing users can be assigned to leads/opportunities

/**
 * Get all users who can be assigned to leads/opportunities
 * This includes existing users only, not creating new ones
 */
export const getAssignees = async (): Promise<Assignee[]> => {
  try {
    console.log('🔍 Fetching assignees from users table...');
    
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .order('name');
    
    if (error) {
      console.error('Error fetching users:', error);
      throw new Error(error.message);
    }
    
    console.log(`✅ Fetched ${data?.length || 0} users for assignment`);
    
    // Add default status for compatibility
    const assignees = (data || []).map(user => ({ 
      ...user, 
      status: 'Active' 
    }));
    
    return assignees;
  } catch (error) {
    console.error('Error fetching assignees:', error);
    return [];
  }
};

/**
 * Get assignee relationships - who has access to whose data
 * This shows the access control relationships between users
 */
export const getAssigneeRelationships = async (userId?: string) => {
  try {
    let query = supabase
      .from('access_control')
      .select(`
        id,
        user_id,
        granted_to_user_id,
        granted_at,
        users!access_control_user_id_fkey(id, name, email, role),
        users!access_control_granted_to_user_id_fkey(id, name, email, role)
      `);
    
    if (userId) {
      // Get access grants where this user is either the grantor or grantee
      query = query.or(`user_id.eq.${userId},granted_to_user_id.eq.${userId}`);
    }
    
    const { data, error } = await query.order('granted_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  } catch (error) {
    console.warn('Could not fetch assignee relationships:', error);
    return [];
  }
};

/**
 * Grant access from one user to another
 * This allows the grantee to see the grantor's leads and opportunities
 */
export const addAssigneeRelationship = async (grantorId: string, granteeId: string) => {
  // Validate that we're only creating assignee relationships manually from the UI
  if (!grantorId || !granteeId) {
    console.error('Invalid user IDs provided for assignee relationship');
    throw new Error('Invalid user IDs provided');
  }

  try {
    console.log(`🔗 Granting access: ${grantorId} -> ${granteeId}`);
    
    // Assuming existence checks are already handled in UI logic
    const { data, error } = await supabase
      .from('access_control')
      .insert([{ user_id: grantorId, granted_to_user_id: granteeId }])
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {  // Unique constraint violation
        throw new Error('Access relationship already exists');
      }
      throw new Error(`Failed to create access relationship: ${error.message}`);
    }
    
    console.log('✅ Access granted successfully for manual assignee addition');
    return data;
  } catch (error) {
    console.error('Could not add assignee relationship:', error);
    throw error;
  }
};

/**
 * Revoke access between users
 * This removes the grantee's ability to see the grantor's data
 * Also cleans up any related pending access requests
 */
export const removeAssigneeRelationship = async (grantorId: string, granteeId: string) => {
  try {
    console.log(`🔗 Revoking access: ${grantorId} -> ${granteeId}`);
    
    // First, get the auth IDs for both users
    const [grantorAuth, granteeAuth] = await Promise.all([
      supabase.from('users').select('auth_user_id').eq('id', grantorId).single(),
      supabase.from('users').select('auth_user_id').eq('id', granteeId).single()
    ]);
    
    if (grantorAuth.error || granteeAuth.error) {
      throw new Error('Failed to get user authentication IDs');
    }
    
    // Delete from access_control table
    const { error: accessControlError } = await supabase
      .from('access_control')
      .delete()
      .eq('user_id', grantorId)
      .eq('granted_to_user_id', granteeId);
    
    if (accessControlError) {
      console.warn('Failed to delete from access_control:', accessControlError.message);
    }
    
    // Also clean up any pending access requests between these users
    // Check both directions: grantor as requester or receiver
    const { error: requestsError } = await supabase
      .from('pending_access_requests')
      .delete()
      .or(`and(requester_id.eq.${grantorAuth.data.auth_user_id},receiver_id.eq.${granteeAuth.data.auth_user_id}),and(requester_id.eq.${granteeAuth.data.auth_user_id},receiver_id.eq.${grantorAuth.data.auth_user_id})`);
    
    if (requestsError) {
      console.warn('Failed to delete from pending_access_requests:', requestsError.message);
    }
    
    // Clean up user permissions that might have been granted
    const { error: permissionsError } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', granteeAuth.data.auth_user_id)
      .eq('granted_by', grantorAuth.data.auth_user_id);
    
    if (permissionsError) {
      console.warn('Failed to delete from user_permissions:', permissionsError.message);
    }
    
    console.log('✅ Access revoked successfully');
  } catch (error) {
    console.error('Could not remove assignee relationship:', error);
    throw error;
  }
};

/**
 * Get users who have been granted access to the current user's data
 * This shows who can see the current user's leads and opportunities
 */
export const getUsersWithAccessToMyData = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('access_control')
      .select(`
        id,
        granted_to_user_id,
        granted_at
      `)
      .eq('user_id', userId)
      .order('granted_at', { ascending: false });
    
    if (error) throw new Error(error.message);
    
    // Manually fetch user details for each granted user
    const enrichedData = await Promise.all(
      (data || []).map(async (access) => {
        const { data: userInfo, error: userError } = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('id', access.granted_to_user_id)
          .single();
          
        return {
          ...access,
          users: userError ? { id: access.granted_to_user_id, name: 'Unknown', email: 'unknown@example.com', role: 'user' } : userInfo
        };
      })
    );
    
    return enrichedData;
  } catch (error) {
    console.error('Error fetching users with access:', error);
    return [];
  }
};

/**
 * Get users whose data the current user has access to
 * This shows whose leads and opportunities the current user can see
 */
export const getUsersIHaveAccessTo = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('access_control')
      .select(`
        id,
        user_id,
        granted_at
      `)
      .eq('granted_to_user_id', userId)
      .order('granted_at', { ascending: false });
    
    if (error) throw new Error(error.message);
    
    // Manually fetch user details for each user whose data I have access to
    const enrichedData = await Promise.all(
      (data || []).map(async (access) => {
        const { data: userInfo, error: userError } = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('id', access.user_id)
          .single();
          
        return {
          ...access,
          users: userError ? { id: access.user_id, name: 'Unknown', email: 'unknown@example.com', role: 'user' } : userInfo
        };
      })
    );
    
    return enrichedData;
  } catch (error) {
    console.error('Error fetching accessible users:', error);
    return [];
  }
};

/**
 * Check if one user has access to another user's data
 */
export const checkUserAccess = async (grantorId: string, granteeId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('access_control')
      .select('id')
      .eq('user_id', grantorId)
      .eq('granted_to_user_id', granteeId)
      .single();
    
    return !error && !!data;
  } catch (error) {
    return false;
  }
};

// ❌ REMOVED: Functions that create users
// User creation should only happen through proper signup process
// addAssignee, updateAssignee, deleteAssignee are no longer available
// Use User Management in Settings for user operations
