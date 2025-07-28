import { supabase } from '@/lib/supabase';

export interface DashboardMetrics {
  totalLeads: number;
  totalOpportunities: number;
  activeOpportunities: number;
  totalRevenue: number;
}

export interface LeadSourceData {
  source: string;
  count: number;
}

export interface PipelineData {
  stage: string;
  count: number;
  value: number;
}

export interface TopOpportunity {
  id: string;
  name: string;
  value: number;
  stage: string;
  probability: number;
}

export interface ActivityFeedItem {
  id: string;
  type: string;
  description: string;
  created_at: string;
  user_id: string;
  related_id?: string;
  related_type?: string;
}

class DashboardService {
  /**
   * Get dashboard metrics using the secure function
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      // Use the ultimate function that handles role-based access
      const { data, error } = await supabase
        .rpc('get_dashboard_metrics_ultimate');

      if (error) {
        console.error('Error fetching dashboard metrics:', error);
        // Fallback to direct queries if function fails
        return this.getFallbackMetrics();
      }

      if (!data || data.length === 0) {
        return {
          totalLeads: 0,
          totalOpportunities: 0,
          activeOpportunities: 0,
          totalRevenue: 0
        };
      }

      const metrics = data[0];
      return {
        totalLeads: Number(metrics.total_leads) || 0,
        totalOpportunities: Number(metrics.total_opportunities) || 0,
        activeOpportunities: Number(metrics.active_opportunities) || 0,
        totalRevenue: Number(metrics.total_revenue) || 0
      };
    } catch (error) {
      console.error('Dashboard metrics error:', error);
      return this.getFallbackMetrics();
    }
  }

  /**
   * Get lead source data using the secure function
   */
  async getLeadSourceData(): Promise<LeadSourceData[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_lead_source_data_ultimate');

      if (error) {
        console.error('Error fetching lead source data:', error);
        // Fallback to direct query if function fails
        return this.getFallbackLeadSourceData();
      }

      return (data || []).map((item: any) => ({
        source: item.source || 'Unknown',
        count: Number(item.count) || 0
      }));
    } catch (error) {
      console.error('Lead source data error:', error);
      return [];
    }
  }

  /**
   * Get pipeline data using the secure function
   */
  async getPipelineData(): Promise<PipelineData[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_pipeline_data_ultimate');

      if (error) {
        console.error('Error fetching pipeline data:', error);
        // Fallback to direct query if function fails
        return this.getFallbackPipelineData();
      }

      return (data || []).map((item: any) => ({
        stage: item.stage || 'Unknown',
        count: Number(item.count) || 0,
        value: Number(item.value) || 0
      }));
    } catch (error) {
      console.error('Pipeline data error:', error);
      return [];
    }
  }

  /**
   * Get top opportunities using the secure function
   */
  async getTopOpportunities(limit: number = 3): Promise<TopOpportunity[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_top_opportunities_ultimate', { limit_count: limit });

      if (error) {
        console.error('Error fetching top opportunities:', error);
        // Fallback to direct query if function fails
        return this.getFallbackTopOpportunities(limit);
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        name: item.name || 'Unnamed Opportunity',
        value: Number(item.value) || 0,
        stage: item.stage || 'Unknown',
        probability: Number(item.probability) || 0
      }));
    } catch (error) {
      console.error('Top opportunities error:', error);
      return [];
    }
  }

  /**
   * Get activity feed with role-based filtering
   */
  async getActivityFeed(limit: number = 10): Promise<ActivityFeedItem[]> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Check if user is admin
      const { data: isAdmin } = await supabase.rpc('is_user_admin');
      
      let query = supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // If not admin, filter to user's own activities and assigned ones
      if (!isAdmin) {
        const { data: userEmail } = await supabase.rpc('get_user_email');
        query = query.or(`user_id.eq.${user.id},assigned_to.eq.${userEmail}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching activity feed:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        type: item.type || 'activity',
        description: item.description || 'No description',
        created_at: item.created_at,
        user_id: item.user_id,
        related_id: item.related_id,
        related_type: item.related_type
      }));
    } catch (error) {
      console.error('Activity feed error:', error);
      return [];
    }
  }

  /**
   * Check if current user is admin
   */
  async isCurrentUserAdmin(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_user_admin');
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
      return Boolean(data);
    } catch (error) {
      console.error('Admin check error:', error);
      return false;
    }
  }

  /**
   * Get current user's role information
   */
  async getCurrentUserRole(): Promise<{ role: string; email: string } | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role, email')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('User role error:', error);
      return null;
    }
  }

  // Fallback methods for when functions fail

  private async getFallbackMetrics(): Promise<DashboardMetrics> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          totalLeads: 0,
          totalOpportunities: 0,
          activeOpportunities: 0,
          totalRevenue: 0
        };
      }

      // Get user email for assigned_to comparisons
      const userEmail = user.email || '';

      // Get leads count
      const { count: leadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},assigned_to.eq.${userEmail}`);

      // Get opportunities count
      const { count: oppsCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},assigned_to.eq.${userEmail}`);

      // Get active opportunities count
      const { count: activeOppsCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},assigned_to.eq.${userEmail}`)
        .not('stage', 'in', '(closed_won,closed_lost)');

      // Get total revenue
      const { data: revenueData } = await supabase
        .from('opportunities')
        .select('value')
        .or(`user_id.eq.${user.id},assigned_to.eq.${userEmail}`)
        .eq('stage', 'closed_won');

      const totalRevenue = (revenueData || []).reduce((sum, opp) => sum + (Number(opp.value) || 0), 0);

      return {
        totalLeads: leadsCount || 0,
        totalOpportunities: oppsCount || 0,
        activeOpportunities: activeOppsCount || 0,
        totalRevenue
      };
    } catch (error) {
      console.error('Fallback metrics error:', error);
      return {
        totalLeads: 0,
        totalOpportunities: 0,
        activeOpportunities: 0,
        totalRevenue: 0
      };
    }
  }

  private async getFallbackLeadSourceData(): Promise<LeadSourceData[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const userEmail = user.email || '';

      const { data, error } = await supabase
        .from('leads')
        .select('source')
        .or(`user_id.eq.${user.id},assigned_to.eq.${userEmail}`)
        .not('source', 'is', null);

      if (error) {
        console.error('Fallback lead source error:', error);
        return [];
      }

      // Group by source
      const sourceMap = new Map<string, number>();
      (data || []).forEach(lead => {
        const source = lead.source || 'Unknown';
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
      });

      return Array.from(sourceMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('Fallback lead source error:', error);
      return [];
    }
  }

  private async getFallbackPipelineData(): Promise<PipelineData[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const userEmail = user.email || '';

      const { data, error } = await supabase
        .from('opportunities')
        .select('stage, value')
        .or(`user_id.eq.${user.id},assigned_to.eq.${userEmail}`)
        .not('stage', 'is', null);

      if (error) {
        console.error('Fallback pipeline error:', error);
        return [];
      }

      // Group by stage
      const stageMap = new Map<string, { count: number; value: number }>();
      (data || []).forEach(opp => {
        const stage = opp.stage || 'Unknown';
        const existing = stageMap.get(stage) || { count: 0, value: 0 };
        stageMap.set(stage, {
          count: existing.count + 1,
          value: existing.value + (Number(opp.value) || 0)
        });
      });

      return Array.from(stageMap.entries())
        .map(([stage, data]) => ({ stage, count: data.count, value: data.value }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('Fallback pipeline error:', error);
      return [];
    }
  }

  private async getFallbackTopOpportunities(limit: number): Promise<TopOpportunity[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const userEmail = user.email || '';

      const { data, error } = await supabase
        .from('opportunities')
        .select('id, name, value, stage, probability')
        .or(`user_id.eq.${user.id},assigned_to.eq.${userEmail}`)
        .not('stage', 'in', '(closed_won,closed_lost)')
        .order('value', { ascending: false, nullsLast: true })
        .limit(limit);

      if (error) {
        console.error('Fallback top opportunities error:', error);
        return [];
      }

      return (data || []).map(opp => ({
        id: opp.id,
        name: opp.name || 'Unnamed Opportunity',
        value: Number(opp.value) || 0,
        stage: opp.stage || 'Unknown',
        probability: Number(opp.probability) || 0
      }));
    } catch (error) {
      console.error('Fallback top opportunities error:', error);
      return [];
    }
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
