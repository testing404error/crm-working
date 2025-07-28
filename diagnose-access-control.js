import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Create admin client with service role key for full access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseAccessControl() {
  console.log('🔍 DIAGNOSTIC REPORT: CRM Access Control Analysis\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Get all users with their profiles and roles
    console.log('\n📋 1. USER PROFILES AND ROLES:');
    console.log('-'.repeat(40));
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at');
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return;
    }
    
    console.log('Found', profiles.length, 'user profiles:');
    profiles.forEach(profile => {
      console.log(`  • ${profile.email} (ID: ${profile.id})`);
      console.log(`    Role: ${profile.role || 'Not set'}`);
      console.log(`    Created: ${profile.created_at}`);
      console.log('');
    });
    
    // 2. Check assignee relationships
    console.log('\n🔗 2. ASSIGNEE RELATIONSHIPS:');
    console.log('-'.repeat(40));
    
    const { data: assigneeRelationships, error: assigneeError } = await supabase
      .from('assignee_relationships')
      .select(`
        *,
        assignee:assignee_id(email, role),
        admin:admin_id(email, role)
      `);
    
    if (assigneeError) {
      console.error('Error fetching assignee relationships:', assigneeError);
    } else {
      console.log('Found', assigneeRelationships.length, 'assignee relationships:');
      assigneeRelationships.forEach(rel => {
        console.log(`  • Assignee: ${rel.assignee?.email} (${rel.assignee_id})`);
        console.log(`    Admin: ${rel.admin?.email} (${rel.admin_id})`);
        console.log(`    Status: ${rel.status}`);
        console.log(`    Created: ${rel.created_at}`);
        console.log('');
      });
    }
    
    // 3. Check leads and their creators
    console.log('\n📊 3. LEADS AND OWNERSHIP:');
    console.log('-'.repeat(40));
    
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select(`
        id,
        name,
        email,
        created_by,
        created_at,
        creator:created_by(email, role)
      `)
      .order('created_at', { ascending: false });
    
    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
    } else {
      console.log('Found', leads.length, 'leads:');
      leads.forEach(lead => {
        console.log(`  • Lead: ${lead.name} (${lead.email})`);
        console.log(`    Created by: ${lead.creator?.email} (ID: ${lead.created_by})`);
        console.log(`    Creator role: ${lead.creator?.role}`);
        console.log(`    Created: ${lead.created_at}`);
        console.log('');
      });
    }
    
    // 4. Focus on specific users mentioned in the conversation
    console.log('\n🎯 4. SPECIFIC USER ANALYSIS:');
    console.log('-'.repeat(40));
    
    const targetEmails = [
      'yaravij907@kissgy.com',      // Assignee user
      'pandeyankit54562@gmail.com', // Admin user (visible to assignee)
      'ankurmishrq575@gmail.com'    // Another user (not visible to assignee)
    ];
    
    for (const email of targetEmails) {
      const profile = profiles.find(p => p.email === email);
      if (profile) {
        console.log(`📌 User: ${email}`);
        console.log(`   ID: ${profile.id}`);
        console.log(`   Role: ${profile.role}`);
        
        // Check if this user is an assignee
        const isAssignee = assigneeRelationships.find(rel => rel.assignee_id === profile.id);
        if (isAssignee) {
          console.log(`   ✅ Is assignee to admin: ${isAssignee.admin?.email}`);
        }
        
        // Check if this user is an admin with assignees
        const hasAssignees = assigneeRelationships.filter(rel => rel.admin_id === profile.id);
        if (hasAssignees.length > 0) {
          console.log(`   👥 Has ${hasAssignees.length} assignee(s):`);
          hasAssignees.forEach(rel => {
            console.log(`      - ${rel.assignee?.email}`);
          });
        }
        
        // Check leads created by this user
        const userLeads = leads.filter(lead => lead.created_by === profile.id);
        console.log(`   📋 Created ${userLeads.length} lead(s):`);
        userLeads.forEach(lead => {
          console.log(`      - ${lead.name} (${lead.email})`);
        });
        
        console.log('');
      } else {
        console.log(`❌ User not found: ${email}`);
      }
    }
    
    // 5. Check user permissions table (if it exists)
    console.log('\n🔐 5. USER PERMISSIONS (if table exists):');
    console.log('-'.repeat(40));
    
    const { data: permissions, error: permissionsError } = await supabase
      .from('user_permissions')
      .select(`
        *,
        user:user_id(email, role)
      `);
    
    if (permissionsError) {
      console.log('❌ User permissions table not found or accessible:', permissionsError.message);
    } else {
      console.log('Found', permissions.length, 'user permission records:');
      permissions.forEach(perm => {
        console.log(`  • User: ${perm.user?.email} (${perm.user_id})`);
        console.log(`    Can view other users' data: ${perm.can_view_other_users_data}`);
        console.log('');
      });
    }
    
    // 6. Test access control logic simulation
    console.log('\n🧪 6. ACCESS CONTROL LOGIC SIMULATION:');
    console.log('-'.repeat(40));
    
    const assigneeEmail = 'yaravij907@kissgy.com';
    const assigneeProfile = profiles.find(p => p.email === assigneeEmail);
    
    if (assigneeProfile) {
      const assigneeRel = assigneeRelationships.find(rel => rel.assignee_id === assigneeProfile.id);
      
      if (assigneeRel) {
        console.log(`🔍 Simulating access for assignee: ${assigneeEmail}`);
        console.log(`   Assigned to admin: ${assigneeRel.admin?.email} (${assigneeRel.admin_id})`);
        
        // Find leads this assignee should be able to see
        const accessibleLeads = leads.filter(lead => lead.created_by === assigneeRel.admin_id);
        console.log(`   Should see ${accessibleLeads.length} leads from their admin:`);
        
        accessibleLeads.forEach(lead => {
          console.log(`      ✅ ${lead.name} (${lead.email}) - Created by ${lead.creator?.email}`);
        });
        
        // Find leads this assignee should NOT see
        const inaccessibleLeads = leads.filter(lead => lead.created_by !== assigneeRel.admin_id);
        console.log(`   Should NOT see ${inaccessibleLeads.length} leads from other users:`);
        
        inaccessibleLeads.forEach(lead => {
          console.log(`      ❌ ${lead.name} (${lead.email}) - Created by ${lead.creator?.email}`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNOSTIC COMPLETE');
    
  } catch (error) {
    console.error('Error during diagnosis:', error);
  }
}

// Run the diagnosis
diagnoseAccessControl();
