import { supabase } from '../lib/supabaseClient';
import { Opportunity } from '../types';
import { accessControlService } from './accessControlService';

export interface OpportunityFilters {
  name?: string;
  stage?: string;
  assigned_to?: string;
  min_value?: number;
  max_value?: number;
}

export const opportunityService = {
  // Fetch opportunities with role-based filtering and access control
  // ✅ ADMIN ACCESS: Admins see ALL opportunities from all users
  // ✅ REGULAR USERS: See their own opportunities + opportunities from users who granted access and assigned them
  async getOpportunities(userId: string, page: number, limit: number, filters: OpportunityFilters, sortBy: string, sortAsc: boolean): Promise<{ data: Opportunity[]; total: number }> {
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';

    let query = supabase.from('opportunities').select('*', { count: 'exact' });
    
    // ✅ KEY LOGIC: Apply access control for non-admin users
    if (!isAdmin) {
      // Get accessible user IDs (own + users who granted access and assigned this user)
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      query = query.in('user_id', accessibleUserIds);
    }
    
    // Add your filter logic here based on the filters object
    if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`);
    }
    if (filters.stage) {
        query = query.eq('stage', filters.stage);
    }
    // Add other filters as needed...

    const { data, error, count } = await query.order(sortBy, { ascending: sortAsc }).range((page - 1) * limit, page * limit - 1);
    if (error) throw new Error(error.message);
    return { data: data as Opportunity[], total: count ?? 0 };
  },

  /**
   * Fetches all opportunities (only ID and name) for selection in a dropdown.
   * Uses access control to determine which opportunities the user can see.
   */
  async getAllOpportunitiesForSelection(userId: string): Promise<{ id: string; name: string }[]> {
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';

    let query = supabase
      .from('opportunities')
      .select('id, name');
    
    // Apply access control for non-admin users
    if (!isAdmin) {
      // Get accessible user IDs (own + users who granted access and assigned this user)
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      query = query.in('user_id', accessibleUserIds);
    }
    
    query = query.order('name');

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching opportunities for selection:', error);
      throw new Error(error.message);
    }
    return data || [];
  },
  
  async createOpportunity(oppData: Partial<Opportunity>, userId: string): Promise<Opportunity> {
    // Get the correct user ID from the users table
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Authentication failed. Please sign in again.');
    }
    
    let publicUserId = userId;
    
    // If userId is auth user ID, convert to public user ID
    if (userId === user.id) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
        
        if (userError) {
          console.error('User lookup error in createOpportunity:', userError);
          throw new Error('Failed to lookup user profile');
        }
        
        if (userData) {
          publicUserId = userData.id;
        }
      } catch (error) {
        console.error('Error in createOpportunity user lookup:', error);
        throw error;
      }
    }
    
    const opportunityToInsert = {
      ...oppData,
      user_id: publicUserId,
      created_at: oppData.created_at || new Date().toISOString()
    };
    
    // Remove last_activity if it exists since it's not in the schema
    delete opportunityToInsert.last_activity;
    
    console.log('Creating opportunity with data:', opportunityToInsert);
    
    const { data, error } = await supabase
      .from('opportunities')
      .insert([opportunityToInsert])
      .select()
      .single();
    
    if (error) {
      console.error('Opportunity creation error:', error);
      throw new Error(error.message);
    }
    
    return data as Opportunity;
  },

  async updateOpportunity(oppId: string, oppData: Partial<Opportunity>, userId: string): Promise<Opportunity> {
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';

    let query = supabase.from('opportunities').update(oppData).eq('id', oppId);

    // Apply access control for non-admin users
    if (!isAdmin) {
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      query = query.in('user_id', accessibleUserIds);
    }

    const { data, error } = await query.select().single();

    if (error) throw new Error(error.message);
    return data as Opportunity;
  },

  async deleteOpportunity(oppId: string, userId: string): Promise<void> {
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';

    let query = supabase.from('opportunities').delete().eq('id', oppId);

    // Apply access control for non-admin users
    if (!isAdmin) {
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      query = query.in('user_id', accessibleUserIds);
    }

    const { error } = await query;

    if (error) throw new Error(error.message);
  },

  async subscribeToOpportunities(userId: string, callback: (payload: any) => void) {
    try {
      // Get user data to check if they are admin
      const { data: { user } } = await supabase.auth.getUser();
      const isAdmin = user?.user_metadata?.role === 'admin';

      if (isAdmin) {
        // Admin sees all opportunities - no filter needed
        const channel = supabase.channel(`opportunities-changes-admin-${userId}`)
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'opportunities'
          }, callback)
          .subscribe();
        
        // Return consistent structure
        return {
          unsubscribe: () => {
            try {
              channel.unsubscribe();
            } catch (error) {
              console.error('Error unsubscribing from admin opportunities channel:', error);
            }
          }
        };
      } else {
        // For regular users, get accessible user IDs and subscribe to those
        const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
        
        // Create multiple subscriptions for each accessible user
        const channels = accessibleUserIds.map(accessibleUserId => 
          supabase.channel(`opportunities-changes-${userId}-${accessibleUserId}`)
            .on('postgres_changes', { 
              event: '*', 
              schema: 'public', 
              table: 'opportunities',
              filter: `user_id=eq.${accessibleUserId}`
            }, callback)
            .subscribe()
        );
        
        // Return a combined unsubscribe function
        return {
          unsubscribe: () => {
            try {
              channels.forEach(channel => {
                if (channel && typeof channel.unsubscribe === 'function') {
                  channel.unsubscribe();
                }
              });
            } catch (error) {
              console.error('Error unsubscribing from user opportunities channels:', error);
            }
          }
        };
      }
    } catch (error) {
      console.error('Error setting up opportunities subscription:', error);
      // Return a no-op unsubscribe function
      return {
        unsubscribe: () => {}
      };
    }
  }
};
