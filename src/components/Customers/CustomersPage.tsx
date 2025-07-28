import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const CustomersPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="p-6 text-red-600">
        Please log in to access the customers page.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-2">Manage your customer database and relationships</p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">
          ✅ Admin users can see all customers from all users.<br/>
          ✅ Regular users can only see their own customers.<br/>
          🚧 Customer management features will be implemented soon.
        </p>
      </div>
    </div>
  );
};

// Temporary placeholder - original complex code would go here when services are working
