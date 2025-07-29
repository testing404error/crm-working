import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Search, Bell, User as UserIcon, Plus, Menu, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { apiService } from '../../services/apiService'; // Use the final unified apiService
import { useAuth } from '../../contexts/AuthContext';
import { AdminStatusIndicator } from './AdminStatusIndicator';

interface HeaderProps {
  onMenuToggle: () => void;
  onInviteUserClick: () => void;
}

// This interface matches the data structure from our unified backend function
interface Request {
    id: string;
    requester: {
        email: string;
    };
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle, onInviteUserClick }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);

  // Function to fetch pending requests
  const fetchRequests = async () => {
    try {
      const { data, error } = await apiService.getPendingRequests();
      if (error) {
        console.error("Failed to fetch requests:", error);
        setRequests([]);
      } else if (data) {
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      setRequests([]);
    }
  };

  // Fetch requests when the component mounts and poll for updates
  useEffect(() => {
    fetchRequests();
    // Poll every 30 seconds for real-time notifications
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRequestUpdate = async (requestId: string, status: 'accepted' | 'rejected') => {
    const { error } = await apiService.updateRequestStatus(requestId, status);
    if (error) {
      toast.error(`Failed to update request: ${error}`);
    } else {
      toast.success(`Request has been ${status}.`);
      fetchRequests(); // Re-fetch to update the UI
    }
  };

  return (
    <header className="bg-white shadow-sm z-10">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-4">
          <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100">
            <Menu className="w-6 h-6" />
          </button>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2 w-full border rounded-lg" />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Admin Status Indicator */}
          <AdminStatusIndicator />
          
          {/* Request Access button - only available to admin users */}
          {user?.role === 'admin' && (
            <Button onClick={onInviteUserClick}>
              <Plus className="w-4 h-4 mr-2" />
              Request Access
            </Button>
          )}

          {/* --- NOTIFICATION BELL DROPDOWN --- */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative p-2 rounded-full hover:bg-gray-100">
                <Bell className="w-6 h-6 text-gray-600" />
                {requests.length > 0 && (
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Access Requests</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {requests.length > 0 ? (
                requests.map((req) => (
                  <DropdownMenuItem key={req.id} onSelect={(e) => e.preventDefault()} className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{req.requester.email}</p>
                      <p className="text-xs text-gray-500">Wants to access your account</p>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleRequestUpdate(req.id, 'accepted')}>Accept</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRequestUpdate(req.id, 'rejected')}>Reject</Button>
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem>No pending requests.</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button className="p-2 rounded-full hover:bg-gray-100">
            <UserIcon className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>
    </header>
  );
};
