import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, User } from 'lucide-react';

export const AdminStatusIndicator: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  return (
    <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
      isAdmin 
        ? 'bg-red-100 text-red-800 border border-red-200' 
        : 'bg-blue-100 text-blue-800 border border-blue-200'
    }`}>
      {isAdmin ? (
        <>
          <Shield className="w-3 h-3" />
          Admin Access
        </>
      ) : (
        <>
          <User className="w-3 h-3" />
          Regular User
        </>
      )}
    </div>
  );
};
