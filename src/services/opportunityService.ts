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
    const { data, error } = await supabase.from('opportunities').insert([{ ...oppData, user_id: userId }]).select().single();
    if (error) throw new Error(error.message);
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
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';

    if (isAdmin) {
      // Admin sees all opportunities - no filter needed
      return supabase.channel(`opportunities-changes-admin-${userId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'opportunities'
        }, callback)
        .subscribe();
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
          channels.forEach(channel => channel.unsubscribe());
        }
      };
    }
  }
};
