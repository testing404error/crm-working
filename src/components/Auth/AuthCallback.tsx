import React, { useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'react-toastify';

export const AuthCallback: React.FC = () => {
  useEffect(() => {
    const handleAuthCallback = async () => {
      // Prevent infinite reload loops
      const hasProcessedAuth = sessionStorage.getItem('auth_processed');
      if (hasProcessedAuth) {
        console.log('Auth already processed, skipping...');
        return;
      }

      console.log('AuthCallback component mounted.');
      console.log('Full URL:', window.location.href);
      console.log('Query string:', window.location.search);
      console.log('Hash fragment:', window.location.hash);
      
      // Check both query parameters and hash fragments
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      
      // Try to get tokens from either source
      let accessToken = urlParams.get('access_token') || hashParams.get('access_token');
      let refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token');
      let type = urlParams.get('type') || hashParams.get('type');

      console.log('URL Parameters:');
      console.log('- Access Token:', accessToken ? 'Present' : 'Missing');
      console.log('- Refresh Token:', refreshToken ? 'Present' : 'Missing');
      console.log('- Type:', type);

      // Check if this is a magic link callback
      if (type === 'magiclink' && accessToken && refreshToken) {
        try {
          console.log('Processing magic link authentication...');
          sessionStorage.setItem('auth_processed', 'true');

          // Set the session with the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Error setting session:', error);
            toast.error('Authentication failed: ' + error.message);
            sessionStorage.removeItem('auth_processed');
            return;
          }

          if (data.session && data.user) {
            console.log('Magic link authentication successful:', data.user.email);
            toast.success(`Successfully logged in as ${data.user.email}`);

            // Clear the URL parameters to clean up the address bar
            window.history.replaceState({}, document.title, window.location.pathname);

            // Force a page refresh to ensure all components update
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            console.error('No session or user data received');
            toast.error('Authentication failed: No session data');
            sessionStorage.removeItem('auth_processed');
          }
        } catch (error: any) {
          console.error('Authentication error:', error);
          toast.error('Authentication failed: ' + error.message);
          sessionStorage.removeItem('auth_processed');
        }
      } else if (type === 'magiclink') {
        console.log('Magic link detected but missing tokens');
      }
      // Removed the fallback session check to prevent infinite loops
    };

    handleAuthCallback();
  }, []);

  return null;
};
