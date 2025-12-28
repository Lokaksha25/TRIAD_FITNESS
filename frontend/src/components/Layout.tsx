import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquareText, Activity, User, Battery, Brain, List, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navItems = [
    { path: '/', label: 'Chat', icon: MessageSquareText },
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/nutritionist', label: 'Nutritionist', icon: Activity },
    { path: '/trainer', label: 'Trainer', icon: User },
    { path: '/wellness', label: 'Wellness', icon: Battery },
    { path: '/manager', label: 'Manager', icon: Brain },
    { path: '/timeline', label: 'Timeline', icon: List },
    { path: '/profile', label: 'Profile', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-white border-r border-stone-200 flex flex-col fixed h-full z-10 transition-all duration-300 shadow-sm">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-stone-100">
          <div className="w-8 h-8 bg-stone-800 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            <Brain className="text-white" size={20} />
          </div>
          <span className="hidden lg:block ml-3 font-bold text-stone-800 text-lg tracking-tight">Triad Fitness</span>
        </div>

        <nav className="flex-1 py-6 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `relative flex items-center p-3 rounded-lg transition-all duration-200 group ${isActive
                  ? 'bg-stone-100 text-stone-900 font-semibold shadow-sm ring-1 ring-stone-200'
                  : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} className={`shrink-0 ${isActive ? 'text-stone-800' : 'text-stone-400 group-hover:text-stone-600'}`} />
                  <span className="hidden lg:block ml-3 font-medium text-sm">{item.label}</span>

                  {/* Active Indicator for mobile/collapsed */}
                  {isActive && (
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-stone-800 rounded-l lg:hidden" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-stone-100">
          <div className="bg-stone-50 rounded-lg p-3 hidden lg:block border border-stone-200">
            <p className="text-xs text-stone-500 font-mono">v1.0.4-alpha</p>
            <div className="flex items-center mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></div>
              <p className="text-xs text-stone-700 font-medium">System Stable</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-20 lg:ml-64 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
