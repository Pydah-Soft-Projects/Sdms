import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
    RiHome4Line,
    RiHome4Fill,
    RiTicketLine,
    RiTicketFill,
    RiUser3Fill,
    RiLogoutBoxRLine,
    RiMenuLine,
    RiAddCircleLine,
    RiAddCircleFill,
    RiShieldCheckLine,
    RiShieldCheckFill
} from 'react-icons/ri';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import NotificationPrompt from '../NotificationPrompt';
import TopHeaderBar from '../student/TopHeaderBar';

const StudentLayout = () => {
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const isSuperAdminOrAdmin = user?.role === 'super_admin' || user?.role === 'admin';

    // Navigation Configuration: Dashboard, Raise Ticket, and Raised Tickets
    const navItems = [
        ...(isSuperAdminOrAdmin ? [
            { icon: RiShieldCheckLine, activeIcon: RiShieldCheckFill, label: 'Admin Portal', path: '/dashboard' }
        ] : []),
        { icon: RiHome4Line, activeIcon: RiHome4Fill, label: 'Dashboard', path: '/student/dashboard' },
        { icon: RiAddCircleLine, activeIcon: RiAddCircleFill, label: 'Raise Ticket', path: '/student/raise-ticket' },
        { icon: RiTicketLine, activeIcon: RiTicketFill, label: 'Raised Tickets', path: '/student/my-tickets' },
    ];

    const handleLogout = () => {
        logout();
        toast.success('Signed out successfully');
        navigate('/login');
    };

    const displayName = user?.name || user?.student_name || user?.username || 'Staff Member';
    const displayRole = user?.role ? user.role.toUpperCase() : (user?.admission_number || user?.email || 'STAFF');

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
            {/* Background Pattern - SDMS signature soft sky dots */}
            <div
                className="fixed inset-0 -z-10 pointer-events-none"
                style={{
                    opacity: 0.45,
                    backgroundImage: 'radial-gradient(#BAE6FD 1.2px, transparent 1.2px)',
                    backgroundSize: '24px 24px'
                }}
            />

            {/* Desktop Sidebar Toggle Button when collapsed */}
            {!desktopSidebarOpen && (
                <button
                    className="hidden lg:flex fixed top-4 left-4 z-50 p-2 bg-white/90 backdrop-blur-md rounded-xl shadow-xs border border-slate-200 text-slate-600 hover:text-slate-900 transition-all hover:scale-105 active:scale-95"
                    onClick={() => setDesktopSidebarOpen(true)}
                    title="Open Sidebar"
                >
                    <RiMenuLine size={20} />
                </button>
            )}

            {/* Sidebar (Desktop & Tablet) */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-40 w-72 bg-white/95 backdrop-blur-xl border-r border-slate-200/70
                    shadow-[4px_0_24px_-2px_rgba(15,23,42,0.03)] flex flex-col justify-between transition-transform duration-300 ease-in-out
                    ${desktopSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    hidden lg:flex
                `}
            >
                <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                    {/* Logo & Brand Area */}
                    <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 bg-white/60">
                        <div
                            className="flex items-center gap-3 cursor-pointer group"
                            onClick={() => navigate('/student/dashboard')}
                        >
                            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-md shadow-sky-200 flex items-center justify-center text-white font-bold text-lg tracking-tight transition-transform duration-200 group-hover:scale-105">
                                T
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[15px] font-bold text-slate-900 tracking-tight leading-tight">
                                    Ticket Support
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Pydah Group
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setDesktopSidebarOpen(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 rounded-lg transition-all"
                            title="Collapse Sidebar"
                        >
                            <RiMenuLine size={18} />
                        </button>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto no-scrollbar">
                        {navItems.map((item, index) => (
                            <NavLink
                                key={index}
                                to={item.path}
                                className={({ isActive }) => `
                                    relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] transition-all duration-200 group
                                    ${isActive
                                        ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-200/80 shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'}
                                `}
                            >
                                {({ isActive }) => {
                                    const Icon = isActive ? item.activeIcon : item.icon;
                                    return (
                                        <>
                                            {isActive && (
                                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full bg-sky-500"></span>
                                            )}
                                            <Icon
                                                size={19}
                                                className={`transition-colors ${isActive ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                                            />
                                            <span className="tracking-tight">{item.label}</span>
                                            {isActive && (
                                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></div>
                                            )}
                                        </>
                                    );
                                }}
                            </NavLink>
                        ))}

                        {/* Quick Helpdesk Assist Card on Desktop */}
                        <div className="pt-4">
                            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-50/80 to-indigo-50/40 border border-sky-100/90 shadow-2xs">
                                <div className="flex items-center gap-2 text-sky-700 font-bold text-xs mb-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                                    <span>Facility Support</span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                    Report campus maintenance, electricity, water, or equipment queries anytime.
                                </p>
                            </div>
                        </div>
                    </nav>

                    {/* User Profile Card */}
                    <div className="mx-3.5 mb-3 p-3 rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:shadow-sm transition-all flex items-center gap-3">
                        <div className="relative shrink-0">
                            <div className="h-10 w-10 rounded-full ring-2 ring-white shadow-xs bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden">
                                {user?.student_photo ? (
                                    <img src={user.student_photo} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    displayName.charAt(0).toUpperCase()
                                )}
                            </div>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] font-bold text-slate-900 truncate leading-tight" title={displayName}>
                                {displayName}
                            </p>
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-100 uppercase tracking-wider">
                                {displayRole}
                            </span>
                        </div>
                    </div>

                    {/* Logout Button */}
                    <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center gap-2 px-3 py-2 w-full rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                        >
                            <RiLogoutBoxRLine size={15} />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Container */}
            <main
                className={`
                    flex-1 h-screen overflow-y-auto px-4 lg:px-8 py-4 lg:py-6 relative transition-all duration-300
                    ${desktopSidebarOpen ? 'lg:ml-72' : 'lg:ml-0'}
                    pb-24 lg:pb-8
                `}
            >
                {/* SDMS Top Header Bar */}
                <TopHeaderBar />

                {/* Page Outlet - Full Width Responsive Container */}
                <div className="w-full">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation Bar matching SDMS */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-2 py-2 flex items-center justify-around shadow-lg">
                {navItems.map((item, index) => (
                    <NavLink
                        key={index}
                        to={item.path}
                        className={({ isActive }) => `
                            flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-semibold transition-all
                            ${isActive ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}
                        `}
                    >
                        <item.icon size={20} />
                        <span className="text-[10px]">
                            {item.label === 'Raised Tickets' ? 'Tickets' : item.label === 'Raise Ticket' ? 'Raise' : 'Dashboard'}
                        </span>
                    </NavLink>
                ))}
            </div>

            <NotificationPrompt />
        </div>
    );
};

export default StudentLayout;
