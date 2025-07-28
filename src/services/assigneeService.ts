import { supabase } from '../lib/supabaseClient';
import { Assignee } from '../types';

export const getAssignees = async (): Promise<Assignee[]> => {
  const { data, error } = await supabase.from('users').select('id, name, email');
  if (error) throw new Error(error.message);
  return data || [];
};

export const addAssignee = async (assignee: Omit<Assignee, 'id'>): Promise<Assignee> => {
  const { data, error } = await supabase.from('users').insert([assignee]).select().single();
  if (error) throw new Error(error.message);
  return data;
};

export const updateAssignee = async (id: string, updates: Partial<Assignee>): Promise<Assignee> => {
  const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
};

export const deleteAssignee = async (id: string): Promise<void> => {
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

// Simplified assignee relationships - using access_control table instead
export const getAssigneeRelationships = async (userId?: string) => {
  try {
    let query = supabase.from('access_control')
      .select(`
        id,
        user_id,
        granted_to_user_id,
        granted_at,
        users!granted_to_user_id (id, name, email)
      `);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  } catch (error) {
    console.warn('Could not fetch assignee relationships:', error);
    return [];
  }
};

export const addAssigneeRelationship = async (userId: string, assigneeId: string) => {
  try {
    const { data, error } = await supabase
      .from('access_control')
      .insert([{ user_id: userId, granted_to_user_id: assigneeId }])
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  } catch (error) {
    console.warn('Could not add assignee relationship:', error);
    throw error;
  }
};

export const removeAssigneeRelationship = async (userId: string, assigneeId: string) => {
  try {
    const { error } = await supabase
      .from('access_control')
      .delete()
      .eq('user_id', userId)
      .eq('granted_to_user_id', assigneeId);
    
    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn('Could not remove assignee relationship:', error);
    throw error;
  }
};
