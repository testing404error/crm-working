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
import { Plus, Users, Shield, Eye, EyeOff, UserCheck, UserX } from 'lucide-react';

export const AssigneeSettings: React.FC = () => {
  const { user } = useAuth();
  const [availableUsers, setAvailableUsers] = useState<Assignee[]>([]);
  const [myAccessGrants, setMyAccessGrants] = useState<any[]>([]);
  const [accessToMe, setAccessToMe] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [activeTab, setActiveTab] = useState<'grant' | 'granted' | 'received'>('grant');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Get all available users for assignment
      const users = await getAssignees();
      setAvailableUsers(users.filter(u => u.id !== user.id)); // Exclude self
      
      // Get users I have granted access to my data
      const accessGranted = await getUsersWithAccessToMyData(user.id);
      setMyAccessGrants(accessGranted);
      
      // Get users whose data I have access to
      const accessReceived = await getUsersIHaveAccessTo(user.id);
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
    if (!selectedUserId || !user) return;

    try {
      await addAssigneeRelationship(user.id, selectedUserId);
      setSelectedUserId('');
      await fetchData();
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRevokeAccess = async (grantorId: string, granteeId: string) => {
    if (window.confirm('Are you sure you want to revoke this access?')) {
      try {
        await removeAssigneeRelationship(grantorId, granteeId);
        await fetchData();
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };
  
  return (
    <div className="p-6">
      <h3 className="text-lg font-medium mb-4">Manage Assignees</h3>
      {error && <div className="text-red-500 mb-4">{error}</div>}

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
