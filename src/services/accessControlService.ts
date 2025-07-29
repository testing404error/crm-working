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
      
      const adminIds: string[] = [];
      
      // Get all users from auth and check for admin role
      try {
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        
        if (authUsers?.users) {
          const adminUsers = authUsers.users.filter(user => 
            user.user_metadata?.role === 'admin'
          );
          
          const foundAdminIds = adminUsers.map(user => user.id);
          adminIds.push(...foundAdminIds);
          
          console.log(`✅ Found ${foundAdminIds.length} admin users`);
        }
      } catch (adminError) {
        console.warn('Failed to fetch admin users from auth API:', adminError.message);
        // Fallback: Try to get admin IDs from the users table with role check
        try {
          const { data: publicUsers } = await supabase
            .from('users')
            .select('auth_user_id')
            .eq('role', 'admin');
          
          if (publicUsers) {
            const publicAdminIds = publicUsers.map(u => u.auth_user_id).filter(Boolean);
            adminIds.push(...publicAdminIds);
            console.log(`✅ Found ${publicAdminIds.length} admin users from public table`);
          }
        } catch (publicError) {
          console.warn('Failed to fetch admin users from public table:', publicError.message);
        }
      }
      
      const uniqueAdminIds = [...new Set(adminIds)];
      console.log('🎯 Final admin user IDs:', uniqueAdminIds);
      
      return uniqueAdminIds;
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
      
      console.log(`🔍 New Access Control - User: ${userEmail}, ID: ${user.id}, isAdmin: ${isAdmin}`);
      
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
        // FIXED: Use direct JOIN instead of foreign key reference
        const { data: accessGrants, error: accessError } = await supabase
          .from('access_control')
          .select(`
            user_id,
            users!inner(auth_user_id, role)
          `)
          .eq('granted_to_user_id', currentDbUserId);
        
        if (!accessError && accessGrants) {
          console.log(`🔍 Found ${accessGrants.length} access grants for user ${currentDbUserId}`);
          for (const grant of accessGrants) {
            // Check if the grantor is an admin by checking the public users table role
            const grantorUser = grant.users;
            console.log(`🔍 Checking grant: user_id=${grant.user_id}, grantor_role=${grantorUser?.role}`);
            if (grantorUser?.role === 'admin') {
              accessibleUserIds.push(grant.user_id);
              console.log(`✅ Assignee access granted to admin user: ${grant.user_id}`);
            } else {
              console.log(`❌ Grant is not from admin (role: ${grantorUser?.role})`);
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
        const { data: hasPermission, error: permissionError } = await supabase.rpc(
          'user_can_view_other_users_data',
          { check_user_id: user.id }
        );
        
        if (!permissionError && hasPermission) {
          console.log('🔓 User has "Can View Other Users Data" permission - granting access to ALL data');
          
          // Get all user IDs from the users table
          const { data: allUsers, error: usersError } = await supabase
            .from('users')
            .select('id');
          
          if (!usersError && allUsers) {
            const allUserIds = allUsers.map(u => u.id);
            accessibleUserIds.push(...allUserIds);
            console.log(`✅ Permission granted access to ${allUserIds.length} users`);
          }
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

      // Get user details for all accessible users from auth.users
      try {
        const { data: authData } = await supabase.auth.admin.listUsers();
        const allAuthUsers = authData?.users || [];
        
        const accessibleUsers = allAuthUsers.filter(user => 
          accessibleUserIds.includes(user.id)
        );

        return accessibleUsers.map(user => ({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email || 'Unknown User'
        }));
      } catch (adminError) {
        console.warn('Failed to fetch user details from admin API:', adminError.message);
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
