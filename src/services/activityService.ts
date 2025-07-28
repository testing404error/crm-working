import { supabase } from '../lib/supabaseClient';
import { Activity, ScheduledActivity } from '../types';
import { accessControlService } from './accessControlService';

// Mock database for the new "Scheduled Activities" feature
const mockScheduledActivities: ScheduledActivity[] = [
  {
    id: '1',
    type: 'Call',
    scheduled_at: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    notes: 'Follow up on the new proposal.',
    lead_id: '1',
    parentName: 'John Doe',
    parentType: 'Lead',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'Meeting',
    scheduled_at: new Date().toISOString(), // Today
    notes: 'Discuss project timeline.',
    opportunity_id: '1',
    parentName: 'Q1 Deal with Acme Corp',
    parentType: 'Opportunity',
    created_at: new Date().toISOString(),
  },
];

export const activityService = {
  // --- Functions for Scheduling (Mock) ---
  scheduleActivity(activity: Omit<ScheduledActivity, 'id' | 'created_at'>): Promise<ScheduledActivity> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newActivity: ScheduledActivity = {
          id: Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString(),
          ...activity,
        };
        mockScheduledActivities.push(newActivity);
        resolve(newActivity);
      }, 500);
    });
  },

  getAllScheduledActivities(userId: string): Promise<ScheduledActivity[]> {
      return new Promise((resolve) => {
          setTimeout(() => {
              resolve(mockScheduledActivities);
          }, 300);
      });
  },
  
  // --- Existing Functions for General Activities (Supabase) ---
  async getActivities(userId: string, page: number, limit: number, filters?: Record<string, any>): Promise<{ data: Activity[]; total: number }> {
    const start = (page - 1) * limit;
    
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';
    
    let query = supabase.from('activities').select('*', { count: 'exact' });
    
    // Apply access control based on user role
    if (!isAdmin) {
      // For non-admin users, get all user IDs they can access data for
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      query = query.in('assignedTo', accessibleUserIds);
    }
    // Admins get to see ALL activities regardless of who they're assigned to
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          if (['title'].includes(key)) {
            query = query.ilike(key, `%${value}%`);
          } else {
            query = query.eq(key, value);
          }
        }
      });
    }
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(start, start + limit - 1);
    if (error) throw new Error(error.message);
    return { data: data as Activity[], total: count || 0 };
  },

  async createActivity(activityData: Partial<Activity>, userId: string): Promise<Activity> {
    const { data, error } = await supabase.from('activities').insert([{ ...activityData, assignedTo: userId }]).select().single();
    if (error) throw new Error(error.message);
    return data as Activity;
  },

  async updateActivity(activityId: string, activityData: Partial<Activity>, userId: string): Promise<Activity> {
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';
    
    let query = supabase.from('activities').update(activityData).eq('id', activityId);
    
    // Apply access control based on user role
    if (!isAdmin) {
      // For non-admin users, only allow updating activities assigned to accessible users
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      query = query.in('assignedTo', accessibleUserIds);
    }
    // Admins can update any activity
    
    const { data, error } = await query.select().single();
    if (error) throw new Error(error.message);
    return data as Activity;
  },

  async deleteActivity(activityId: string, userId: string): Promise<void> {
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';
    
    let query = supabase.from('activities').delete().eq('id', activityId);
    
    // Apply access control based on user role
    if (!isAdmin) {
      // For non-admin users, only allow deleting activities assigned to accessible users
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      query = query.in('assignedTo', accessibleUserIds);
    }
    // Admins can delete any activity
    
    const { error } = await query;
    if (error) throw new Error(error.message);
  },

  async subscribeToActivities(userId: string, callback: (payload: any) => void) {
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';
    
    if (isAdmin) {
      // Admins subscribe to all activities changes
      return supabase
        .channel(`activities-changes-admin-${userId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'activities'
          // No filter - admins see all changes
        }, callback)
        .subscribe();
    } else {
      // For non-admin users, get accessible user IDs and create filters
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      
      return supabase
        .channel(`activities-changes-${userId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'activities',
          filter: `assignedTo=in.(${accessibleUserIds.join(',')})`
        }, callback)
        .subscribe();
    }
  }
};
