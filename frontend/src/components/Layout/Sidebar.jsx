import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { ROLE_LABELS } from "../../constants/rbac";

/**
 * Standardized Campo Portal Sidebar Component
 * Follows exact specifications:
 * - 256px expanded / 80px collapsed width
 * - 1px right border & 4px 0 24px -2px rgba(10, 20, 35, 0.45) shadow
 * - 200ms smooth expand/collapse animation
 * - Strict theme CSS variables: var(--sidebar, #1E3150), var(--sidebar-text, #FFFFFF),
 *   var(--sidebar-muted, #AABBD4), var(--border), var(--surface, #FFFFFF), var(--primary)
 * - Plus Jakarta Sans font
 * - Floating collapse control at top-[106px], -right-[12px], 24x24px
 * - User profile card: 64px height, 16px radius, 40x40px avatar, no harsh borders
 */
const Sidebar = ({
  items = [],
  isCollapsed = false,
  setIsCollapsed = () => { },
  isOpen = false,
  setIsOpen = () => { },
  user = null,
  onLogout = () => { },
  isRouteActive = () => false,
  expandedItems = new Set(),
  toggleSubmenu = () => { },
  moduleSubtitle = "Student Database",
}) => {
  const location = useLocation();

  // Group items into sections preserving order and filtering empty sections
  const sections = React.useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const sectionName = item.section || "MAIN";
      if (!map.has(sectionName)) {
        map.set(sectionName, []);
      }
      map.get(sectionName).push(item);
    });

    return Array.from(map.entries()).map(([section, sectionItems]) => ({
      section,
      items: sectionItems,
    }));
  }, [items]);

  // Formatted user role
  const userRole = user?.role
    ? ROLE_LABELS[user.role] || user.role.replace(/_/g, " ")
    : "Superadmin";

  // User initial
  const userInitial = (user?.name || user?.username || "U")
    .charAt(0)
    .toUpperCase();

  // Render individual navigation item
  const renderNavItem = (item) => {
    const Icon = item.icon || LayoutDashboard;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedItems.has(item.path);
    const isActive = isRouteActive(item.path);

    // Collapsed mode: icon only with tooltip
    if (isCollapsed) {
      return (
        <Link
          key={item.path}
          to={item.subItems?.[0]?.path || item.path}
          onClick={() => {
            if (window.innerWidth < 1024) setIsOpen(false);
          }}
          className="w-full flex items-center justify-center py-[10px] rounded-[12px] transition-colors relative group"
          style={{
            backgroundColor: isActive ? "var(--primary)" : "transparent",
            color: "var(--sidebar-text, #FFFFFF)",
            boxShadow: isActive ? "0 2px 8px -1px rgba(0, 0, 0, 0.2)" : "none",
          }}
          title={item.label}
          aria-label={item.label}
        >
          <Icon size={20} strokeWidth={2} className="shrink-0" />
        </Link>
      );
    }

    // Expanded mode: with sub-items
    if (hasSubItems) {
      return (
        <div key={item.path} className="space-y-[4px]">
          <button
            type="button"
            onClick={() => toggleSubmenu(item.path)}
            className="w-full flex items-center justify-between px-[14px] py-[10px] rounded-[12px] text-[13px] transition-all duration-200 cursor-pointer text-left select-none hover:bg-white/[0.06]"
            style={{
              backgroundColor:
                isActive && !isExpanded
                  ? "var(--primary)"
                  : isExpanded
                    ? "rgba(255, 255, 255, 0.06)"
                    : "transparent",
              color: "var(--sidebar-text, #FFFFFF)",
              fontWeight: isActive ? 600 : 500,
              boxShadow:
                isActive && !isExpanded
                  ? "0 2px 8px -1px rgba(0, 0, 0, 0.2)"
                  : "none",
            }}
          >
            <div className="flex items-center gap-[14px] min-w-0">
              <Icon size={18} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </div>
            {isExpanded ? (
              <ChevronUp
                size={16}
                strokeWidth={2}
                className="shrink-0 transition-transform duration-200"
                style={{ color: "var(--sidebar-muted, #AABBD4)" }}
              />
            ) : (
              <ChevronDown
                size={16}
                strokeWidth={2}
                className="shrink-0 transition-transform duration-200"
                style={{ color: "var(--sidebar-muted, #AABBD4)" }}
              />
            )}
          </button>

          {isExpanded && (
            <div
              className="pl-[20px] pr-[8px] py-[4px] space-y-[4px] ml-[14px] border-l-2 rounded-r-md transition-all duration-200"
              style={{ borderColor: "var(--primary)" }}
            >
              {item.subItems.map((subItem) => {
                const currentFullPath = location.pathname + location.search;
                let isSubActive = false;
                if (subItem.path.includes("?")) {
                  isSubActive = currentFullPath === subItem.path;
                } else if (subItem.path === "/announcements") {
                  isSubActive =
                    location.pathname === "/announcements" &&
                    (!location.search || location.search === "?tab=announcements");
                } else {
                  const [subPath] = subItem.path.split("?");
                  isSubActive = location.pathname === subPath;
                }

                const SubIcon = subItem.icon || LayoutDashboard;
                return (
                  <Link
                    key={subItem.path}
                    to={subItem.path}
                    onClick={() => {
                      if (window.innerWidth < 1024) setIsOpen(false);
                    }}
                    className="flex items-center gap-[10px] px-[12px] py-[8px] rounded-[8px] text-[12px] transition-colors hover:bg-white/[0.06]"
                    style={{
                      backgroundColor: isSubActive ? "var(--primary)" : "transparent",
                      color: isSubActive
                        ? "var(--sidebar-text, #FFFFFF)"
                        : "var(--sidebar-muted, #AABBD4)",
                      fontWeight: isSubActive ? 600 : 500,
                      boxShadow: isSubActive
                        ? "0 2px 6px -1px rgba(0, 0, 0, 0.2)"
                        : "none",
                    }}
                  >
                    <SubIcon size={14} strokeWidth={2} className="shrink-0" />
                    <span className="truncate">{subItem.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Expanded mode: standard item without sub-items
    return (
      <Link
        key={item.path}
        to={item.subItems?.[0]?.path || item.path}
        onClick={() => {
          if (window.innerWidth < 1024) setIsOpen(false);
        }}
        className={`w-full flex items-center gap-[14px] px-[14px] py-[10px] rounded-[12px] text-[13px] transition-all duration-200 ${!isActive ? "hover:bg-white/[0.06]" : ""
          }`}
        style={{
          backgroundColor: isActive ? "var(--primary)" : "transparent",
          color: "var(--sidebar-text, #FFFFFF)",
          fontWeight: isActive ? 600 : 500,
          boxShadow: isActive ? "0 2px 8px -1px rgba(0, 0, 0, 0.2)" : "none",
        }}
      >
        <Icon size={18} strokeWidth={2} className="shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] lg:hidden backdrop-blur-sm transition-opacity duration-200"
          style={{ backgroundColor: "rgba(10, 20, 35, 0.6)" }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`
          fixed top-0 left-0 bottom-0 z-40 border-r flex flex-col transition-all duration-200 ease-in-out
          ${isCollapsed ? "w-[80px]" : "w-[256px]"}
          ${isOpen
            ? "translate-x-0 shadow-2xl"
            : "-translate-x-full lg:translate-x-0"
          }
        `}
        style={{
          backgroundColor: "var(--sidebar, #1E3150)",
          color: "var(--sidebar-text, #FFFFFF)",
          borderColor: "var(--border)",
          boxShadow: "4px 0 24px -2px rgba(10, 20, 35, 0.45)",
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Floating Circular Collapse Control */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-[12px] top-[106px] z-50 w-[24px] h-[24px] rounded-full shadow-md border items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95"
          style={{
            backgroundColor: "var(--surface, #FFFFFF)",
            borderColor: "var(--border)",
          }}
          aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight
              size={14}
              strokeWidth={2.5}
              style={{ color: "var(--text-primary, #0F172A)" }}
            />
          ) : (
            <ChevronLeft
              size={14}
              strokeWidth={2.5}
              style={{ color: "var(--text-primary, #0F172A)" }}
            />
          )}
        </button>

        {/* Brand Header */}
        <div
          className={`flex flex-col items-center justify-center text-center pt-[24px] pb-[16px] border-b shrink-0 relative ${isCollapsed ? "px-[8px]" : "px-[24px]"
            }`}
          style={{ borderColor: "var(--border)" }}
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center justify-center">
              <img
                src="/campo-logos/icon-192.png"
                alt="Campo"
                className="w-[36px] h-[36px] rounded-lg object-contain shadow-sm"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full">
              <img
                src="/campo-logos/campo_logo_transparent_hq.png"
                alt="Campo"
                className="h-[28px] w-auto max-w-[120px] object-contain mx-auto"
              />
              <span
                className="text-[12px] font-medium tracking-wide mt-[8px] whitespace-nowrap select-none"
                style={{ color: "var(--sidebar-muted, #AABBD4)" }}
              >
                {moduleSubtitle}
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Area */}
        <nav
          className={`flex-1 overflow-y-auto overflow-x-hidden pt-[12px] pb-[16px] px-[14px]`}
          style={{ scrollBehavior: "smooth" }}
        >
          {sections.map(({ section, items: sectionItems }, sectionIndex) => (
            <div
              key={section}
              className={sectionIndex > 0 ? "mt-[24px]" : "mt-0"}
            >
              {/* Section Heading */}
              {!isCollapsed ? (
                <div
                  className="px-[14px] pt-[4px] pb-[8px] mb-[4px] text-[11px] font-bold uppercase tracking-[0.06em] select-none"
                  style={{ color: "var(--sidebar-muted, #AABBD4)" }}
                >
                  {section}
                </div>
              ) : (
                sectionIndex > 0 && (
                  <div
                    className="my-[12px] border-t mx-2 opacity-30"
                    style={{ borderColor: "var(--border)" }}
                  />
                )
              )}

              {/* Section Items */}
              <div className="space-y-[4px]">
                {sectionItems.map((item) => renderNavItem(item))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom User Profile Card */}
        <div className="p-[14px] shrink-0">
          {isCollapsed ? (
            /* Collapsed Profile View */
            <div
              className="p-[6px] rounded-[16px] border-0 flex items-center justify-center transition-all shadow-sm"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.06)",
              }}
              title={`${user?.name || user?.username || "User"} (${userRole})`}
            >
              <Link
                to="/profile"
                className="w-[40px] h-[40px] rounded-full flex items-center justify-center font-bold text-[14px] shrink-0 transition-transform hover:scale-105 shadow-xs"
                style={{
                  backgroundColor: "var(--surface, #FFFFFF)",
                  color: "var(--primary)",
                }}
                aria-label={user?.name || user?.username || "User"}
              >
                {userInitial}
              </Link>
            </div>
          ) : (
            /* Expanded Profile View */
            <div
              className="h-[64px] px-[14px] rounded-[16px] border-0 flex items-center justify-between transition-all shadow-sm"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.06)",
              }}
            >
              <Link
                to="/profile"
                className="flex items-center gap-[12px] min-w-0 flex-1 hover:opacity-90 transition-opacity"
              >
                {/* 40x40px Circular Avatar */}
                <div
                  className="w-[40px] h-[40px] rounded-full flex items-center justify-center font-bold text-[14px] shrink-0 shadow-xs"
                  style={{
                    backgroundColor: "var(--surface, #FFFFFF)",
                    color: "var(--primary)",
                  }}
                >
                  {userInitial}
                </div>

                {/* User Details */}
                <div className="flex-1 min-w-0 text-left">
                  <p
                    className="text-[13px] font-bold truncate leading-tight m-0"
                    style={{ color: "var(--sidebar-text, #FFFFFF)" }}
                  >
                    {user?.name || user?.username || "User"}
                  </p>
                  <p
                    className="text-[11px] font-normal truncate leading-tight mt-[3px] m-0"
                    style={{ color: "var(--sidebar-muted, #AABBD4)" }}
                  >
                    {userRole}
                  </p>
                </div>
              </Link>

              {/* 16x16px LogOut Icon Button */}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 ml-[8px] rounded-lg opacity-80 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                  style={{ color: "var(--sidebar-text, #FFFFFF)" }}
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut size={16} strokeWidth={2} />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
