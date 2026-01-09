import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved && JSON.parse(saved) ? 72 : 240;
  });

  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('sidebarCollapsed');
      setSidebarWidth(saved && JSON.parse(saved) ? 72 : 240);
    };

    window.addEventListener('storage', handleStorage);
    // Poll for changes since storage event doesn't fire in same tab
    const interval = setInterval(handleStorage, 100);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      {/* Main Content */}
      <main
        style={{ marginLeft: `${sidebarWidth}px` }}
        className="flex-1 p-4 md:p-8 overflow-y-auto transition-[margin] duration-300 ease-in-out"
      >
        <div className="max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
