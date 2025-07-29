import React, { useState, useEffect } from 'react';
import { Assignee } from '../../types';
import { 
  getAssignees, 
  getAssigneeRelationships, 
  addAssigneeRelationship, 
  removeAssigneeRelationship,
  getUsersWithAccessToMyData,
  getUsersIHaveAccessTo 
} from '../../services/assigneeService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Users, Shield, Eye, EyeOff, UserCheck, UserX, Info, Settings } from 'lucide-react';

export const AssigneeSettings: React.FC = () => {
  const { user } = useAuth();
  const [availableUsers, setAvailableUsers] = useState<Assignee[]>([]);
  const [myAccessGrants, setMyAccessGrants] = useState<any[]>([]);
  const [accessToMe, setAccessToMe] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [activeTab, setActiveTab] = useState<'grant' | 'granted' | 'received'>('grant');
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchDbUserId();
    }
  }, [user]);

  // Get the database user ID from the auth user ID
  const fetchDbUserId = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
      
      if (error) {
        setError(`Failed to get user database ID: ${error.message}`);
        return;
      }
      
      setDbUserId(data.id);
      fetchData(data.id);
    } catch (err: any) {
      setError(`Failed to get user database ID: ${err.message}`);
    }
  };

  const fetchData = async (userId?: string) => {
    const currentDbUserId = userId || dbUserId;
    if (!currentDbUserId) return;
    
    try {
      setIsLoading(true);
      
      // Get all available users for assignment
      const users = await getAssignees();
      setAvailableUsers(users.filter(u => u.id !== currentDbUserId)); // Exclude self using database ID
      
      // Get users I have granted access to my data
      const accessGranted = await getUsersWithAccessToMyData(currentDbUserId);
      setMyAccessGrants(accessGranted);
      
      // Get users whose data I have access to
      const accessReceived = await getUsersIHaveAccessTo(currentDbUserId);
      setAccessToMe(accessReceived);
      
      setError(null);
    } catch (err: any) {
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !dbUserId) return;

    try {
      await addAssigneeRelationship(dbUserId, selectedUserId);
      setSelectedUserId('');
      await fetchData();
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRevokeAccess = async (grantorId: string, granteeId: string) => {
    if (!dbUserId) return;
    if (window.confirm('Are you sure you want to revoke this access?')) {
      try {
        await removeAssigneeRelationship(dbUserId, granteeId);
        await fetchData();
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };
  
  // Check if current user is admin
  const isAdmin = user?.role === 'admin';
  
  return (
    <div className="p-6">
      <h3 className="text-lg font-medium mb-4">Manage Assignees</h3>
      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* Admin Auto-Sharing Information */}
      {isAdmin && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Admin Auto-Sharing</h4>
              <p className="text-sm text-blue-800 mb-2">
                As an admin, any leads or opportunities you create will be automatically shared with all users listed in the "Access I've Granted" section below.
              </p>
              <p className="text-xs text-blue-700">
                This allows assigned users to immediately access and manage admin-created data without manual assignment.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h4 className="font-semibold">Grant Data Access</h4>
        <form onSubmit={handleGrantAccess} className="flex items-center space-x-2 mt-2">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="p-2 border rounded-lg">
            <option value="">Select a user...</option>
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Grant Access
          </button>
        </form>
      </div>

      <div className="mt-8">
        <h4 className="font-semibold">Access I've Granted</h4>
        {myAccessGrants.map((access) => (
          <div key={access.id} className="flex items-center justify-between p-2 border rounded-lg mt-2">
            <div>
              <p>{access.users.name}</p>
              <p className="text-sm text-gray-500">{access.users.email}</p>
            </div>
            <button
              onClick={() => handleRevokeAccess(user.id, access.granted_to_user_id)}
              className="text-red-600">
              Revoke
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h4 className="font-semibold">Access I've Received</h4>
        {accessToMe.map((access) => (
          <div key={access.id} className="flex items-center justify-between p-2 border rounded-lg mt-2">
            <div>
              <p>{access.users.name}</p>
              <p className="text-sm text-gray-500">{access.users.email}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
