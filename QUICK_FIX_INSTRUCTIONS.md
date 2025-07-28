# 🚀 QUICK FIX: Apply User Permissions Now

The reason everything is still working the same is because the database migration hasn't been applied yet. Here's how to fix it **immediately**:

## ⚡ Step 1: Apply Database Migration (REQUIRED)

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: `qgoqrozkqckgvdopbllg`
3. **Navigate to**: SQL Editor (in the left sidebar)
4. **Create a new query** and copy-paste this SQL:

```sql
-- ============================================
-- USER PERMISSIONS MIGRATION
-- This will create the new permissions system
-- ============================================

-- Create user permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    can_view_other_users_data BOOLEAN DEFAULT false,
    granted_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted_by ON user_permissions(granted_by);

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "users_can_view_own_permissions" ON user_permissions;
CREATE POLICY "users_can_view_own_permissions" ON user_permissions
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_can_view_all_permissions" ON user_permissions;
CREATE POLICY "admins_can_view_all_permissions" ON user_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

DROP POLICY IF EXISTS "admins_can_manage_permissions" ON user_permissions;
CREATE POLICY "admins_can_manage_permissions" ON user_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create helper functions
CREATE OR REPLACE FUNCTION user_can_view_other_users_data(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = check_user_id 
        AND raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RETURN true;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = check_user_id 
        AND can_view_other_users_data = true
    );
END;
$$;

CREATE OR REPLACE FUNCTION set_user_data_view_permission(
    target_user_id UUID,
    can_view BOOLEAN,
    admin_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = admin_user_id 
        AND raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RETURN false;
    END IF;
    
    INSERT INTO user_permissions (user_id, can_view_other_users_data, granted_by)
    VALUES (target_user_id, can_view, admin_user_id)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        can_view_other_users_data = EXCLUDED.can_view_other_users_data,
        granted_by = EXCLUDED.granted_by,
        updated_at = NOW();
    
    RETURN true;
END;
$$;

-- Confirmation
SELECT 'User permissions system installed successfully!' as status;
```

5. **Click "Run"** to execute the SQL
6. **You should see**: "User permissions system installed successfully!"

## ⚡ Step 2: Test the New Feature

1. **Refresh your CRM application**
2. **Go to**: Settings > User Management
3. **You should now see**: A new column "Can View Other Users' Data" with toggles
4. **Test**: Toggle the switch for any user to enable/disable their access

## ✅ What Will Happen After This:

### Before Migration:
- ❌ Assignees see ALL data (same as before)
- ❌ No permission control toggle visible

### After Migration:
- ✅ **Assignees see ONLY admin's data** (as required)
- ✅ **New toggle appears** in User Management
- ✅ **Admin can control** who sees all data vs. own data only
- ✅ **Changes take effect immediately**

## 🎯 Expected Results:

1. **For Assignees**: They will now ONLY see admin's leads and opportunities (not everyone's)
2. **For Regular Users**: They see only their own data by default
3. **With Toggle Enabled**: Users get admin-like access to see ALL data
4. **For Admins**: No change, they still see everything

## 🐛 If Something Goes Wrong:

If you get any errors, please share them and I'll help you fix it immediately. The most common issues are:
- **Permission errors**: Make sure you're logged in as a database admin
- **Table conflicts**: If tables already exist, the migration will skip them safely

## 📱 How to Use (After Migration):

1. Go to **Settings > User Management**
2. Find any user in the **Active Access** tab
3. Toggle **"Can View Other Users' Data"** ON/OFF
4. User immediately gains/loses access to all data

---

**This migration is safe and reversible. It won't affect your existing data.**
