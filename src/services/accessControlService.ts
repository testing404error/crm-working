import { supabase } from '../lib/supabaseClient';

export interface AccessibleUser {
  id: string;
  email: string;
  name?: string;
}

export const accessControlService = {
  /**
   * Helper function to get admin user IDs from the system
   * Simplified for new schema - only checks auth.users metadata
   * @returns Array of user IDs that have admin role
   */
  async getAdminUserIds(): Promise<string[]> {
    try {
      console.log('🔍 Getting admin user IDs...');
      
      // Get admin user IDs from the users table (return the 'id' field, not 'auth_user_id')
      const { data: publicUsers, error: publicError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');
      
      if (publicError) {
        console.warn('Failed to fetch admin users from public table:', publicError.message);
        return [];
      }
      
      const adminIds = publicUsers?.map(u => u.id).filter(Boolean) || [];
      
      console.log(`✅ Found ${adminIds.length} admin users from public table`);
      console.log('🎯 Final admin user IDs (database IDs):', adminIds);
      
      return adminIds;
    } catch (error) {
      console.error('Error getting admin user IDs:', error);
      return [];
    }
  },

  /**
   * Gets all user IDs that the current user can access data for.
   * UPDATED BEHAVIOR:
   * 1. ADMIN: Automatically has access to ALL leads and opportunities from ALL users
   * 2. ASSIGNED USERS: Auto data sharing - can only see admin's data they're assigned to
   * 3. REGULAR USERS: Only their own data + any "Can access other users' data" permission
   * 
   * @param userId - The current user's ID (database ID, not auth ID)
   * @returns Array of user IDs that the current user can access
   */
  async getAccessibleUserIds(userId: string): Promise<string[]> {
    try {
      // Get current user's role to check if they are admin
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      // Handle authentication errors gracefully
      if (authError || !user) {
        console.warn('🔒 No authenticated user found, returning limited access');
        return userId ? [userId] : [];
      }
      
const userEmail = user.email;
      const isAdmin = user.user_metadata?.role === 'admin';
      
      // Diagnostic: Log user role and metadata
      console.log(`🔍 New Access Control - User: ${userEmail}, ID: ${user.id}, Role: ${user.user_metadata?.role}`);
      console.log(`🔍 User Metadata:`, user.user_metadata);
      
      // Get the public.users table ID for the current auth user
      const { data: currentPublicUser, error: publicUserError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
        
      let accessibleUserIds = [];
      const currentDbUserId = currentPublicUser?.id || userId;
      
      // Always include own data
      accessibleUserIds.push(currentDbUserId);
      
      // ✅ 1. ADMIN ROLE BEHAVIOR: Automatically access ALL leads and opportunities
      if (isAdmin) {
        console.log('🔑 ADMIN detected - granting access to ALL data from ALL users');
        
        // Get all user IDs from the users table
        const { data: allUsers, error: usersError } = await supabase
          .from('users')
          .select('id');
        
        if (!usersError && allUsers) {
          const allUserIds = allUsers.map(u => u.id);
          accessibleUserIds.push(...allUserIds);
          console.log(`✅ Admin granted access to ${allUserIds.length} users`);
        }
        
        const uniqueIds = [...new Set(accessibleUserIds)];
        console.log(`🎯 Final admin accessible user IDs: ${uniqueIds.length} users`);
        return uniqueIds;
      }
      
      // ✅ 2. ASSIGNED USERS – Auto Data Sharing
      // Check if this user is in the assignees list for any admin
      try {
        // FIXED: Use separate queries to avoid JOIN ambiguity
        const { data: accessGrants, error: accessError } = await supabase
          .from('access_control')
          .select('user_id')
          .eq('granted_to_user_id', currentDbUserId);
        
        if (!accessError && accessGrants && accessGrants.length > 0) {
          console.log(`🔍 Found ${accessGrants.length} access grants for user ${currentDbUserId}`);
          
          // Get user details for each grant in a separate query
          for (const grant of accessGrants) {
            const { data: grantorUser, error: userError } = await supabase
              .from('users')
              .select('id, role')
              .eq('id', grant.user_id)
              .single();
              
            if (!userError && grantorUser) {
              console.log(`🔍 Checking grant: user_id=${grant.user_id}, grantor_role=${grantorUser.role}`);
              if (grantorUser.role === 'admin') {
                accessibleUserIds.push(grant.user_id);
                console.log(`✅ Assignee access granted to admin user: ${grant.user_id}`);
              } else {
                console.log(`❌ Grant is not from admin (role: ${grantorUser.role})`);
              }
            } else if (userError) {
              console.warn(`Could not fetch grantor user details for ${grant.user_id}:`, userError.message);
            }
          }
        } else if (accessError) {
          console.warn('Access control grants query failed:', accessError.message);
        } else {
          console.log('✅ Access control grants query succeeded but no grants found');
        }
      } catch (accessError) {
        console.warn('Could not check access control grants:', accessError);
      }
      
      // ✅ 3. "Can View Other Users' Data" Permission Check
      try {
        // Check user_permissions table directly instead of using RPC function
        const { data: userPermission, error: permissionError } = await supabase
          .from('user_permissions')
          .select('can_view_other_users_data, granted_by')
          .eq('user_id', user.id)
          .single();
        
        const hasPermission = !permissionError && userPermission?.can_view_other_users_data === true;
        
        console.log(`🔍 Checking user permission:`, { hasPermission, userPermission, permissionError: permissionError?.message });
        
        if (hasPermission) {
          console.log(`🔓 User has "Can View Other Users Data" permission - granting access to ALL data`);
          
          // When a user has "Can View Other Users' Data" permission,
          // they should have access to ALL users, not just admins.
          const { data: allUsers, error: usersError } = await supabase
            .from('users')
            .select('id');
          
          if (!usersError && allUsers) {
            const allUserIds = allUsers.map(u => u.id);
            accessibleUserIds.push(...allUserIds);
            console.log(`✅ Full access granted to ${allUserIds.length} users`);
          }
        } else if (permissionError) {
          // Only log as warning if it's not a "table doesn't exist" error
          console.warn('Could not check user view permission:', permissionError.message);
        }
      } catch (permissionError) {
        console.warn('Could not check user view permission:', permissionError);
      }
      
      // Remove duplicates and return
      const uniqueIds = [...new Set(accessibleUserIds)];
      console.log(`📊 Final accessible user IDs: ${uniqueIds.length} users`);
      return uniqueIds;
      
    } catch (error) {
      console.error('Error getting accessible user IDs:', error);
      return [userId];
    }
  },

  /**
   * Gets detailed information about accessible users
   * @param userId - The current user's ID
   * @returns Array of accessible user objects with details
   */
  async getAccessibleUsers(userId: string): Promise<AccessibleUser[]> {
    try {
      const accessibleUserIds = await this.getAccessibleUserIds(userId);
      
      if (accessibleUserIds.length === 1) {
        // Only has access to own data
        const { data: { user } } = await supabase.auth.getUser();
        return [{
          id: userId,
          email: user?.email || '',
          name: user?.user_metadata?.name || 'You'
        }];
      }

      // Get user details from the public users table
      try {
        const { data: publicUsers, error: usersError } = await supabase
          .from('users')
          .select('id, auth_user_id, email, name')
          .in('id', accessibleUserIds);
        
        if (usersError) {
          console.warn('Failed to fetch user details from public table:', usersError.message);
          // Fallback: return basic info for accessible user IDs
          return accessibleUserIds.map(id => ({
            id,
            email: `user-${id.slice(0, 8)}@example.com`,
            name: `User ${id.slice(0, 8)}`
          }));
        }
        
        return publicUsers?.map(user => ({
          id: user.id,
          email: user.email || '',
          name: user.name || user.email || 'Unknown User'
        })) || [];
      } catch (fetchError) {
        console.warn('Failed to fetch user details:', fetchError.message);
        // Fallback: return basic info for accessible user IDs
        return accessibleUserIds.map(id => ({
          id,
          email: `user-${id.slice(0, 8)}@example.com`,
          name: `User ${id.slice(0, 8)}`
        }));
      }
    } catch (error) {
      console.error('Error getting accessible users:', error);
      return [];
    }
  },

  /**
   * Check if current user can access data belonging to a specific user
   * @param currentUserId - The current user's ID
   * @param targetUserId - The target user's ID to check access for
   * @returns boolean indicating if access is allowed
   */
  async canAccessUserData(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (currentUserId === targetUserId) {
      return true; // Can always access own data
    }

    const accessibleUserIds = await this.getAccessibleUserIds(currentUserId);
    return accessibleUserIds.includes(targetUserId);
  }
};
