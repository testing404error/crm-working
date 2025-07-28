import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { apiService } from '../../services/apiService';
import { ShieldCheck, XCircle, Search, History, Clock, CheckCircle, AlertCircle, Filter, Database, Wrench, Copy, ExternalLink, Eye, EyeOff, Settings, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { supabase } from '../../lib/supabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuth } from '../../contexts/AuthContext';

export const UserManagement: React.FC = () => {
  const [managedUsers, setManagedUsers] = useState<any[]>([]);
  const [accessHistory, setAccessHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupInstructions, setSetupInstructions] = useState<any>(null);

  // Setup database table if needed
  const setupDatabase = async () => {
    setIsSettingUp(true);
    try {
      // Create the table using direct SQL through the API
      const { data, error } = await supabase.functions.invoke('api', {
        body: { action: 'SETUP_DATABASE' }
      });
      
      if (error) {
        toast.error('Failed to setup database: ' + error.message);
      } else if (data.requiresManualSetup) {
        setSetupInstructions(data.instructions);
      } else {
        toast.success('Database setup completed successfully!');
        setNeedsSetup(false);
        // Retry fetching data
        fetchManagedUsers();
      }
    } catch (error: any) {
      toast.error('Setup failed: ' + error.message);
    }
    setIsSettingUp(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('SQL copied to clipboard!');
  };

  const retryAfterManualSetup = () => {
    setSetupInstructions(null);
    setNeedsSetup(false);
    fetchManagedUsers();
  };

  // Fetches the list of users with their permission settings
  const fetchManagedUsers = async () => {
    setIsLoading(true);
    
    try {
      // First try the new permissions API
      const { data: permissionsData, error: permissionsError } = await apiService.getUsersWithPermissions();
      
      if (!permissionsError && permissionsData) {
        // New API worked - use the data with permissions
        setManagedUsers(permissionsData);
        setNeedsSetup(false);
        setIsLoading(false);
        return;
      }
      
      // If new API failed, fall back to old API
      console.log('New permissions API failed, falling back to old API:', permissionsError);
      const { data: oldData, error: oldError } = await apiService.getManagedUsers();
      
      if (oldError) {
        // Check if it's a setup issue
        if (oldError.includes('does not exist') || oldError.includes('relation') || oldError.includes('non-2xx')) {
          setNeedsSetup(true);
          setIsLoading(false);
          return;
        }
        toast.error(`Failed to fetch managed users: ${oldError}`);
      } else if (oldData) {
        // Transform old data to match new format
        const transformedData = oldData.map(user => ({
          user_id: user.user_id,
          email: user.email,
          name: user.name || user.email,
          can_view_other_users_data: false, // Default to false for old data
          access_granted_at: user.created_at,
          access_request_id: user.access_request_id
        }));
        setManagedUsers(transformedData);
        setNeedsSetup(false);
      }
    } catch (error) {
      console.error('Error fetching managed users:', error);
      toast.error('Failed to fetch user data');
    }
    
    setIsLoading(false);
  };

  // Handles toggling the "Can View Other Users' Data" permission
  const handleTogglePermission = async (userId: string, currentPermission: boolean, userEmail: string) => {
    const newPermission = !currentPermission;
    const { data, error } = await apiService.updateUserPermission(userId, newPermission);
    
    if (error) {
      toast.error(`Failed to update permission: ${error}`);
    } else {
      toast.success(`${userEmail} ${newPermission ? 'can now' : 'can no longer'} view other users' data`);
      fetchManagedUsers(); // Refresh the list to show updated permissions
    }
  };

  // Fetches access request history
  const fetchAccessHistory = async () => {
    setIsLoadingHistory(true);
    const { data, error } = await apiService.getAccessHistory();
    if (error) {
      toast.error(`Failed to fetch access history: ${error}`);
    } else if (data) {
      setAccessHistory(data);
    }
    setIsLoadingHistory(false);
  };

  useEffect(() => {
    fetchManagedUsers();
    if (activeTab === 'history') {
      fetchAccessHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchManagedUsers();
  }, []);

  // Handles revoking access for a specific user.
  const handleRevoke = async (requestId: string, userEmail: string) => {
    if (window.confirm(`Are you sure you want to revoke access to ${userEmail}?`)) {
      const { error } = await apiService.revokeAccess(requestId);
      if (error) {
        toast.error(`Failed to revoke access: ${error}`);
      } else {
        toast.success(`Access to ${userEmail} has been revoked.`);
        fetchManagedUsers(); // Refresh the list after revoking.
      }
    }
  };


  const filteredUsers = managedUsers.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistory = accessHistory.filter(request => {
    const matchesSearch = request.receiver_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.requester_email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'revoked':
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      accepted: 'default',
      rejected: 'destructive',
      pending: 'secondary',
      revoked: 'outline'
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {getStatusIcon(status)}
        <span className="ml-1">{status}</span>
      </Badge>
    );
  };

  // Show setup screen if database needs setup
  if (needsSetup) {
    if (setupInstructions) {
      return (
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">User Access Management</h2>
            <p className="text-sm text-gray-600 mt-1">Manage user account access and view access history.</p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <Database className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Manual Database Setup Required</h3>
            <p className="text-gray-600 mb-4">{setupInstructions.message}</p>
            
            <div className="text-left mb-4">
              <h4 className="font-semibold mb-2">Steps:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                {setupInstructions.steps.map((step: string, index: number) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">SQL Script:</h4>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(setupInstructions.sql)}
                    className="inline-flex items-center"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy SQL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                    className="inline-flex items-center"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Supabase
                  </Button>
                </div>
              </div>
              <pre className="bg-gray-800 text-white p-4 rounded-lg text-xs overflow-x-auto max-h-96">
                {setupInstructions.sql}
              </pre>
            </div>
            
            <div className="flex space-x-2 justify-center">
              <Button onClick={retryAfterManualSetup} className="inline-flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                I've Run the SQL - Check Again
              </Button>
              <Button variant="outline" onClick={() => setSetupInstructions(null)}>
                Back
              </Button>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">User Access Management</h2>
          <p className="text-sm text-gray-600 mt-1">Manage user account access and view access history.</p>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <Database className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Database Setup Required</h3>
          <p className="text-gray-600 mb-4">
            The access control system needs to be set up in your database. 
            Click the button below to get setup instructions.
          </p>
          <Button onClick={setupDatabase} disabled={isSettingUp} className="inline-flex items-center">
            <Wrench className="w-4 h-4 mr-2" />
            {isSettingUp ? 'Checking...' : 'Get Setup Instructions'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">User Access Management</h2>
        <p className="text-sm text-gray-600 mt-1">Manage user account access and view access history.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active Access ({filteredUsers.length})</TabsTrigger>
          <TabsTrigger value="history">Access History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Can View Other Users' Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Granted Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center p-6 text-gray-500">Loading...</td></tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.user_id || user.access_request_id}>
                      <td className="px-6 py-4 font-medium text-gray-900">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <ShieldCheck className="w-4 h-4 mr-1.5" />
                          Access Granted
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleTogglePermission(user.user_id, user.can_view_other_users_data, user.email)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              user.can_view_other_users_data
                                ? 'bg-blue-600'
                                : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                user.can_view_other_users_data ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <span className="text-sm text-gray-700">
                            {user.can_view_other_users_data ? (
                              <span className="inline-flex items-center text-green-700">
                                <Eye className="w-4 h-4 mr-1" />
                                Enabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-gray-500">
                                <EyeOff className="w-4 h-4 mr-1" />
                                Disabled
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.access_granted_at ? new Date(user.access_granted_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button variant="destructive" size="sm" onClick={() => handleRevoke(user.access_request_id || user.user_id, user.email)}>
                          <XCircle className="w-4 h-4 mr-2" />
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="text-center p-6 text-gray-500">No users have granted you access yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
            <Button onClick={fetchAccessHistory} variant="outline" size="sm">
              <History className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoadingHistory ? (
                  <tr><td colSpan={5} className="text-center p-6 text-gray-500">Loading history...</td></tr>
                ) : filteredHistory.length > 0 ? (
                  filteredHistory.map((request) => (
                    <tr key={request.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {request.requester_id ? 'Outgoing Request' : 'Incoming Request'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {request.receiver_email || request.requester_email || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {request.updated_at ? new Date(request.updated_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="text-center p-6 text-gray-500">No access history found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
