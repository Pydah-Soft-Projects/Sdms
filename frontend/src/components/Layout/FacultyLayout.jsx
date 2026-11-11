/**
 * Faculty Portal Layout (Pydah v2.0)
 * Standardized Campo Portal Sidebar Integration
 */

import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  FileText,
  Megaphone,
  Users,
  MessageSquare,
  Clock,
  Menu,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import LogoutConfirmModal from '../LogoutConfirmModal';
import Sidebar from './Sidebar';

const NAV_ITEMS = [
  { path: '/faculty/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'MAIN' },
  { path: '/faculty/attendance', icon: CalendarCheck, label: 'Post Attendance', section: 'OPERATIONS' },
  { path: '/faculty/timetable', icon: Clock, label: 'My Timetable', section: 'OPERATIONS' },
  { path: '/faculty/content', icon: FileText, label: 'My Content', section: 'OPERATIONS' },
  { path: '/faculty/announcements', icon: Megaphone, label: 'Announcements', section: 'OPERATIONS' },
  { path: '/faculty/students', icon: Users, label: 'Students', section: 'MANAGEMENT' },
  { path: '/faculty/chats', icon: MessageSquare, label: 'Chats', section: 'OPERATIONS' },
];

const FacultyLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex">
      {/* Standardized Campo Portal Sidebar */}
      <Sidebar
        items={NAV_ITEMS}
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        user={user}
        onLogout={handleLogout}
        isRouteActive={(path) => location.pathname === path}
        moduleSubtitle="Faculty Portal"
      />

      {/* Main content */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <header className="h-16 bg-[var(--navbar)] border-b border-[var(--border)] flex items-center px-4 lg:px-6">
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--primary)]/5 mr-2"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-[var(--text-secondary)] text-sm">CAMPO Student Portal v2.0 – Faculty</span>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
      />
    </div>
  );
};

export default FacultyLayout;
