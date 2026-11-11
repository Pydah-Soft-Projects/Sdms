import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LogOut,
  LayoutDashboard
} from "lucide-react";
import { ROLE_LABELS } from "../../constants/rbac";

/**
 * Standardized Campo Portal Sidebar Component
 * Follows the enterprise "Campo Design System"
 */
const Sidebar = ({
  items = [],
  isCollapsed = false,
  setIsCollapsed = () => {},
  isOpen = false,
  setIsOpen = () => {},
  user = null,
  onLogout = () => {},
  isRouteActive = () => false,
  expandedItems = new Set(),
  toggleSubmenu = () => {},
  moduleSubtitle = "Student Database",
}) => {
  const location = useLocation();

  // Render navigation item
  const renderNavItem = (item) => {
    const Icon = item.icon || LayoutDashboard;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedItems.has(item.path);
    const isActive = isRouteActive(item.path);

    if (hasSubItems && !isCollapsed) {
      return (
        <div key={item.path} className="space-y-1">
          <button
            type="button"
            onClick={() => toggleSubmenu(item.path)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-left select-none hover:bg-white/5"
            style={{
              backgroundColor:
                isActive && !isExpanded
                  ? "var(--primary)"
                  : isExpanded
                  ? "rgba(255, 255, 255, 0.06)"
                  : "transparent",
              color: "var(--sidebar-text)",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon size={18} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </div>
            {isExpanded ? (
              <ChevronUp
                size={16}
                className="shrink-0"
                style={{ color: "var(--sidebar-muted)" }}
              />
            ) : (
              <ChevronDown
                size={16}
                className="shrink-0"
                style={{ color: "var(--sidebar-muted)" }}
              />
            )}
          </button>

          {isExpanded && (
            <div
              className="pl-5 pr-2 py-1 space-y-1 ml-4 border-l-2 rounded-r-md transition-all duration-200"
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
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-white/5"
                    style={{
                      backgroundColor: isSubActive ? "var(--primary)" : "transparent",
                      color: isSubActive
                        ? "var(--sidebar-text)"
                        : "var(--sidebar-muted)",
                    }}
                  >
                    <SubIcon size={14} className="shrink-0" />
                    <span className="truncate">{subItem.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.subItems?.[0]?.path || item.path}
        onClick={() => {
          if (window.innerWidth < 1024) setIsOpen(false);
        }}
        className={`flex items-center rounded-xl transition-all duration-200 ${
          isCollapsed
            ? "justify-center p-2.5 my-1"
            : "gap-3 px-3 py-2.5 text-sm font-medium"
        } ${!isActive ? "hover:bg-white/5" : ""}`}
        style={{
          backgroundColor: isActive ? "var(--primary)" : "transparent",
          color: "var(--sidebar-text)",
        }}
        title={isCollapsed ? item.label : ""}
      >
        <Icon size={isCollapsed ? 20 : 18} className="shrink-0" />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  // Group items into sections (MAIN, MANAGEMENT, OPERATIONS, ADMINISTRATION)
  let currentSection = null;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] lg:hidden backdrop-blur-sm transition-opacity duration-300"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.6)" }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`
          fixed top-0 left-0 bottom-0 z-40 border-r flex flex-col transition-all duration-300 ease-in-out
          ${isCollapsed ? "w-20" : "w-64"}
          ${
            isOpen
              ? "translate-x-0 shadow-2xl"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
        style={{
          backgroundColor: "var(--sidebar)",
          color: "var(--sidebar-text)",
          borderColor: "var(--border)",
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Floating Circular Collapse Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-3 top-[106px] z-50 w-6 h-6 rounded-full shadow-md border items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
          }}
          aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight
              size={14}
              className="stroke-[2.5]"
              style={{ color: "var(--text-primary)" }}
            />
          ) : (
            <ChevronLeft
              size={14}
              className="stroke-[2.5]"
              style={{ color: "var(--text-primary)" }}
            />
          )}
        </button>

        {/* Top Header */}
        <div
          className="flex flex-col items-center justify-center text-center pt-6 pb-4 border-b shrink-0 px-3 relative"
          style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center justify-center">
              <img
                src="/campo-logos/icon-192.png"
                alt="Campo"
                className="w-8 h-8 rounded-lg object-contain shadow-sm"
              />
              <span
                className="text-[9px] font-bold uppercase tracking-widest mt-1"
                style={{ color: "var(--sidebar-muted)" }}
              >
                SD
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <img
                src="/campo-logos/campo_logo_transparent_hq.png"
                alt="Campo"
                className="h-7 w-auto max-w-[120px] object-contain mx-auto"
              />
              <span
                className="text-xs font-medium tracking-wide mt-1.5 whitespace-nowrap select-none"
                style={{ color: "var(--sidebar-muted)" }}
              >
                {moduleSubtitle}
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Area */}
        <nav
          className={`flex-1 overflow-y-auto overflow-x-hidden ${
            isCollapsed ? "px-2 py-3" : "px-3 py-3"
          } space-y-1`}
          style={{ scrollBehavior: "smooth" }}
        >
          {items.map((item) => {
            const itemSection = item.section || null;
            let sectionHeader = null;

            if (itemSection && itemSection !== currentSection) {
              currentSection = itemSection;
              if (!isCollapsed) {
                sectionHeader = (
                  <div
                    key={`section-${itemSection}`}
                    className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider select-none"
                    style={{ color: "var(--sidebar-muted)" }}
                  >
                    {itemSection}
                  </div>
                );
              } else {
                sectionHeader = (
                  <div
                    key={`section-div-${itemSection}`}
                    className="my-2 border-t mx-2 opacity-30"
                    style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}
                  />
                );
              }
            }

            return (
              <React.Fragment key={item.path}>
                {sectionHeader}
                {renderNavItem(item)}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Bottom User Profile Card (Matches Standard Campo Portal Card - Image 2) */}
        <div className="p-3 shrink-0">
          {isCollapsed ? (
            <div
              className="p-2 rounded-2xl border-0 flex flex-col items-center gap-2.5 transition-all shadow-sm"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.06)",
              }}
            >
              <Link
                to="/profile"
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-transform hover:scale-105 shadow-xs"
                style={{
                  backgroundColor: "var(--surface)",
                  color: "var(--primary)",
                }}
                title={user?.name || user?.username}
              >
                {(user?.name || user?.username || "U")
                  .charAt(0)
                  .toUpperCase()}
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="p-1 rounded-lg opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                style={{ color: "var(--sidebar-text)" }}
                title="Sign Out"
              >
                <LogOut size={16} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div
              className="px-3.5 py-3 rounded-2xl border-0 flex items-center justify-between transition-all shadow-sm"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.06)",
              }}
            >
              <Link
                to="/profile"
                className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90 transition-opacity"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-xs"
                  style={{
                    backgroundColor: "var(--surface)",
                    color: "var(--primary)",
                  }}
                >
                  {(user?.name || user?.username || "U")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p
                    className="text-[13px] font-bold truncate leading-tight m-0"
                    style={{ color: "var(--sidebar-text)" }}
                  >
                    {user?.name || user?.username || "User"}
                  </p>
                  <p
                    className="text-xs truncate leading-tight mt-1 m-0 font-normal"
                    style={{ color: "var(--sidebar-muted)" }}
                  >
                    {user?.role
                      ? ROLE_LABELS[user.role] || user.role.replace(/_/g, " ")
                      : "Superadmin"}
                  </p>
                </div>
              </Link>

              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 ml-1.5 rounded-lg opacity-80 hover:opacity-100 transition-all cursor-pointer shrink-0"
                style={{ color: "var(--sidebar-text)" }}
                title="Sign Out"
              >
                <LogOut size={18} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

