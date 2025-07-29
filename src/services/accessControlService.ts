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
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      
      if (authUsers?.users) {
        const adminUsers = authUsers.users.filter(user => 
          user.user_metadata?.role === 'admin'
        );
        
        const foundAdminIds = adminUsers.map(user => user.id);
        adminIds.push(...foundAdminIds);
        
        console.log(`✅ Found ${foundAdminIds.length} admin users`);
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
   * Simplified version for new schema:
   * 1. The user's own ID (always)
   * 2. If user is admin: ALL user IDs in the system
   * 3. If user has access control grants: those user IDs
   * 
   * @param userId - The current user's ID
   * @returns Array of user IDs that the current user can access
   */
  async getAccessibleUserIds(userId: string): Promise<string[]> {
    try {
      // Get current user's role to check if they are admin
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      // Handle authentication errors gracefully
      if (authError || !user) {
        console.warn('🔒 No authenticated user found, returning limited access');
        // Return only the passed userId if no authenticated user
        return userId ? [userId] : [];
      }
      
      const userEmail = user.email;
      const isAdmin = user.user_metadata?.role === 'admin';
      
      console.log(`🔍 Access Control - User: ${userEmail}, ID: ${user.id}, isAdmin: ${isAdmin}`);
      
      // Get the public.users table ID for the current auth user
      const { data: currentPublicUser, error: publicUserError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
        
      let accessibleUserIds;
      if (publicUserError || !currentPublicUser) {
        console.warn('Could not find public user record, using auth ID as fallback');
        // Fallback to using auth user ID
        accessibleUserIds = [userId];
      } else {
        // Use the public.users table ID
        accessibleUserIds = [currentPublicUser.id];
      }
      
      // If user is admin, they can access all data
      if (isAdmin) {
        console.log('🔑 Admin user detected - granting access to all data');
        
        // Get all user IDs from the users table
        const { data: allUsers, error: usersError } = await supabase
          .from('users')
          .select('id');
        
        if (!usersError && allUsers) {
          const allUserIds = allUsers.map(u => u.id);
          accessibleUserIds.push(...allUserIds);
        } else {
          // Fallback: get user IDs from leads and opportunities if users table fails
          const { data: leadUsers } = await supabase.from('leads').select('user_id');
          const { data: oppUsers } = await supabase.from('opportunities').select('user_id');
          
          const allUserIds = [
            ...new Set([
              ...(leadUsers?.map(l => l.user_id) || []),
              ...(oppUsers?.map(o => o.user_id) || [])
            ])
          ].filter(Boolean);
          
          accessibleUserIds.push(...allUserIds);
        }
        
        return [...new Set(accessibleUserIds)];
      }
      
      // For non-admin users, check access_control table
      try {
        const { data: accessGrants, error: accessError } = await supabase
          .from('access_control')
          .select('user_id')
          .eq('granted_to_user_id', userId);
        
        if (!accessError && accessGrants) {
          const grantedUserIds = accessGrants.map(grant => grant.user_id);
          accessibleUserIds.push(...grantedUserIds);
          console.log(`✅ Found ${grantedUserIds.length} access grants for user`);
        }
      } catch (accessError) {
        console.warn('Could not check access control grants:', accessError);
      }
      
      // Remove duplicates and return
      const uniqueIds = [...new Set(accessibleUserIds)];
      console.log(`📊 Final accessible user IDs: ${uniqueIds.length} users`);
      return uniqueIds;
      
    } catch (error) {
      console.error('Error getting accessible user IDs:', error);
      // In case of error, return at least the user's own ID
      // Also check if this is a permission error that needs attention
      if (error instanceof Error && error.message.includes('permission denied')) {
        console.warn('⚠️ Permission denied when checking access control. User may need admin setup.');
      }
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
