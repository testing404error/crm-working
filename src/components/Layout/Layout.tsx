import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { RequestAccessModal } from '../Modals/RequestAccessModal';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Your existing state for the sidebars
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // State to control the request access modal
  const [isRequestModalOpen, setRequestModalOpen] = useState(false);
  
  const location = useLocation();

  // Your existing sidebar toggle functions
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const currentPath = location.pathname;

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar
          isOpen={sidebarOpen}
          currentPath={currentPath}
          onToggle={toggleSidebar}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={toggleMobileMenu} />
          <div className="relative w-64">
            <Sidebar isOpen={true} currentPath={currentPath} onToggle={toggleMobileMenu} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onMenuToggle={toggleMobileMenu} 
          onInviteUserClick={() => setRequestModalOpen(true)}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      
      {/* The RequestAccessModal remains at the root of the layout */}
      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setRequestModalOpen(false)}
      />
    </div>
  );
};
