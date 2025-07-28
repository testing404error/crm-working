import { supabase } from '../lib/supabaseClient';

export interface UserPermission {
  id: string;
  user_id: string;
  can_view_other_users_data: boolean;
  granted_by: string;
  created_at: string;
  updated_at: string;
}

export interface UserWithPermissions {
  user_id: string;
  email: string;
  name?: string;
  can_view_other_users_data: boolean;
  permission_granted_by?: string;
  permission_updated_at?: string;
}

export const userPermissionsService = {
  /**
   * Get all users who have accepted access requests with their permission settings
   * @param adminUserId - The admin user ID
   * @returns Array of users with their permission settings
   */
  async getUsersWithPermissions(adminUserId: string): Promise<UserWithPermissions[]> {
    try {
      // First get all users who have accepted access requests from this admin
      const { data: acceptedUsers, error: acceptedError } = await supabase
        .from('pending_access_requests')
        .select('receiver_id, created_at')
        .eq('requester_id', adminUserId)
        .eq('status', 'accepted');

      if (acceptedError) {
        console.error('Error fetching accepted users:', acceptedError);
        throw new Error(`Failed to fetch accepted users: ${acceptedError.message}`);
      }

      if (!acceptedUsers || acceptedUsers.length === 0) {
        return [];
      }

      const userIds = acceptedUsers.map(u => u.receiver_id);

      // Get user details using Supabase admin client (via API)
      const usersWithPermissions: UserWithPermissions[] = [];

      for (const userId of userIds) {
        // Get user permissions
        const { data: permission, error: permissionError } = await supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', userId)
          .single();

        // For demo purposes, we'll use placeholder user data
        // In a real app, you'd get this from your users table or auth provider
        usersWithPermissions.push({
          user_id: userId,
          email: `user-${userId.slice(0, 8)}@example.com`, // Placeholder
          name: `User ${userId.slice(0, 8)}`, // Placeholder
          can_view_other_users_data: permission?.can_view_other_users_data || false,
          permission_granted_by: permission?.granted_by,
          permission_updated_at: permission?.updated_at
        });
      }

      return usersWithPermissions;
    } catch (error) {
      console.error('Error getting users with permissions:', error);
      throw error;
    }
  },

  /**
   * Update a user's "Can View Other Users' Data" permission
   * @param targetUserId - The user whose permission to update
   * @param canViewOtherUsersData - Whether they can view other users' data
   * @param adminUserId - The admin making the change
   * @returns Success boolean
   */
  async updateUserViewPermission(
    targetUserId: string, 
    canViewOtherUsersData: boolean = false, 
    adminUserId: string
  ): Promise<boolean> {
    try {
      // Use the stored function to update the permission
      const { data, error } = await supabase.rpc('set_user_data_view_permission', {
        target_user_id: targetUserId,
        can_view: canViewOtherUsersData,
        admin_user_id: adminUserId
      });

      if (error) {
        console.error('Error updating user permission:', error);
        throw new Error(`Failed to update permission: ${error.message}`);
      }

      return data === true;
    } catch (error) {
      console.error('Error updating user view permission:', error);
      throw error;
    }
  },

  /**
   * Check if a user has permission to view other users' data
   * @param userId - The user ID to check
   * @returns Boolean indicating if they have permission
   */
  async checkUserViewPermission(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('user_can_view_other_users_data', {
        check_user_id: userId
      });

      if (error) {
        console.error('Error checking user permission:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error checking user view permission:', error);
      return false;
    }
  },

  /**
   * Get a user's current permission settings
   * @param userId - The user ID
   * @returns UserPermission object or null
   */
  async getUserPermissions(userId: string): Promise<UserPermission | null> {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No permissions record found - this is normal
          return null;
        }
        console.error('Error fetching user permissions:', error);
        throw new Error(`Failed to fetch permissions: ${error.message}`);
      }

      return data as UserPermission;
    } catch (error) {
      console.error('Error getting user permissions:', error);
      throw error;
    }
  }
};
