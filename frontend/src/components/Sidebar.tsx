import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    MessageSquareText,
    Activity,
    User,
    Battery,
    Brain,
    Settings,
    LogOut
} from 'lucide-react';

interface NavItem {
    path: string;
    label: string;
    icon: React.ElementType;
}

const Sidebar: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/auth');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    // Get user display info from Firebase auth
    const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
    const userEmail = currentUser?.email || '';
    const userInitials = displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const navItems: NavItem[] = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/chat', label: 'Chat', icon: MessageSquareText },
        { path: '/nutritionist', label: 'Nutritionist', icon: Activity },
        { path: '/trainer', label: 'Trainer', icon: User },
        { path: '/wellness', label: 'Wellness', icon: Battery },
        { path: '/manager', label: 'Manager', icon: Brain },
        { path: '/profile', label: 'Settings', icon: Settings },
    ];

    const handleMouseEnter = () => {
        setIsExpanded(true);
    };

    const handleMouseLeave = () => {
        setIsExpanded(false);
    };

    useEffect(() => {
        // Update localStorage for Layout component to sync
        localStorage.setItem('sidebarCollapsed', JSON.stringify(!isExpanded));
    }, [isExpanded]);

    return (
        <motion.aside
            initial={false}
            animate={{
                width: isExpanded ? 240 : 72,
            }}
            transition={{
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1],
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="bg-card border-r border-border flex flex-col fixed h-full z-10 shadow-sm"
        >
            {/* Header with Logo */}
            <div className="h-16 flex items-center px-4 border-b border-border">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-md">
                        <Brain className="text-white" size={20} />
                    </div>
                    <AnimatePresence mode="wait">
                        {isExpanded && (
                            <motion.span
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="font-bold text-foreground text-base tracking-tight whitespace-nowrap"
                            >
                                Triad Fitness
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                ? 'bg-secondary text-primary shadow-sm'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon
                                    size={20}
                                    className={`shrink-0 ${isActive ? 'text-blue-500' : 'text-muted-foreground group-hover:text-foreground'}`}
                                />
                                <AnimatePresence mode="wait">
                                    {isExpanded && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.2 }}
                                            className="font-medium text-sm whitespace-nowrap"
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}
                                </AnimatePresence>

                                {/* Active indicator */}
                                {isActive && (
                                    <motion.div
                                        layoutId="activeIndicator"
                                        className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-l"
                                        transition={{
                                            type: "spring",
                                            stiffness: 380,
                                            damping: 30,
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* User Profile */}
            <div className="p-3 border-t border-border">
                <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-secondary overflow-hidden">
                    {currentUser?.photoURL ? (
                        <img
                            src={currentUser.photoURL}
                            alt={displayName}
                            className="w-8 h-8 rounded-full shrink-0 shadow-md"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 text-white font-semibold text-xs shadow-md">
                            {userInitials}
                        </div>
                    )}
                    <AnimatePresence mode="wait">
                        {isExpanded && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 min-w-0"
                            >
                                <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <AnimatePresence mode="wait">
                        {isExpanded && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                                onClick={handleLogout}
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                title="Logout"
                            >
                                <LogOut size={16} />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.aside>
    );
};

export default Sidebar;
