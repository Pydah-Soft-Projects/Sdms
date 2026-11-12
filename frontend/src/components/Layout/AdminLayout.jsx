import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Outlet,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Users,
  LogOut,
  Menu,
  X,
  Settings,
  CalendarCheck,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  DollarSign,

  Megaphone,
  Smartphone,
  Calendar,
  Briefcase,
  ArrowLeftRight,
  Wrench,
  Building2,
  Database,
  UserPlus,
  Clock,
  UserSquare,
  LayoutGrid,
  MessageSquare,
  PieChart,
  Tag,
  Award,
  CreditCard,
  FileCheck,
  UserCheck,
  CheckCircle,
} from "lucide-react";
import useAuthStore from "../../store/authStore";
import LogoutConfirmModal from "../LogoutConfirmModal";
import NotificationIcon from "../Notifications/NotificationIcon";
import Sidebar from "./Sidebar";
import {
  MODULE_ROUTE_MAP,
  getModuleKeyForPath,
  hasModuleAccess,
  getAllowedFrontendModules,
  isFullAccessRole,
  FRONTEND_MODULES,
  FRONTEND_TO_BACKEND_MAP,
  hasPermission,
  ROLE_LABELS,
  USER_ROLES,
} from "../../constants/rbac";
import toast from "react-hot-toast";
import { navigateToCrtApp } from "../../utils/crtAppUrl";
import PydahAiChat from "../PydahAiChat";

const NAV_ITEMS = [
  {
    path: "/",
    icon: LayoutDashboard,
    label: "Dashboard",
    permission: FRONTEND_MODULES.DASHBOARD,
    section: "MAIN",
  },
  {
    path: "/students",
    icon: Users,
    label: "Students",
    permission: FRONTEND_MODULES.STUDENTS,
    section: "MANAGEMENT",
    subItems: [
      {
        path: "/students",
        label: "Students Database",
        icon: Database,
        permission: FRONTEND_MODULES.STUDENTS,
      },
      {
        path: "/students/self-registration",
        label: "Self Registration",
        icon: UserPlus,
        permission: FRONTEND_MODULES.SUBMISSIONS,
      },
      {
        path: "/students/profile-change-requests",
        label: "Profile Requests",
        icon: ClipboardList,
        permission: FRONTEND_MODULES.STUDENTS,
        actions: ['view_profile_requests', 'edit_profile_requests'],
        action: 'view_profile_requests'
      },
      {
        path: "/section-partition",
        label: "Section Management",
        icon: LayoutGrid,
        permission: FRONTEND_MODULES.SECTION_PARTITION,
      },
      {
        path: "/promotions",
        label: "Promotions",
        icon: TrendingUp,
        permission: FRONTEND_MODULES.PROMOTIONS,
      },
      {
        path: "/students/print-id-cards",
        label: "Print ID Cards",
        icon: CreditCard,
        permission: FRONTEND_MODULES.STUDENTS,
        action: 'print_id_cards'
      },
    ],
  },
  {
    path: "/clubs",
    icon: Users,
    label: "Student Clubs",
    permission: FRONTEND_MODULES.CLUBS,
    section: "MANAGEMENT",
    subItems: [
      {
        path: "/clubs",
        label: "Club Management",
        icon: ShieldCheck,
        permission: FRONTEND_MODULES.CLUBS,
        action: 'view'
      },
      {
        path: "/clubs/students",
        label: "Members",
        icon: UserCheck,
        permission: FRONTEND_MODULES.CLUBS,
        action: 'view_students'
      },
      {
        path: "/clubs/settings",
        label: "Club Settings",
        icon: Settings,
        permission: FRONTEND_MODULES.CLUBS,
        action: 'view_settings',
        actions: ['view_settings', 'manage_settings', 'manage_club_admins', 'manage_club_roles']
      }
    ]
  },
  {
    path: "/attendance",
    icon: CalendarCheck,
    label: "Attendance",
    permission: FRONTEND_MODULES.ATTENDANCE,
    section: "OPERATIONS",
    subItems: [
      {
        path: "/attendance",
        label: "Daily Attendance",
        icon: CalendarCheck,
        permission: FRONTEND_MODULES.ATTENDANCE,
        action: 'view'
      },
      // Hourly Attendance hidden as requested
      /* {
        path: "/attendance-monitoring",
        label: "Hourly Attendance",
        icon: Clock,
        permission: FRONTEND_MODULES.ATTENDANCE,
        action: 'view_hourly'
      }, */
      {
        path: "/internship-management",
        label: "Internship Attendance",
        icon: Briefcase,
        permission: FRONTEND_MODULES.ATTENDANCE,
        action: 'view_internship'
      }
    ]
  },
  {
    path: "/reports",
    icon: BarChart3,
    label: "Reports",
    permission: FRONTEND_MODULES.REPORTS,
    section: "OPERATIONS",
    subItems: [
      {
        path: "/reports",
        label: "Registration Reports",
        icon: FileText,
        permission: FRONTEND_MODULES.REPORTS,
        action: 'view_registration'
      },
      {
        path: "/reports/attendance",
        label: "Attendance Reports",
        icon: ClipboardList,
        permission: FRONTEND_MODULES.REPORTS,
        action: 'view_attendance'
      },
      {
        path: "/reports/day-end",
        label: "Day End Report",
        icon: PieChart,
        permission: FRONTEND_MODULES.REPORTS,
        action: 'view_day_end'
      },
      {
        path: "/reports/category",
        label: "Category Report",
        icon: Tag,
        permission: FRONTEND_MODULES.REPORTS,
        action: 'view_category'
      },
      {
        path: "/reports/scholarship",
        label: "Scholarship Report",
        icon: Award,
        permission: FRONTEND_MODULES.REPORTS,
        action: 'view_scholarship'
      },
      {
        path: "/reports/certificates",
        label: "Certificate Reports",
        icon: FileCheck,
        permission: FRONTEND_MODULES.REPORTS,
        action: 'view_certificates'
      },
      {
        path: "/reports/sms",
        label: "SMS Reports",
        icon: MessageSquare,
        permission: FRONTEND_MODULES.REPORTS,
        action: 'view_sms_reports'
      },
      {
        path: "/reports/profile-requests",
        label: "Profile Reports",
        icon: ClipboardList,
        permission: FRONTEND_MODULES.REPORTS,
        action: 'view_profile_requests'
      },
    ],
  },
  {
    path: "/services",
    icon: Briefcase,
    label: "Services",
    permission: FRONTEND_MODULES.SERVICES,
    section: "OPERATIONS",
    subItems: [
      {
        path: "/services/requests",
        label: "Service Requests",
        icon: ClipboardList,
        permission: FRONTEND_MODULES.SERVICES,
      },
      {
        path: "/services/config",
        label: "Configuration",
        icon: Settings,
        permission: FRONTEND_MODULES.SERVICES,
      },
      {
        path: "/services/borrow-management",
        label: "Borrow Management",
        icon: ShieldCheck,
        permission: FRONTEND_MODULES.SERVICES,
        action: 'manage_certificate_borrow'
      },
    ],
  },
  {
    path: "/announcements",
    icon: Megaphone,
    label: "Announcements",
    permission: FRONTEND_MODULES.ANNOUNCEMENTS,
    section: "OPERATIONS",
    subItems: [
      {
        path: "/announcements",
        label: "Announcements",
        icon: Megaphone,
        permission: FRONTEND_MODULES.ANNOUNCEMENTS,
      },
      {
        path: "/announcements?tab=sms",
        label: "SMS",
        icon: Smartphone,
        permission: FRONTEND_MODULES.ANNOUNCEMENTS,
      },
      {
        path: "/calendar",
        label: "Examination Notifications",
        icon: Calendar,
        permission: FRONTEND_MODULES.ANNOUNCEMENTS,
      },
    ],
  },
  {
    path: "/seminar-halls",
    icon: Building2,
    label: "Seminar Hall Requests",
    permission: FRONTEND_MODULES.SEMINAR_HALLS,
    section: "OPERATIONS",
  },
  {
    path: "/users",
    icon: ShieldCheck,
    label: "User Management",
    permission: FRONTEND_MODULES.USERS,
    section: "ADMINISTRATION",
  },
  {
    path: "/courses",
    icon: Settings,
    label: "Settings",
    permission: FRONTEND_MODULES.COURSES,
    section: "ADMINISTRATION",
  },
];

const CLUB_ADMIN_PAGE_BY_PATH = {
  '/clubs': 'management',
  '/clubs/students': 'students',
  '/clubs/settings': 'settings'
};

const CLUB_PERMISSION_BY_PATH = {
  '/clubs': ['view', 'manage'],
  '/clubs/students': ['view_students', 'manage_students'],
  '/clubs/settings': ['view_settings', 'manage_settings', 'manage_club_admins', 'manage_club_roles']
};

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuperAdmin = ['super_admin', 'superadmin'].includes(String(user?.role || '').toLowerCase());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState(() => {
    const initial = new Set();
    NAV_ITEMS.forEach((item) => {
      if (item.subItems) {
        const hasActive = item.subItems.some((subItem) => {
          const [subPath] = subItem.path.split('?');
          return window.location.pathname === subPath;
        });
        if (hasActive) initial.add(item.path);
      }
    });
    return initial;
  });
  const [moreMenuOpen, setMoreMenuOpen] = useState(false); // New: For mobile "More" menu
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  // Get allowed modules based on user role and permissions
  const allowedModules = useMemo(() => {
    if (!user) return [];

    // Super admin and legacy admin have full access to all modules
    if (isFullAccessRole(user.role)) {
      return Object.values(FRONTEND_MODULES);
    }

    // For RBAC users, check permissions using the mapping
    if (user.permissions) {
      return getAllowedFrontendModules(user.permissions);
    }

    // Legacy staff users with modules array
    return Array.isArray(user.modules) ? user.modules : [];
  }, [user]);

  // Filter navigation items based on user's allowed modules
  const filteredNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (!item.permission) return true;

      if (item.permission === FRONTEND_MODULES.CLUBS && user?.clubRoles?.length) return true;

      // Super admin and legacy admin have full access
      if (isFullAccessRole(user?.role)) return true;

      // For RBAC users, check permissions using the mapping
      if (user?.permissions) {
        return hasModuleAccess(user.permissions, item.permission);
      }

      // Legacy staff users
      return allowedModules.includes(item.permission);
    }).map((item) => {
      // Filter sub-items based on permissions
      if (item.subItems) {
        const filteredSubItems = item.subItems.filter((subItem) => {
          if (!subItem.permission) return true;

          if (item.permission === FRONTEND_MODULES.CLUBS && user?.clubRoles?.length) {
            const pageKey = CLUB_ADMIN_PAGE_BY_PATH[subItem.path];
            return user.clubRoles.some(clubRole =>
              !Array.isArray(clubRole.pages) || clubRole.pages.includes(pageKey)
            );
          }

          if (isFullAccessRole(user?.role)) return true;

          if (user?.permissions) {
            // If specific action is required, check that action
            if (subItem.action) {
              const backendModules = FRONTEND_TO_BACKEND_MAP[subItem.permission];
              if (!backendModules || backendModules.length === 0) return false;
              // Check if user has the specific action in ANY of the backend modules mapped to this frontend module
              return backendModules.some(backendModule => (subItem.actions || [subItem.action]).some(action =>
                hasPermission(user.permissions, backendModule, action)
              ));
            }
            return hasModuleAccess(user.permissions, subItem.permission);
          }

          return allowedModules.includes(subItem.permission);
        });

        return { ...item, subItems: filteredSubItems };
      }
      return item;
    });
  }, [allowedModules, user?.role, user?.permissions, user?.clubRoles]);

  // Check if a route is active (including sub-routes)
  const isRouteActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  // Toggle submenu expansion
  const toggleSubmenu = (path) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  // Auto-expand parent menu when navigating to a new route
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname;
      filteredNavItems.forEach((item) => {
        if (item.subItems) {
          const hasActiveSubItem = item.subItems.some((subItem) => {
            const [subPath] = subItem.path.split('?');
            return location.pathname === subPath;
          });
          if (hasActiveSubItem) {
            setExpandedItems((prev) => new Set([...prev, item.path]));
          }
        }
      });
    }
  }, [location.pathname, filteredNavItems]);

  // Close workspace dropdown when sidebar collapses
  useEffect(() => {
    if (sidebarCollapsed) {
    }
  }, [sidebarCollapsed]);

  // Redirect user if they try to access a module they don't have access to
  useEffect(() => {
    if (!user) return;

    // Super admin and legacy admin have full access
    if (isFullAccessRole(user.role)) return;

    const currentModuleKey = getModuleKeyForPath(location.pathname);
    const clubPageKey = CLUB_ADMIN_PAGE_BY_PATH[location.pathname];
    const clubModuleKey = FRONTEND_TO_BACKEND_MAP[FRONTEND_MODULES.CLUBS][0];
    const clubPageActions = CLUB_PERMISSION_BY_PATH[location.pathname];
    const hasGlobalClubPageAccess = clubPageActions?.some(action => hasPermission(user.permissions, clubModuleKey, action));
    const hasClubPageAccess = currentModuleKey === FRONTEND_MODULES.CLUBS && clubPageKey &&
      user.clubRoles?.some(clubRole =>
        !Array.isArray(clubRole.pages) || clubRole.pages.includes(clubPageKey)
      );

    if (hasClubPageAccess || (currentModuleKey === FRONTEND_MODULES.CLUBS && hasGlobalClubPageAccess)) return;

    // Check if user has access to current module
    if (currentModuleKey && !allowedModules.includes(currentModuleKey)) {
      // Redirect to first allowed route or dashboard
      const firstAllowedRoute =
        allowedModules.length > 0 ? MODULE_ROUTE_MAP[allowedModules[0]] : "/";
      navigate(firstAllowedRoute, { replace: true });
    }
  }, [user, allowedModules, location.pathname, navigate]);

  const [searchParams] = useSearchParams();
  const isEmbedded = searchParams.get("embedded") === "true";

  if (isEmbedded) {
    return (
      <div className="min-h-screen bg-surface">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-main relative">
      {/* 1. Standardized Campo Portal Sidebar */}
      <Sidebar
        items={filteredNavItems}
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        user={user}
        onLogout={handleLogout}
        isRouteActive={isRouteActive}
        expandedItems={expandedItems}
        toggleSubmenu={toggleSubmenu}
        moduleSubtitle="Student Database"
      />

      {/* 2. Main Content Area */}
      <main
        className={`flex-1 h-screen overflow-y-auto overflow-x-hidden transition-all duration-200 ease-in-out pb-20 lg:pb-0 ${
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        <div className="p-4 lg:p-8 bg-[var(--background)]/20 min-h-full">
          <Outlet />
        </div>
      </main>

      {Object.values(USER_ROLES).includes(user?.role) && (
        <div className="fixed top-4 right-4 z-[90]">
          <NotificationIcon />
        </div>
      )}

      {/* Pydah AI Floating Assistant - Available across all admin routes for Super Admin */}
      {isSuperAdmin && (
        <PydahAiChat
          mode="widget"
          title="CAMPO SD Admin Assistant"
          assistantId="admin-assistant"
          welcomeMessage="Hi! How can I help you today?"
          position="bottom-right"
        />
      )}

      {/* 3. Mobile Navigation Bar (Docked at Bottom) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)]/80 backdrop-blur-2xl border-t border-border z-[80] pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.08)] rounded-t-[2.5rem] transition-all duration-500">
        <div className="flex items-center justify-around h-20 px-4">
          {filteredNavItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = isRouteActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 transition-all duration-300
                  ${isActive ? "text-[var(--primary)] -translate-y-1" : "text-muted-text"}`}
              >
                <div className={`relative p-2 rounded-2xl transition-all duration-300 ${isActive ? "bg-[var(--primary)]/10 shadow-sm" : "hover:bg-background"}`}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 1.5} />
                  {isActive && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--primary)]"></span>
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-black tracking-tighter uppercase transition-colors ${isActive ? "text-[var(--primary)]" : "text-muted-text"}`}>
                  {item.label === "User Management" ? "Users" : item.label}
                </span>
              </Link>
            );
          })}

          <button
            onClick={() => setMoreMenuOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 transition-all duration-300
              ${moreMenuOpen ? "text-[var(--primary)] -translate-y-1" : "text-muted-text"}`}
          >
            <div className={`p-2 rounded-2xl transition-all duration-300 ${moreMenuOpen ? "bg-[var(--primary)]/10 shadow-sm" : "hover:bg-background"}`}>
              <Menu size={24} strokeWidth={moreMenuOpen ? 2.5 : 1.5} />
            </div>
            <span className={`text-[10px] font-black tracking-tighter uppercase ${moreMenuOpen ? "text-[var(--primary)]" : "text-muted-text"}`}>Menu</span>
          </button>
        </div>
      </div>

      {/* 4. Mobile "More Menu" Drawer */}
      {moreMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMoreMenuOpen(false)}
          />

          {/* Drawer */}
          <div className="relative bg-[var(--surface)]/95 backdrop-blur-2xl rounded-t-[3rem] p-8 shadow-2xl animate-fade-in-up max-h-[85vh] overflow-y-auto pb-safe border-t border-surface">
            <div className="w-12 h-1.5 bg-background rounded-full mx-auto mb-8 opacity-50" />
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-main tracking-tight heading-font">Admin Menu</h3>
                <p className="text-xs text-muted-text font-medium">Quick access to all modules</p>
              </div>
              <button
                onClick={() => setMoreMenuOpen(false)}
                className="p-3 bg-background hover:bg-[var(--danger-light)] hover:text-danger rounded-2xl transition-all active:scale-90"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-10">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isRouteActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMoreMenuOpen(false)}
                    className={`flex flex-col items-center gap-3 p-4 rounded-3xl transition-all duration-300 border
                      ${isActive
                        ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-xl shadow-[var(--primary)]/20 -translate-y-1"
                        : "bg-surface text-sub border-border hover:border-border active:scale-95"}`}
                  >
                    <div className={`p-3 rounded-2xl transition-all ${isActive ? "bg-[var(--surface)]/20 shadow-inner" : "bg-background text-muted-text"}`}>
                      <Icon size={24} strokeWidth={isActive ? 2.5 : 1.5} />
                    </div>
                    <span className="text-[10px] font-black text-center line-clamp-1 leading-tight tracking-tight uppercase px-1">
                      {item.label === "User Management" ? "Users" : item.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="space-y-4 pt-6 border-t border-border">

              <div className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--background)]/80 border border-border shadow-inner">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary flex items-center justify-center text-white font-bold shadow-lg ring-4 ring-white">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-main leading-tight">{user?.name || user?.username}</p>
                  <p className="text-[10px] text-muted-text uppercase tracking-wider font-semibold">
                    {user?.role ? (ROLE_LABELS[user.role] || user.role.replace('_', ' ')) : "ADMIN"}
                  </p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setMoreMenuOpen(false)}
                  className="p-2.5 bg-surface rounded-xl text-muted-text hover:text-sub shadow-sm border border-border"
                >
                  <Settings size={18} />
                </Link>
              </div>

              <button
                onClick={handleLogout}
                className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl bg-[var(--danger-light)] text-danger font-bold border border-[var(--danger-light)] active:bg-[var(--danger-light)] transition-colors shadow-sm"
              >
                <LogOut size={20} strokeWidth={2.5} />
                <span className="tracking-tight">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
      />
    </div>
  );
};


export default AdminLayout;
