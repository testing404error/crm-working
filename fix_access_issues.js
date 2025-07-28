// Quick fix script to resolve access issues
// Run this in your browser console on the CRM app page

console.log("🔧 Starting CRM Access Fix...");

// Step 1: Clear impersonation state
console.log("1. Clearing impersonation state...");
localStorage.removeItem('admin_session');
localStorage.removeItem('impersonated_user');
console.log("✅ Impersonation state cleared");

// Step 2: Clear any cached auth data
console.log("2. Clearing cached auth data...");
localStorage.removeItem('supabase.auth.token');
sessionStorage.clear();
console.log("✅ Auth cache cleared");

// Step 3: Force reload the page to reset authentication
console.log("3. Reloading page to reset authentication...");
setTimeout(() => {
    window.location.reload();
}, 1000);

console.log("🎉 Fix completed! Page will reload in 1 second...");
console.log("📝 After reload, log in normally (don't use impersonation)");
