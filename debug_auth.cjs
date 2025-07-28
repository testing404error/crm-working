#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY; // Use anon key, not service key

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugAuth() {
    console.log('🔍 Debugging authentication state...\n');
    
    try {
        // Test 1: Check current session
        console.log('1️⃣ Checking current session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            console.log('❌ Session error:', sessionError.message);
        } else if (session) {
            console.log('✅ Session exists:');
            console.log('   - User ID:', session.user.id);
            console.log('   - Email:', session.user.email);
            console.log('   - Role:', session.user.user_metadata?.role);
            console.log('   - Expires at:', new Date(session.expires_at * 1000));
        } else {
            console.log('❌ No active session found');
        }
        
        // Test 2: Try to get user directly
        console.log('\n2️⃣ Testing getUser()...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.log('❌ User error:', userError.message);
            console.log('   Error code:', userError.status);
        } else if (user) {
            console.log('✅ User retrieved:');
            console.log('   - ID:', user.id);
            console.log('   - Email:', user.email);
            console.log('   - Role:', user.user_metadata?.role);
        } else {
            console.log('❌ No user found');
        }
        
        // Test 3: Try to sign in with demo credentials
        console.log('\n3️⃣ Testing sign in with demo credentials...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: 'demo@firstmoversai.com',
            password: 'Demo123!'
        });
        
        if (signInError) {
            console.log('❌ Sign in error:', signInError.message);
        } else {
            console.log('✅ Sign in successful:');
            console.log('   - User ID:', signInData.user.id);
            console.log('   - Email:', signInData.user.email);
            console.log('   - Role:', signInData.user.user_metadata?.role);
            
            // Test 4: Now try getUser again after signing in
            console.log('\n4️⃣ Testing getUser() after sign in...');
            const { data: { user: userAfterSignIn }, error: userAfterSignInError } = await supabase.auth.getUser();
            
            if (userAfterSignInError) {
                console.log('❌ User error after sign in:', userAfterSignInError.message);
            } else {
                console.log('✅ User retrieved after sign in:');
                console.log('   - ID:', userAfterSignIn.id);
                console.log('   - Email:', userAfterSignIn.email);
            }
        }
        
        console.log('\n🎯 Debug Summary:');
        if (signInError) {
            console.log('❌ Authentication is failing - check credentials or setup');
        } else {
            console.log('✅ Authentication works when properly signed in');
            console.log('💡 The issue is likely that the user isn\'t signed in when the app loads');
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

// Run debug
debugAuth();
