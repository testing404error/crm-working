import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { LoginPage } from './components/Auth/LoginPage';
import { RegisterPage } from './components/Auth/RegisterPage';
import { AuthCallback } from './components/Auth/AuthCallback';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { LeadsPage } from './components/Leads/LeadsPage';
import { OpportunitiesPage } from './components/Opportunities/OpportunitiesPage';
import { CustomersPage } from './components/Customers/CustomersPage';
import { ActivitiesPage } from './components/Activities/ActivitiesPage';
import { ReportsPage } from './components/Reports/ReportsPage';
import { SettingsPage } from './components/Settings/SettingsPage';

import { mockUsers } from './data/mockData';
import { User } from './types';

// This component will handle the invitation acceptance link.
const AcceptInvitePage: React.FC<{ setUsers: React.Dispatch<React.SetStateAction<User[]>> }> = ({ setUsers }) => {
    const navigate = useNavigate();

    useEffect(() => {
        const token = new URLSearchParams(window.location.search).get('token');
        console.log("Attempting to accept invite with token:", token);

        // --- FIX: This logic now correctly finds the first invited user ---
        let userActivated = false;
        setUsers(prevUsers => {
            const userIndex = prevUsers.findIndex(u => u.status === 'Invited');
            
            if (userIndex > -1) {
                const updatedUsers = [...prevUsers];
                updatedUsers[userIndex] = { ...updatedUsers[userIndex], status: 'Active', name: 'New User (Activated)' };
                userActivated = true;
                return updatedUsers;
            }
            
            return prevUsers; // No invited user found, return original state
        });
        
        if (userActivated) {
            toast.success("Welcome! Your account is now active. Please log in.");
        } else {
            toast.error("Invalid or expired invitation link.");
        }
        
        navigate('/login');

    }, [navigate, setUsers]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Activating your account, please wait...</p>
            </div>
        </div>
    );
};


// PrivateRoute - simplified without user management props
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Return Layout without user management props
  return <Layout>{children}</Layout>;
};

const AuthRoutes: React.FC = () => {
  const { user } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return authMode === 'login' ? (
    <LoginPage onSwitchToRegister={() => setAuthMode('register')} />
  ) : (
    <RegisterPage onSwitchToLogin={() => setAuthMode('login')} />
  );
};

const App: React.FC = () => {
  // User state is now managed at the top level of the app
  const [users, setUsers] = useState<User[]>(mockUsers);

  return (
    <AuthProvider>
      <SettingsProvider>
        <Router>
          <div>
            {/* AuthCallback component to handle magic link authentication */}
            {/* <AuthCallback /> */}
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
            />
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<AuthRoutes />} />
              <Route path="/register" element={<AuthRoutes />} />
              <Route path="/accept-invite" element={<AcceptInvitePage setUsers={setUsers} />} />

              {/* Private routes - simplified without user management */}
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/leads"
                element={
                  <PrivateRoute>
                    <LeadsPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/opportunities"
                element={
                  <PrivateRoute>
                    <OpportunitiesPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/customers"
                element={
                  <PrivateRoute>
                    <CustomersPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/activities"
                element={
                  <PrivateRoute>
                    <ActivitiesPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <PrivateRoute>
                    <ReportsPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/settings/*"
                element={
                  <PrivateRoute>
                    <SettingsPage users={users} setUsers={setUsers} />
                  </PrivateRoute>
                }
              />

              {/* Redirects */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;
