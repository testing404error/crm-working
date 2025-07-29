import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { RequestAccessModal } from '../Modals/RequestAccessModal';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { Send, UserPlus, Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export const AccessDashboard: React.FC = () => {
  const { user } = useAuth();
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check if current user is admin
  const isAdmin = user?.role === 'admin';

  const fetchPendingRequests = async () => {
    setIsLoading(true);
    const { data, error } = await apiService.getPendingRequests();
    if (error) {
      toast.error(`Failed to fetch pending requests: ${error}`);
    } else if (data) {
      setPendingRequests(data);
    }
    setIsLoading(false);
  };

  const handleAcceptRequest = async (requestId: string, requesterEmail: string) => {
    const { error } = await apiService.updateRequestStatus(requestId, 'accepted');
    if (error) {
      toast.error(`Failed to accept request: ${error}`);
    } else {
      toast.success(`Access request from ${requesterEmail} has been accepted.`);
      fetchPendingRequests(); // Refresh the list
    }
  };

  const handleRejectRequest = async (requestId: string, requesterEmail: string) => {
    const { error } = await apiService.updateRequestStatus(requestId, 'rejected');
    if (error) {
      toast.error(`Failed to reject request: ${error}`);
    } else {
      toast.success(`Access request from ${requesterEmail} has been rejected.`);
      fetchPendingRequests(); // Refresh the list
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  // Only admin users can access this dashboard
  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-600">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p>Only administrators can access the Access Management dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Access Management</h2>
        <p className="text-gray-600 mt-1">
          Send access requests to users and manage incoming requests.
        </p>
      </div>

      {/* Admin Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Send Access Request</h3>
            <p className="text-sm text-gray-600 mt-1">
              Request access to another user's data to manage their leads and opportunities.
            </p>
          </div>
          <Button 
            onClick={() => setIsRequestModalOpen(true)}
            className="inline-flex items-center"
          >
            <Send className="w-4 h-4 mr-2" />
            Request Access
          </Button>
        </div>
      </div>

      {/* Pending Requests */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Pending Requests</h3>
            <Badge variant="secondary">{pendingRequests.length}</Badge>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Manage incoming access requests from other users.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : pendingRequests.length > 0 ? (
            pendingRequests.map((request) => (
              <div key={request.id} className="p-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Access request from {request.requester?.email || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Sent on {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRejectRequest(request.id, request.requester?.email || 'Unknown')}
                    className="inline-flex items-center text-red-600 hover:text-red-700"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAcceptRequest(request.id, request.requester?.email || 'Unknown')}
                    className="inline-flex items-center"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Accept
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No pending access requests</p>
            </div>
          )}
        </div>
      </div>

      {/* Request Access Modal */}
      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
      />
    </div>
  );
};
