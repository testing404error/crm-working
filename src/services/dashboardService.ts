import { supabase } from '../lib/supabaseClient';
import {
  Activity,
  Opportunity,
  Lead,
  Customer
} from '../types'; // Assuming these core types exist

// Define interfaces for the specific data structures the dashboard components will need
export interface DashboardMetrics {
  totalLeads: number;
  totalOpportunities: number;
  activeOpportunities: number; // Added based on dashboard "Top Opportunities" section implying active ones
  totalRevenue: number; // All-time from closed-won opportunities
  avgDealSize: number;
  conversionRate: number; // Example: Leads to Closed-Won Opportunities
  // monthlyGrowth: number; // This would require comparing current vs previous month revenue
}

export interface LeadSourceDataPoint {
  source: string;
  count: number;
  // percentage?: number; // Percentage can be calculated on the frontend
}

export interface PipelineStageDataPoint {
  stage: Opportunity['stage'];
  count: number;
  value: number;
  // color?: string; // Color can be handled by the frontend component
}

export interface TopOpportunity extends Partial<Opportunity> {
  // Add any specific fields needed for the "Top Opportunities" display if different from base Opportunity
  // For now, assuming it uses fields from the Opportunity type
  name: string; // name is already in Opportunity
  value: number; // value is already in Opportunity
  probability?: number; // probability is in Opportunity
  stage: Opportunity['stage']; // stage is in Opportunity
}


export const dashboardService = {
  async getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
    try {
      // Use the simplified dashboard stats function with role-based access
      const { data: metricsData, error: metricsError } = await supabase
        .rpc('get_dashboard_stats')
        .single();

      if (metricsError) {
        console.warn('Dashboard metrics function failed, falling back to direct queries:', metricsError);
        
        // Fallback to direct queries
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('id');
        
        const { data: opportunities, error: oppsError } = await supabase
          .from('opportunities')
          .select('stage, value');

        if (leadsError) throw leadsError;
        if (oppsError) throw oppsError;

        const totalLeads = leads?.length || 0;
        const totalOpportunities = opportunities?.length || 0;
        const activeOpportunities = opportunities?.filter(opp => opp.stage !== 'closed_won' && opp.stage !== 'closed_lost').length || 0;
        const closedWonOpportunities = opportunities?.filter(opp => opp.stage === 'closed_won') || [];
        const totalRevenue = closedWonOpportunities.reduce((sum, opp) => sum + (opp.value || 0), 0);
        const avgDealSize = closedWonOpportunities.length > 0 ? totalRevenue / closedWonOpportunities.length : 0;
        const conversionRate = totalLeads > 0 ? (closedWonOpportunities.length / totalLeads) * 100 : 0;

        return {
          totalLeads,
          totalOpportunities,
          activeOpportunities,
          totalRevenue,
          avgDealSize,
          conversionRate: parseFloat(conversionRate.toFixed(1)),
        };
      }

      // Calculate additional metrics from the function data
      const totalRevenue = 0; // We don't have revenue in the simple function, set to 0
      const avgDealSize = Number(metricsData.total_opportunities) > 0 && totalRevenue > 0
        ? totalRevenue / Number(metricsData.total_opportunities)
        : 0;

      const conversionRate = Number(metricsData.total_leads) > 0
        ? (Number(metricsData.total_opportunities) / Number(metricsData.total_leads)) * 100
        : 0;

      return {
        totalLeads: Number(metricsData.total_leads) || 0,
        totalOpportunities: Number(metricsData.total_opportunities) || 0,
        activeOpportunities: Number(metricsData.total_activities) || 0, // Use activities count as proxy
        totalRevenue: totalRevenue,
        avgDealSize,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
      };
    } catch (error: any) {
      console.error('Error fetching dashboard metrics:', error);
      throw new Error(`Failed to fetch dashboard metrics: ${error.message}`);
    }
  },

  async getLeadSourceData(userId: string): Promise<LeadSourceDataPoint[]> {
    try {
      // Use the ultimate function with role-based access
      const { data, error } = await supabase.rpc('get_lead_source_data_ultimate');

      if (error) {
        console.warn('Lead source function failed, falling back to direct query:', error);
        
        // Fallback to direct query
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('source')
          .not('source', 'is', null);

        if (leadsError) throw leadsError;
        if (!leads) return [];

        const sourceCounts: { [key: string]: number } = {};
        leads.forEach(lead => {
          if (lead.source) {
            sourceCounts[lead.source] = (sourceCounts[lead.source] || 0) + 1;
          }
        });

        return Object.entries(sourceCounts).map(([source, count]) => ({ source, count }));
      }

      return (data || []).map(item => ({
        source: item.source,
        count: Number(item.count)
      }));
    } catch (error: any) {
      console.error('Error fetching lead source data:', error);
      throw new Error(`Failed to fetch lead source data: ${error.message}`);
    }
  },

  async getPipelineData(userId: string): Promise<PipelineStageDataPoint[]> {
    try {
      // Use the ultimate function with role-based access
      const { data, error } = await supabase.rpc('get_pipeline_data_ultimate');

      if (error) {
        console.warn('Pipeline function failed, falling back to direct query:', error);
        
        // Fallback to direct query
        const { data: opportunities, error: oppsError } = await supabase
          .from('opportunities')
          .select('stage, value');

        if (oppsError) throw oppsError;
        if (!opportunities) return [];

        const pipeline: { [key: string]: { count: number; value: number } } = {};
        opportunities.forEach(opp => {
          if (opp.stage) {
            if (!pipeline[opp.stage]) {
              pipeline[opp.stage] = { count: 0, value: 0 };
            }
            pipeline[opp.stage].count += 1;
            pipeline[opp.stage].value += (opp.value || 0);
          }
        });

        return Object.entries(pipeline).map(([stage, { count, value }]) => ({
          stage: stage as Opportunity['stage'],
          count,
          value
        }));
      }

      return (data || []).map(item => ({
        stage: item.stage as Opportunity['stage'],
        count: Number(item.count),
        value: Number(item.total_amount)
      }));
    } catch (error: any) {
      console.error('Error fetching pipeline data:', error);
      throw new Error(`Failed to fetch pipeline data: ${error.message}`);
    }
  },

  async getActivityFeedData(userId: string, limit: number = 5): Promise<Activity[]> {
    try {
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select(`
          id,
          created_at,
          type,
          title,
          description,
          related_to_type,
          related_to_id,
          related_to_name,
          assigned_to,
          due_date,
          completed_at,
          status
        `)
        // RLS policies will automatically filter based on user permissions
        .order('created_at', { ascending: false })
        .limit(limit);

      if (activitiesError) throw activitiesError;
      if (!activities) return [];

      // Transform the activities to match the expected Activity interface
      const transformedActivities = activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        relatedTo: {
          type: activity.related_to_type,
          id: activity.related_to_id,
          name: activity.related_to_name
        },
        assignedTo: activity.assigned_to,
        status: activity.status,
        dueDate: activity.due_date,
        completedAt: activity.completed_at,
        createdAt: activity.created_at
      }));

      return transformedActivities as Activity[];
    } catch (error: any) {
      console.error('Error fetching activity feed data:', error);
      throw new Error(`Failed to fetch activity feed data: ${error.message}`);
    }
  },

  async getTopOpportunities(userId: string, limit: number = 3): Promise<TopOpportunity[]> {
    try {
      // Use the ultimate function with role-based access
      const { data, error } = await supabase
        .rpc('get_top_opportunities_simple');

      if (error) throw error;
      return (data || []) as TopOpportunity[];
    } catch (error: any) {
      console.error('Error fetching top opportunities:', error);
      throw new Error(`Failed to fetch top opportunities: ${error.message}`);
    }
  }
};
