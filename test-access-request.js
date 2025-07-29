import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qgoqrozkqckgvdopbllg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
);

async function testAccessRequest() {
  console.log('=== Testing Access Request API ===\n');
  
  try {
    // Test the SEND_REQUEST action that's causing 500 error
    const response = await fetch('https://qgoqrozkqckgvdopbllg.supabase.co/functions/v1/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnb3Fyb3prcWNrZ3Zkb3BibGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE7NTE2MTIwODgsImV4cCI6MjA2NzE4ODA4OH0.D4wXbpbtnX1ZjWvLCfTzSRKvLu2yoO0Eo6jtUMmoZ18'
      },
      body: JSON.stringify({
        action: 'SEND_REQUEST',
        payload: {
          receiver_id: 'pandeyankit54562@gmail.com' // This should cause the 500 error if not fixed
        }
      })
    });
    
    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
    if (!response.ok) {
      console.error('❌ Request failed!');
      
      // Let's check if the error is about email conversion
      if (result.includes('Invalid input syntax for type uuid')) {
        console.log('🔍 This is the expected error - email being treated as UUID');
      }
    } else {
      console.log('✅ Request succeeded!');
    }
    
  } catch (error) {
    console.error('Network error:', error);
  }
}

testAccessRequest();
