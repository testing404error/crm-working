import { supabase } from '../lib/supabaseClient';

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// A single service to interact with our unified 'api' Edge Function.
export const apiService = {

  // --- Access Request Methods ---

  getAvailableUsers: async (): Promise<ApiResponse<any[]>> => {
    try {
      const { data, error } = await supabase.functions.invoke('api', {
        body: { action: 'GET_AVAILABLE_USERS' },
      });
      if (error) throw new Error(error.message);
      return { data: data.users, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  sendRequest: async (receiver_id: string): Promise<ApiResponse<any>> => {
    try {
      const { data, error } = await supabase.functions.invoke('api', {
        body: { 
          action: 'SEND_REQUEST',
          payload: { receiver_id }
        },
      });
      if (error) throw new Error(error.message);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  getPendingRequests: async (): Promise<ApiResponse<any[]>> => {
    try {
      const { data, error } = await supabase.functions.invoke('api', {
        body: { action: 'GET_PENDING_REQUESTS' },
      });
      if (error) throw new Error(error.message);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  updateRequestStatus: async (request_id: string, new_status: 'accepted' | 'rejected'): Promise<ApiResponse<any>> => {
    try {
      const { data, error } = await supabase.functions.invoke('api', {
        body: {
          action: 'UPDATE_REQUEST_STATUS',
          payload: { request_id, new_status }
        },
      });
      if (error) throw new Error(error.message);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },



getManagedUsers: async (): Promise<ApiResponse<any[]>> => {
    try {
      const { data, error } = await supabase.functions.invoke('api', {
        body: { action: 'GET_MANAGED_USERS' },
      });
      if (error) throw new Error(error.message);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  // --- NEW METHOD: Revokes access by deleting the request record. ---
  revokeAccess: async (request_id: string): Promise<ApiResponse<any>> => {
    try {
      const { data, error } = await supabase.functions.invoke('api', {
        body: {
          action: 'REVOKE_ACCESS',
          payload: { request_id }
        },
      });
      if (error) throw new Error(error.message);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },


  // --- NEW METHOD: Gets access request history for the current user ---
  getAccessHistory: async (): Promise<ApiResponse<any[]>> => {
    try {
      const { data, error } = await supabase.functions.invoke('api', {
        body: { action: 'GET_ACCESS_HISTORY' },
      });
      if (error) throw new Error(error.message);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  // --- NEW METHOD: Gets users with their permission settings ---
  getUsersWithPermissions: async (): Promise<ApiResponse<any[]>> => {
    try {
      const { data, error } = await supabase.functions.invoke('api', {
        body: { action: 'GET_USERS_WITH_PERMISSIONS' },
      });
      if (error) throw new Error(error.message);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  // --- NEW METHOD: Updates a user's "Can View Other Users' Data" permission ---
  updateUserPermission: async (
    targetUserId: string, 
    canViewOtherUsersData: boolean
  ): Promise<ApiResponse<any>> => {
    try {
      const { data, error } = await supabase.functions.invoke('api', {
        body: { 
          action: 'UPDATE_USER_PERMISSION',
          payload: {
            target_user_id: targetUserId,
            can_view_other_users_data: canViewOtherUsersData
          }
        },
      });
      if (error) throw new Error(error.message);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

};

