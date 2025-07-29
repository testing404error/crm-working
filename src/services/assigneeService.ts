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
    // First try with status column
    let { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, status')
      .eq('status', 'Active')  // Only active users
      .order('name');
    
    // If status column doesn't exist, fetch without status filter
    if (error && error.message.includes('column users.status does not exist')) {
      console.warn('Status column not found, fetching all users');
      const fallbackResult = await supabase
        .from('users')
        .select('id, name, email, role')
        .order('name');
      
      if (fallbackResult.error) throw new Error(fallbackResult.error.message);
      // Add default status for compatibility
      data = (fallbackResult.data || []).map(user => ({ ...user, status: 'Active' }));
    } else if (error) {
      throw new Error(error.message);
    }
    
    return data || [];
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
  try {
    console.log(`🔗 Granting access: ${grantorId} -> ${granteeId}`);
    
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
    
    console.log('✅ Access granted successfully');
    return data;
  } catch (error) {
    console.error('Could not add assignee relationship:', error);
    throw error;
  }
};

/**
 * Revoke access between users
 * This removes the grantee's ability to see the grantor's data
 */
export const removeAssigneeRelationship = async (grantorId: string, granteeId: string) => {
  try {
    console.log(`🔗 Revoking access: ${grantorId} -> ${granteeId}`);
    
    const { error } = await supabase
      .from('access_control')
      .delete()
      .eq('user_id', grantorId)
      .eq('granted_to_user_id', granteeId);
    
    if (error) {
      throw new Error(`Failed to remove access relationship: ${error.message}`);
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
