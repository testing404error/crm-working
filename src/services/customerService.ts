import { Customer } from '../types/index';
import { supabase } from '../lib/supabaseClient';
import { accessControlService } from './accessControlService';
import { permissionsService } from './permissionsService';

export const customerService = {
  // Fetch paginated customers for the authenticated user with enhanced access control
  async getCustomers(userId: string, page: number, limit: number = 10): Promise<{ data: Customer[]; total: number }> {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // Check if user is admin - admins see all customers
    if (permissionsService.isAdmin(userId)) {
      const { data, error, count } = await supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end);

      if (error) throw new Error(error.message);
      return { data: data as Customer[], total: count || 0 };
    }

    // For non-admin users, get accessible user IDs (own + granted access + assigned)
    const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);

    const { data, error, count } = await supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .in('user_id', accessibleUserIds)
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) throw new Error(error.message);
    return { data: data as Customer[], total: count || 0 };
  },

  // Create a new customer
  async createCustomer(customerData: Partial<Customer>, userId: string): Promise<Customer> {
    const newCustomer = {
      ...customerData,
      user_id: userId,
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(), // Initialize last_activity
      tags: customerData.tags || [],
      // Ensure default values for other potentially nullable fields if necessary
      phone: customerData.phone || null,
      company: customerData.company || null,
      notes: customerData.notes || null,
      total_value: customerData.total_value || 0,
      currency: customerData.currency || 'USD',
      language: customerData.language || 'English',
      addresses: customerData.addresses || [],
    };

    const { data, error } = await supabase
      .from('customers')
      .insert([newCustomer])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Create a corresponding lead for the customer
    const leadData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      user_id: userId,
    };
    await supabase.from('leads').insert([leadData]);

    return data as Customer;
  },

  // Update an existing customer
  async updateCustomer(customerId: string, customerData: Partial<Customer>, userId: string): Promise<Customer> {
    // Check if user is admin - admins can update any customer
    if (permissionsService.isAdmin(userId)) {
      const updatedCustomer = {
        ...customerData,
        last_activity: new Date().toISOString(), // Update last_activity on any change
      };

      const { data, error } = await supabase
        .from('customers')
        .update(updatedCustomer)
        .eq('id', customerId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Customer;
    }

    // For non-admin users, get accessible user IDs (own + granted access + assigned)
    const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);

    const updatedCustomer = {
      ...customerData,
      last_activity: new Date().toISOString(), // Update last_activity on any change
    };

    const { data, error } = await supabase
      .from('customers')
      .update(updatedCustomer)
      .eq('id', customerId)
      .in('user_id', accessibleUserIds)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Customer;
  },

  // Delete a customer
  async deleteCustomer(customerId: string, userId: string): Promise<void> {
    // Check if user is admin - admins can delete any customer
    if (permissionsService.isAdmin(userId)) {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) throw new Error(error.message);
      return;
    }

    // For non-admin users, get accessible user IDs (own + granted access + assigned)
    const accessibleUserIds = await accessControlService.getAccessibleUserIds(userId);

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId)
      .in('user_id', accessibleUserIds);

    if (error) throw new Error(error.message);
  },

  // Subscribe to real-time customer updates
  subscribeToCustomers(userId: string, callback: (payload: { [key: string]: any }) => void) {
    return supabase
      .channel('customer-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  },

  // Fetch communications for a customer
  async getCommunications(customerId: string, userId: string): Promise<CommunicationRecord[]> {
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('email')
      .eq('id', customerId)
      .single();

    if (customerError) throw new Error(customerError.message);
    if (!customerData) return [];

    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('email', customerData.email);

    if (leadError) throw new Error(leadError.message);
    if (!leadData || leadData.length === 0) return [];

    const leadIds = leadData.map(lead => lead.id);

    const { data, error } = await supabase
      .from('communications')
      .select('*')
      .in('lead_id', leadIds)
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) throw new Error(error.message);
    return data as CommunicationRecord[];
  },

  // Create a new communication for a customer
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

  // Subscribe to real-time communication updates
  subscribeToCommunications(userId: string, callback: (payload: { [key: string]: any }) => void) {
    return supabase
      .channel('customer-communications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communications',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }
};
