import { supabase } from '../lib/supabaseClient';

// A generic interface for our API responses to ensure type safety.
interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// Service object for managing all access request operations.
export const accessRequestService = {

  /**
   * Fetches all users from the database who can receive an access request.
   */
  getAvailableUsers: async (): Promise<ApiResponse<any[]>> => {
    try {
      const { data, error } = await supabase.functions.invoke('access-request-handler', {
        body: { action: 'GET_AVAILABLE_USERS' },
      });
      if (error) throw new Error(error.message);
      // The user list is nested inside a 'users' object in the response.
      return { data: data.users, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Sends a new access request to a specific user.
   * @param {string} receiver_id - The unique ID (UUID) of the user who will receive the request.
   */
  sendRequest: async (receiver_id: string): Promise<ApiResponse<any>> => {
    try {
      const { data, error } = await supabase.functions.invoke('access-request-handler', {
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

  /**
   * Fetches all pending access requests for the currently logged-in user.
   */
  getPendingRequests: async (): Promise<ApiResponse<any[]>> => {
    try {
      const { data, error } = await supabase.functions.invoke('access-request-handler', {
        body: { action: 'GET_PENDING_REQUESTS' },
      });
      if (error) throw new Error(error.message);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Updates the status of a specific access request (e.g., to 'accepted' or 'rejected').
   * @param {string} request_id - The unique ID (UUID) of the access request.
   * @param {'accepted' | 'rejected'} new_status - The new status to set.
   */
  updateRequestStatus: async (request_id: string, new_status: 'accepted' | 'rejected'): Promise<ApiResponse<any>> => {
    try {
      const { data, error } = await supabase.functions.invoke('access-request-handler', {
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
};
