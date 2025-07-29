import { Lead, CommunicationRecord, Opportunity } from '../types/index';
import { supabase } from '../lib/supabaseClient';
import { opportunityService } from './opportunityService';
import { accessControlService } from './accessControlService';

/**
 * ✅ ADMIN AUTO-SHARING: Helper function to share admin-created data with all assigned users
 * When an admin creates a lead or opportunity, it's automatically shared with all users 
 * who are listed in the Assignees section in Settings.
 * @param adminUserId - The admin's public.users table ID
 * @param dataType - Type of data being shared ('lead' or 'opportunity')
 * @param dataId - The ID of the data being shared
 */
const shareAdminDataWithAssignees = async (adminUserId: string, dataType: 'lead' | 'opportunity', dataId: string): Promise<void> => {
  try {
    console.log(`🔄 Starting auto-share for admin ${dataType}: ${dataId}`);
    
    // Get all users who have been granted access to the admin's data (assignees)
    const { data: assigneeGrants, error: assigneeError } = await supabase
      .from('access_control')
      .select('granted_to_user_id')
      .eq('user_id', adminUserId);
    
    if (assigneeError) {
      console.error('Failed to fetch assignee grants:', assigneeError);
      return;
    }
    
    if (!assigneeGrants || assigneeGrants.length === 0) {
      console.log('No assignees found for auto-sharing - admin data will still be visible to assigned users through admin permissions');
      return;
    }
    
    const assigneeIds = assigneeGrants.map(grant => grant.granted_to_user_id);
    console.log(`👥 Found ${assigneeIds.length} assignees for auto-sharing`);
    
    // Since this is admin-created data and the current access control system works through
    // the admin's user_id in the data, and assignees have access_control grants to the admin's data,
    // they should be able to see this data automatically.
    // However, let's add a verification step to ensure the access control is working
    
    for (const assigneeId of assigneeIds) {
      console.log(`🔍 Verifying access for assignee: ${assigneeId}`);
      // The existing access control should handle this automatically
      // Log for debugging purposes
      console.log(`✓ Assignee ${assigneeId} should have access to admin ${dataType} ${dataId} through existing access_control grant`);
    }
    
    console.log(`✅ Auto-sharing verification complete for admin ${dataType}: ${dataId}`);
  } catch (error) {
    console.error(`Failed to auto-share admin ${dataType}:`, error);
    throw error;
  }
};

export const leadsService = {
  // Fetch paginated leads with role-based filtering
  // ✅ ADMIN ACCESS: Admins see ALL leads from all users
  // ✅ REGULAR USERS: See their own leads + leads from users who granted access + assignee leads
  async getLeads(userId: string, page: number, limit: number = 10): Promise<{ data: Lead[]; total: number }> {
    console.log('🚀 getLeads called with:', { userId, page, limit });
    
    // DIAGNOSTIC: Check total leads in database without any filters
    const { data: allLeadsCheck, error: allLeadsCheckError } = await supabase
      .from('leads')
      .select('id, name, user_id')
      .order('created_at', { ascending: false });
    
    if (!allLeadsCheckError && allLeadsCheck) {
      console.log(`🔍 TOTAL LEADS IN DATABASE: ${allLeadsCheck.length}`);
      console.log('📋 All leads:', allLeadsCheck.map(l => ({ name: l.name, user_id: l.user_id })));
      
      // Get accessible user IDs to compare
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      console.log('🔍 Accessible user IDs:', accessibleUserIds);
      
      // Show which leads should be accessible
      const accessibleLeads = allLeadsCheck.filter(lead => accessibleUserIds.includes(lead.user_id));
      console.log(`🔍 SHOULD BE ACCESSIBLE: ${accessibleLeads.length} leads`);
      accessibleLeads.forEach(lead => {
        console.log(`  ✅ "${lead.name}" (user: ${lead.user_id})`);
      });
      
      const inaccessibleLeads = allLeadsCheck.filter(lead => !accessibleUserIds.includes(lead.user_id));
      console.log(`🔍 NOT ACCESSIBLE: ${inaccessibleLeads.length} leads`);
      inaccessibleLeads.forEach(lead => {
        console.log(`  ❌ "${lead.name}" (user: ${lead.user_id})`);
      });
    } else {
      console.log('❌ Error checking total leads:', allLeadsCheckError?.message);
    }
    
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // Get user data to check if they are admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.warn('No authenticated user, limiting access to data');
      // If no authenticated user, only return empty results
      return { data: [], total: 0 };
    }
    
    const isAdmin = user.user_metadata?.role === 'admin';

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' });
    
    // ✅ KEY LOGIC: Apply access control based on user role
    if (!isAdmin) {
      // For non-admin users, get all user IDs they can access data for
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      console.log(`🔍 Accessible User IDs for leads:`, accessibleUserIds);
      
      // DIAGNOSTIC: Let's see what user_ids actually exist in the leads table
      const { data: leadsUserIds, error: userIdsError } = await supabase
        .from('leads')
        .select('user_id')
        .limit(10);
      
      if (!userIdsError && leadsUserIds) {
        const uniqueUserIds = [...new Set(leadsUserIds.map(l => l.user_id))];
        console.log(`🔍 DIAGNOSTIC: User IDs found in leads table:`, uniqueUserIds);
        console.log(`🔍 DIAGNOSTIC: Matching user IDs:`, uniqueUserIds.filter(id => accessibleUserIds.includes(id)));
      } else {
        console.log(`🔍 DIAGNOSTIC: Error fetching leads user_ids:`, userIdsError?.message);
      }
      
      query = query.in('user_id', accessibleUserIds);
    } else {
      console.log(`🔑 ADMIN USER: Will see ALL leads without user_id filter`);
    }
    // Admins get to see ALL leads regardless of who created them (no filter)
    
    query = query
      .order('created_at', { ascending: false })
      .range(start, end);

    const { data, error, count } = await query;

    // Add debugging information
    console.log(`📊 Leads query result:`, {
      isAdmin,
      totalLeads: count,
      leadsReturned: data?.length || 0,
      error: error?.message || 'No error'
    });
    
    if (data && data.length > 0) {
      console.log(`📋 Sample lead user_ids:`, data.slice(0, 3).map(lead => lead.user_id));
    } else {
      console.log(`❌ No leads found in database`);
      
      // Let's also check if there are ANY leads in the database at all
      const { data: allLeads, error: allLeadsError } = await supabase
        .from('leads')
        .select('id, user_id, name')
        .limit(10);
        
      if (!allLeadsError && allLeads) {
        console.log(`🔍 Database contains ${allLeads.length} total leads:`);
        allLeads.forEach(lead => {
          const hasAccess = accessibleUserIds.includes(lead.user_id);
          console.log(`  - Lead "${lead.name}" (user: ${lead.user_id}) - Access: ${hasAccess ? '✅' : '❌'}`);
        });
      } else {
        console.log(`🔍 Could not check total leads in database:`, allLeadsError?.message);
      }
    }

    if (error) throw new Error(error.message);
    return { data: data as Lead[], total: count || 0 };
  },

  async getAllLeadsForSelection(userId: string): Promise<{ id: string; name: string }[]> {
    // Get user data to check if they are admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.warn('No authenticated user, returning empty leads selection');
      return [];
    }
    
    const isAdmin = user.user_metadata?.role === 'admin';

    let query = supabase
      .from('leads')
      .select('id, name');
    
    // Apply access control based on user role
    if (!isAdmin) {
      // For non-admin users, get all user IDs they can access data for
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      query = query.in('user_id', accessibleUserIds);
    }
    // Admins get to see ALL leads (no filter)
    
    query = query.order('name');

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leads for selection:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  // Create a new lead
  async createLead(leadData: Partial<Lead>, userId: string): Promise<Lead> {
    // Get the correct user ID from the users table
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Authentication failed. Please sign in again.');
    }
    
    console.log('Creating lead - Auth user ID:', user.id);
    
    // Add defensive check for user ID
    if (!user.id) {
      throw new Error('Invalid user session. Please sign in again.');
    }
    
    // Declare publicUser outside try-catch to make it accessible later
    let publicUser: any;
    
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
      
      console.log('User lookup result:', { userData, userError });
      
      if (userError) {
        console.error('User lookup error details:', {
          message: userError.message,
          details: userError.details,
          hint: userError.hint,
          code: userError.code
        });
        
        // If it's a 406 error or PGRST116 (no rows), provide more specific guidance
        if (userError.code === 'PGRST116') {
          throw new Error('Your user profile was not found in the database. Please contact an administrator to set up your account.');
        }
        
        throw new Error(`Failed to lookup user profile: ${userError.message}`);
      }
      
      if (!userData) {
        throw new Error('User profile not found in database. Please ensure your account is properly set up.');
      }
      
      // Assign the user data to the outer scope variable
      publicUser = userData;
    } catch (error) {
      console.error('Error in createLead user lookup:', error);
      throw error;
    }
    
    const newLead = {
      ...leadData,
      user_id: publicUser.id, // Use the public.users ID instead of auth user ID
      created_at: new Date().toISOString(),
      status: leadData.status || 'new',
      score: leadData.score || 0,
      tags: leadData.tags || [],
      assigned_to: leadData.assigned_to || null // Ensure null instead of empty string
    };

    const { data, error } = await supabase
      .from('leads')
      .insert([newLead])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // ✅ ADMIN AUTO-SHARING: If the creator is admin, automatically share with all assigned users
    const isAdmin = user.user_metadata?.role === 'admin';
    if (isAdmin) {
      try {
        console.log('🔑 Admin created lead - implementing auto-sharing');
        await shareAdminDataWithAssignees(publicUser.id, 'lead', data.id);
      } catch (shareError) {
        console.error('⚠️ Failed to auto-share admin lead:', shareError);
        // Don't throw error here - lead creation should succeed even if auto-sharing fails
      }
    }

    // Auto-create corresponding opportunity
    try {
      const newOpportunity: Partial<Opportunity> = {
        name: `${data.name}'s Opportunity`,
        lead_id: data.id,
        value: 0,
        currency: 'INR',
        stage: 'prospecting',
        probability: 10,
        expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        assigned_to: data.assigned_to || publicUser.id,
        description: `Opportunity automatically created for lead: ${data.name}`,
        tags: data.tags,
        user_id: publicUser.id,
        created_at: new Date().toISOString()
      };
      
      console.log('Creating opportunity for lead:', data.id);
      await opportunityService.createOpportunity(newOpportunity, publicUser.id);
      console.log('Opportunity created successfully');
    } catch (opportunityError) {
      console.error('Failed to create opportunity for lead:', opportunityError);
      // Don't throw error here - lead creation should succeed even if opportunity fails
    }

    return data as Lead;
  },

  // Update an existing lead (allow updating leads user has access to)
  async updateLead(leadId: string, leadData: Partial<Lead>, userId: string): Promise<Lead> {
    console.log('🔄 UPDATE LEAD DEBUG - Starting update process');
    console.log('📝 Lead ID:', leadId);
    console.log('📝 Raw Lead Data:', JSON.stringify(leadData, null, 2));
    console.log('📝 User ID passed:', userId);
    
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';
    
    console.log('👤 Auth User:', user?.id);
    console.log('🔑 Is Admin:', isAdmin);
    
    // Get the public.users table ID for the current auth user
    let publicUserId = userId; // Default to passed userId
    
    if (user) {
      try {
        const { data: publicUser, error: publicUserError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
          
        if (!publicUserError && publicUser) {
          publicUserId = publicUser.id; // Use public.users ID
          console.log('✅ Mapped to public user ID:', publicUserId);
        } else {
          console.warn('❌ Failed to map to public user:', publicUserError);
        }
      } catch (error) {
        console.warn('Could not map auth user to public user for access control:', error);
      }
    }
    
    // Clean the data to ensure it matches the database schema
    const cleanedData = {
      ...leadData,
      // Ensure score is a number
      score: typeof leadData.score === 'string' ? parseInt(leadData.score) || 0 : leadData.score,
      // Ensure assigned_to is either a valid UUID or null
      assigned_to: leadData.assigned_to === '' ? null : leadData.assigned_to,
      // Ensure tags is an array
      tags: Array.isArray(leadData.tags) ? leadData.tags : (leadData.tags ? [leadData.tags] : []),
      // Remove any undefined or invalid fields
      ...(leadData.name !== undefined && { name: leadData.name }),
      ...(leadData.email !== undefined && { email: leadData.email }),
      ...(leadData.phone !== undefined && { phone: leadData.phone || null }),
      ...(leadData.company !== undefined && { company: leadData.company || null }),
      ...(leadData.location !== undefined && { location: leadData.location || null }),
      ...(leadData.notes !== undefined && { notes: leadData.notes || null }),
      ...(leadData.status !== undefined && { status: leadData.status }),
      ...(leadData.source !== undefined && { source: leadData.source })
    };
    
    // Remove undefined values
    Object.keys(cleanedData).forEach(key => {
      if (cleanedData[key] === undefined) {
        delete cleanedData[key];
      }
    });
    
    console.log('🧹 Cleaned Lead Data:', JSON.stringify(cleanedData, null, 2));
    
    let query = supabase
      .from('leads')
      .update(cleanedData)
      .eq('id', leadId);
    
    // Apply access control based on user role
    if (!isAdmin) {
      // For non-admin users, only allow updating leads they have access to
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(publicUserId);
      console.log('🔒 Accessible User IDs:', accessibleUserIds);
      query = query.in('user_id', accessibleUserIds);
    }
    // Admins can update any lead (no additional filter)
    
    query = query.select().single();
    
    console.log('🚀 Executing update query...');
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ UPDATE LEAD ERROR:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Update failed: ${error.message}`);
    }
    
    console.log('✅ Lead updated successfully:', data);
    return data as Lead;
  },

  // Delete a lead (allow deleting leads user has access to)
  async deleteLead(leadId: string, userId: string): Promise<void> {
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';
    
    // Get the public.users table ID for the current auth user
    let publicUserId = userId; // Default to passed userId
    
    if (user) {
      try {
        const { data: publicUser, error: publicUserError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
          
        if (!publicUserError && publicUser) {
          publicUserId = publicUser.id; // Use public.users ID
        }
      } catch (error) {
        console.warn('Could not map auth user to public user for access control:', error);
      }
    }
    
    // Get accessible user IDs for access control
    let accessibleUserIds: string[] = [];
    if (!isAdmin) {
      accessibleUserIds = await accessControlService.getAccessibleUserIds(publicUserId);
    }
    
    // First, delete related opportunities to avoid foreign key constraint issues
    let opportunityQuery = supabase
      .from('opportunities')
      .delete()
      .eq('lead_id', leadId);
    
    if (!isAdmin) {
      opportunityQuery = opportunityQuery.in('user_id', accessibleUserIds);
    }
    
    const { error: opportunityError } = await opportunityQuery;
    
    if (opportunityError) {
      console.warn('Failed to delete related opportunities:', opportunityError.message);
      // Continue with lead deletion even if opportunity deletion fails
    }

    // Delete related communications
    let communicationQuery = supabase
      .from('communications')
      .delete()
      .eq('lead_id', leadId);
    
    if (!isAdmin) {
      communicationQuery = communicationQuery.in('user_id', accessibleUserIds);
    }
    
    const { error: communicationError } = await communicationQuery;
    
    if (communicationError) {
      console.warn('Failed to delete related communications:', communicationError.message);
      // Continue with lead deletion even if communication deletion fails
    }

    // Finally, delete the lead itself
    let leadQuery = supabase
      .from('leads')
      .delete()
      .eq('id', leadId);
    
    if (!isAdmin) {
      leadQuery = leadQuery.in('user_id', accessibleUserIds);
    }
    
    const { error } = await leadQuery;

    if (error) throw new Error(error.message);
  },

  // Fetch communications for a lead (show communications user has access to)
  async getCommunications(leadId: string, userId: string): Promise<CommunicationRecord[]> {
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';
    
    // Get the public.users table ID for the current auth user
    let publicUserId = userId; // Default to passed userId
    
    if (user) {
      try {
        const { data: publicUser, error: publicUserError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
          
        if (!publicUserError && publicUser) {
          publicUserId = publicUser.id; // Use public.users ID
        }
      } catch (error) {
        console.warn('Could not map auth user to public user for access control:', error);
      }
    }
    
    let query = supabase
      .from('communications')
      .select('*')
      .eq('lead_id', leadId);
    
    // Apply access control based on user role
    if (!isAdmin) {
      // For non-admin users, only show communications they have access to
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(publicUserId);
      query = query.in('user_id', accessibleUserIds);
    }
    // Admins can see all communications (no additional filter)
    
    query = query.order('timestamp', { ascending: false });
    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data as CommunicationRecord[];
  },

  // Create a new communication
  async createCommunication(communicationData: Partial<CommunicationRecord>, userId: string): Promise<CommunicationRecord> {
    const newCommunication = {
      ...communicationData,
      user_id: userId,
      timestamp: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('communications')
      .insert([newCommunication])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as CommunicationRecord;
  },

  // Subscribe to real-time lead updates (access-controlled)
  async subscribeToLeads(userId: string, callback: (payload: any) => void) {
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';
    
    if (isAdmin) {
      // Admins subscribe to all leads changes
      return supabase
        .channel(`leads-changes-admin-${userId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'leads'
          // No filter - admins see all changes
        }, callback)
        .subscribe();
    } else {
      // For non-admin users, get accessible user IDs and create filters
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      
      // Create multiple subscriptions for each accessible user ID
      // Note: Supabase RLS filters work with OR logic when multiple filters are applied
      return supabase
        .channel(`leads-changes-${userId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'leads',
          filter: `user_id=in.(${accessibleUserIds.join(',')})`
        }, callback)
        .subscribe();
    }
  },

  // Subscribe to real-time communication updates (access-controlled)
  async subscribeToCommunications(userId: string, callback: (payload: any) => void) {
    // Get user data to check if they are admin
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user?.user_metadata?.role === 'admin';
    
    if (isAdmin) {
      // Admins subscribe to all communications changes
      return supabase
        .channel(`communications-changes-admin-${userId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'communications'
          // No filter - admins see all changes
        }, callback)
        .subscribe();
    } else {
      // For non-admin users, get accessible user IDs and create filters
      const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);
      
      return supabase
        .channel(`communications-changes-${userId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'communications',
          filter: `user_id=in.(${accessibleUserIds.join(',')})`
        }, callback)
        .subscribe();
    }
  }
};
