import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { apiService } from '../../services/apiService'; // Using a unified service is a good practice
import { useAuth } from '../../contexts/AuthContext';

interface User {
  id: string;
  email: string;
  user_metadata?: { role?: string; };
}

interface RequestAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({ isOpen, onClose }) => {
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        setIsLoading(true);
        const { data, error } = await apiService.getAvailableUsers();
        if (error) {
          toast.error(`Failed to fetch users: ${error}`);
        } else if (data) {
          const filteredUsers = data.filter(u => u.id !== adminUser?.id);
          setUsers(filteredUsers);
        }
        setIsLoading(false);
      };
      fetchUsers();
    }
  }, [isOpen, adminUser]);

  const handleSendRequest = async () => {
    if (!selectedUserId) {
      toast.warn('Please select a user to send the request to.');
      return;
    }
    
    setIsLoading(true);
    // Send the request with the proper receiverId in the request body.
    const { error } = await apiService.sendRequest(selectedUserId);
    setIsLoading(false);

    if (error) {
      // Show a detailed error toast if the request fails.
      toast.error(`Failed to send request: ${error}`);
    } else {
      // Show a success toast and close the modal.
      toast.success('Access request sent successfully!');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Request Access to User Account</DialogTitle></DialogHeader>
        <div className="py-4">
          {isLoading ? <p className="text-center text-gray-500">Loading users...</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {users.length > 0 ? (
                users.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${
                      selectedUserId === user.id 
                      ? 'bg-blue-100 border border-blue-300 ring-2 ring-blue-200' 
                      : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <p className="font-medium text-gray-800">{user.email}</p>
                    <span className="text-xs font-semibold uppercase text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                      {user.user_metadata?.role || 'User'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500">No other users found to request access from.</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSendRequest} disabled={isLoading || !selectedUserId}>
            {isLoading ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
