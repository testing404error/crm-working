import { supabase } from '../lib/supabaseClient';

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  created_at: string;
}

export const roleService = {
  // Get current user's role
  async getCurrentUserRole(): Promise<'admin' | 'user' | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return 'user'; // Default to user if no role found
      }

      return data?.role || 'user';
    } catch (error) {
      console.error('Error in getCurrentUserRole:', error);
      return 'user';
    }
  },

  // Check if current user is admin
  async isAdmin(): Promise<boolean> {
    const role = await this.getCurrentUserRole();
    return role === 'admin';
  },

  // Check if current user is regular user
  async isUser(): Promise<boolean> {
    const role = await this.getCurrentUserRole();
    return role === 'user';
  },

  // Update user role (admin only)
  async updateUserRole(userEmail: string, newRole: 'admin' | 'user'): Promise<void> {
    try {
      const isCurrentUserAdmin = await this.isAdmin();
      if (!isCurrentUserAdmin) {
        throw new Error('Only admins can update user roles');
      }

      const { error } = await supabase.rpc('update_user_role', {
        user_email: userEmail,
        new_role: newRole
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },

  // Get all users with their roles (admin only)
  async getAllUsersWithRoles(): Promise<Array<{email: string, role: string, created_at: string}>> {
    try {
      const isCurrentUserAdmin = await this.isAdmin();
      if (!isCurrentUserAdmin) {
        throw new Error('Only admins can view all user roles');
      }

      const { data, error } = await supabase
        .from('auth.users')
        .select(`
          email,
          created_at,
          user_roles(role)
        `);

      if (error) throw error;

      return data?.map(user => ({
        email: user.email,
        role: user.user_roles?.[0]?.role || 'user',
        created_at: user.created_at
      })) || [];
    } catch (error) {
      console.error('Error fetching users with roles:', error);
      throw error;
    }
  }
};

// Hook for React components
export const useUserRole = () => {
  const [role, setRole] = React.useState<'admin' | 'user' | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchRole = async () => {
      try {
        const userRole = await roleService.getCurrentUserRole();
        setRole(userRole);
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole('user');
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, []);

  return { role, loading, isAdmin: role === 'admin', isUser: role === 'user' };
};
