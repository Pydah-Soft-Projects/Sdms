import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
    LayoutDashboard,
    ClipboardList,
    Settings,
    Users,
    Shield,
    LogOut,
    Menu
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const AdminLayout = () => {
    // State
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        toast.success('Logged out successfully');
        navigate('/login');
    };

    const isSuperAdminOrAdmin = user?.role === 'super_admin' || user?.role === 'admin';
    const isWorker = Boolean(user?.role === 'worker' || user?.is_worker);

    // --- Navigation Configuration ---
    const allNavItems = [
        {
            id: 'dashboard',
            icon: LayoutDashboard,
            label: 'Dashboard',
            path: '/dashboard',
            hideForWorker: true,
            module: 'ticket_dashboard'
        },
        {
            id: 'task-management',
            icon: ClipboardList,
            label: 'Task Management',
            path: '/task-management',
            module: 'ticket_management'
        },
        {
            id: 'configuration',
            icon: Settings,
            label: 'Configuration',
            path: '/configuration',
            hideForWorker: true,
            module: 'category_management'
        },
        {
            id: 'employees',
            icon: Users,
            label: 'Employees',
            path: '/employees',
            hideForWorker: true,
            module: 'employee_management'
        },
        {
            id: 'sub-admins',
            icon: Shield,
            label: 'Sub Admins',
            path: '/sub-admins',
            adminOnly: true
        },
        {
            id: 'roles',
            icon: Shield,
            label: 'Role Management',
            path: '/roles',
            adminOnly: true
        }
    ];

    // Filter navigation items by user access scope
    const navItems = allNavItems.filter((item) => {
        if (item.adminOnly) {
            return isSuperAdminOrAdmin;
        }

        if (isWorker && item.hideForWorker) {
            return false;
        }

        if (isSuperAdminOrAdmin) {
            return true;
        }

        if (isWorker && item.id === 'task-management') {
            return true;
        }

        // Check granular permissions for this module
        if (item.module && user?.permissions) {
            const perm = user.permissions[item.module];
            if (perm) {
                if (typeof perm === 'boolean') return perm;
                if (typeof perm === 'object') return Object.values(perm).some((v) => v === true);
            }
        }

        // Default for managers/staff with manage access without explicit perms: allow dashboard and task management
        if (!isWorker && ['dashboard', 'task-management'].includes(item.id)) {
            return true;
        }

        return false;
    });

    // --- Inline Styles & Media Queries (Matching StudentLayout) ---
    const styles = {
        container: {
            display: 'flex',
            height: '100vh',
            backgroundColor: '#F8FAFC',
            overflow: 'hidden',
        },
        sidebar: {
            width: '270px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRight: '1px solid #e2e8f0',
            height: '100%',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 40,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: desktopSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
        },
        logoArea: {
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid #f1f5f9',
        },
        logoBox: {
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '18px',
            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)',
        },
        logoText: {
            fontSize: '15px',
            fontWeight: '600',
            color: '#0f172a',
            marginLeft: '12px',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            letterSpacing: '-0.01em',
        },
        nav: {
            padding: '16px 14px',
            overflowY: 'auto',
            flex: 1,
        },
        navItem: (isActive) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            marginBottom: '4px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: isActive ? '600' : '500',
            textDecoration: 'none',
            color: isActive ? '#0369a1' : '#475569',
            backgroundColor: isActive ? '#f0f9ff' : 'transparent',
            transition: 'all 0.15s ease',
            position: 'relative',
        }),
        mainContent: {
            flex: 1,
            height: '100vh',
            overflowY: 'auto',
            padding: '24px 32px',
            paddingBottom: '100px',
            marginLeft: desktopSidebarOpen ? '270px' : '0',
            transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            width: desktopSidebarOpen ? 'calc(100% - 270px)' : '100%',
            maxWidth: desktopSidebarOpen ? 'calc(100% - 270px)' : '100%',
            boxSizing: 'border-box',
            minWidth: 0,
        },
        toggleButton: {
            position: 'fixed', top: '24px', left: '24px', zIndex: 50,
            padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.8)',
            border: '1px solid #e5e7eb', cursor: 'pointer', backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        },
        profileCard: {
            margin: '0 14px 10px 14px',
            padding: '10px 12px',
            borderRadius: '12px',
            background: 'white',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
        },
        logoutButton: {
            width: '100%', padding: '9px 12px', borderRadius: '10px',
            backgroundColor: '#ffffff', color: '#dc2626',
            border: '1px solid #fee2e2', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            fontSize: '12px', fontWeight: '600',
            transition: 'all 0.15s ease'
        },
        mobileHeader: {
            display: 'none',
            height: '64px',
            background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            position: 'fixed',
            top: 0, left: 0, right: 0,
            zIndex: 45,
            color: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        },
        mobileBottomBar: {
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderTop: '1px solid rgba(226, 232, 240, 0.8)',
            backdropFilter: 'blur(12px)',
            zIndex: 50,
            paddingBottom: 'env(safe-area-inset-bottom, 20px)',
            justifyContent: 'space-around',
            paddingTop: '8px',
            height: 'auto',
            boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)',
        },
        mobileNavItem: (isActive) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '8px',
            textDecoration: 'none',
            color: isActive ? '#2563EB' : '#9CA3AF',
            fontSize: '10px',
            fontWeight: '600',
        }),
        backdrop: {
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 48,
            backdropFilter: 'blur(2px)',
        }
    };

    return (
        <div style={styles.container}>
            {/* Inject CSS for Media Queries */}
            <style>{`
                @media (max-width: 1024px) {
                    .desktop-sidebar { width: 270px; z-index: 60 !important; }
                    .main-content {
                        margin-left: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 16px !important;
                        padding-top: 80px !important;
                        padding-bottom: 96px !important;
                    }
                    .mobile-header { display: flex !important; }
                    .mobile-bottom-bar { display: flex !important; }
                }
                @media (min-width: 1025px) {
                    .desktop-sidebar { display: flex !important; }
                    .mobile-header { display: none !important; }
                    .mobile-bottom-bar { display: none !important; }
                }
            `}</style>

            {/* Background Pattern */}
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 0,
                pointerEvents: 'none',
                opacity: 0.4,
                backgroundImage: `radial-gradient(#CBD5E1 1.5px, transparent 1.5px)`,
                backgroundSize: '24px 24px'
            }} />

            {/* Mobile Sidebar Backdrop */}
            {desktopSidebarOpen && (
                <div
                    className="lg:hidden"
                    style={styles.backdrop}
                    onClick={() => setDesktopSidebarOpen(false)}
                />
            )}

            {/* Mobile Header (Blue Theme) */}
            <header style={styles.mobileHeader} className="mobile-header">
                <button
                    onClick={() => setDesktopSidebarOpen(true)}
                    className="p-2 -ml-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                    <Menu size={24} />
                </button>

                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <span className="font-bold text-white">A</span>
                    </div>
                    <span className="font-bold text-lg tracking-wide text-white">Admin Portal</span>
                </div>

                <div
                    className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/20"
                >
                    <span className="text-sm font-bold text-white">{user?.username?.charAt(0).toUpperCase() || 'A'}</span>
                </div>
            </header>

            {/* Sidebar */}
            <aside style={styles.sidebar} className="desktop-sidebar shadow-xl">
                <div style={styles.logoArea}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={styles.logoBox}>T</div>
                        <span style={styles.logoText}>Ticket Admin</span>
                    </div>
                    {/* Hide sidebar button (Desktop only) */}
                    <button onClick={() => setDesktopSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                        <Menu size={20} />
                    </button>
                </div>

                <nav style={styles.nav} className="custom-scrollbar">
                    {navItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={index}
                                to={item.path}
                                style={({ isActive }) => styles.navItem(isActive)}
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon size={20} />
                                        <span>{item.label}</span>
                                        {isActive && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563EB' }} />}
                                    </>
                                )}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* User Info */}
                <div style={styles.profileCard}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5', fontSize: '14px', fontWeight: 'bold' }}>
                        {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                            {user?.name || user?.username || 'Admin'}
                        </p>
                        <p style={{ fontSize: '11px', color: '#6B7280', margin: 0 }}>
                            {user?.role}
                        </p>
                    </div>
                </div>

                <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                    <button onClick={handleLogout} style={styles.logoutButton}>
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main style={styles.mainContent} className="main-content">
                <Outlet />
            </main>

            {/* Mobile Bottom Bar */}
            <div style={styles.mobileBottomBar} className="mobile-bottom-bar">
                {navItems.slice(0, 4).map((item, index) => (
                    <NavLink
                        key={index}
                        to={item.path}
                        style={({ isActive }) => styles.mobileNavItem(isActive)}
                    >
                        <item.icon size={24} />
                        <span>{item.label === 'Task Management' ? 'Tickets' : item.label === 'Configuration' ? 'Settings' : item.label}</span>
                    </NavLink>
                ))}
            </div>
        </div>
    );
};

export default AdminLayout;
