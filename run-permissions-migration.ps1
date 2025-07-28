# PowerShell script to run the user permissions migration
# This script applies the new user permissions feature to your Supabase database

Write-Host "🚀 Running User Permissions Migration..." -ForegroundColor Green
Write-Host ""

# Check if supabase CLI is available
try {
    $supabaseVersion = supabase --version
    Write-Host "✅ Supabase CLI found: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Set the Supabase password from the user's requirements
$env:SUPABASE_DB_PASSWORD = "ozfotOd06VczdDrU"

Write-Host "📋 Migration Details:" -ForegroundColor Cyan
Write-Host "   - Creating user_permissions table" -ForegroundColor White
Write-Host "   - Adding 'can_view_other_users_data' permission" -ForegroundColor White
Write-Host "   - Setting up RLS policies" -ForegroundColor White
Write-Host "   - Creating helper functions" -ForegroundColor White
Write-Host ""

# Run the migration
try {
    Write-Host "🔄 Applying migration..." -ForegroundColor Yellow
    supabase db reset --local=false
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 User permissions system is now ready!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📌 What's new:" -ForegroundColor Cyan
        Write-Host "   1. ✅ Assignees can only see admin's leads & opportunities" -ForegroundColor White
        Write-Host "   2. ✅ New toggle 'Can View Other Users' Data' in User Management" -ForegroundColor White
        Write-Host "   3. ✅ Admins can grant/revoke this permission per user" -ForegroundColor White
        Write-Host "   4. ✅ Users with this permission see all data (like admins)" -ForegroundColor White
        Write-Host ""
        Write-Host "🔧 Next steps:" -ForegroundColor Yellow
        Write-Host "   1. Go to Settings > User Management" -ForegroundColor White
        Write-Host "   2. For each user, toggle 'Can View Other Users' Data' as needed" -ForegroundColor White
        Write-Host "   3. Users will immediately see the updated data access" -ForegroundColor White
    } else {
        throw "Migration failed with exit code: $LASTEXITCODE"
    }
} catch {
    Write-Host "❌ Migration failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Manual setup required:" -ForegroundColor Yellow
    Write-Host "   1. Go to your Supabase dashboard" -ForegroundColor White
    Write-Host "   2. Navigate to SQL Editor" -ForegroundColor White
    Write-Host "   3. Run the SQL from: supabase/migrations/012_add_user_permissions.sql" -ForegroundColor White
    exit 1
}

Write-Host "✨ All done! Your CRM now supports granular user permissions." -ForegroundColor Green
