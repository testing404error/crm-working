import { supabase } from '../lib/supabaseClient'; // Make sure you have this client file

interface InvitationResponse {
  success: boolean;
  error?: string;
}

export const invitationService = {
  /**
   * Invokes the 'send-email' Supabase Edge Function to send a user invitation.
   * @param {string} email - The email address of the user to invite.
   * @param {string} role - The role to assign to the new user.
   * @returns {Promise<InvitationResponse>}
   */
  sendInvitation: async (email: string, role: string): Promise<InvitationResponse> => {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          role: role,
          isInvitation: true, // This flag tells our function to handle it as an invitation
        },
      });

      if (error) {
        throw new Error(error.message);
      }
      
      console.log('Supabase function response:', data);
      return { success: true };

    } catch (err: any) {
      console.error('Error sending invitation:', err);
      return { success: false, error: err.message };
    }
  },
};
