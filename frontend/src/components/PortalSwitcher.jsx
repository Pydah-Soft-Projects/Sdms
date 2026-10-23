import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { CRM_BACKEND_URL, CRM_FRONTEND_URL } from '../config/api';

const SCRIPT_ID = 'pydah-portal-switcher-cdn';
const PORTAL_ID = 'student-portal';
const CDN_URL = 'https://crm.pydah.edu.in/portal-switcher.js';

const isStudentUser = (user, type) => {
  const role = user?.role;
  return (
    type === 'student' ||
    role === 'student' ||
    Boolean(user?.admission_number && role !== 'staff' && role !== 'admin' && role !== 'faculty')
  );
};

const isParentUser = (user, type) => {
  return type === 'parent' || user?.role === 'parent';
};

/**
 * Pydah Universal Portal Switcher Widget.
 *
 * Requirements:
 * 1. Strictly rendered ONLY for SSO authenticated staff / admin users.
 * 2. Never displayed for students or parents (dashboard, subpages, or student accounts).
 * 3. If logged in via standard credentials, or for student/parent accounts, the script
 *    and widget DOM elements are completely removed / hidden.
 * 4. Style-isolated Shadow DOM web component provided via Pydah CDN.
 */
export default function PortalSwitcher() {
  const location = useLocation();
  const { isAuthenticated, isSSO, user, token, userType } = useAuthStore();

  const [ssoActive, setSsoActive] = useState(() => {
    const storeState = useAuthStore.getState();
    const currentUser = storeState.user;
    const currentUserType = storeState.userType || localStorage.getItem('userType');
    if (isStudentUser(currentUser, currentUserType) || isParentUser(currentUser, currentUserType)) {
      return false;
    }
    const isStoredSSO = localStorage.getItem('isSSO') === 'true';
    return Boolean((isAuthenticated || localStorage.getItem('token')) && (isSSO || isStoredSSO || currentUser?.isSSO));
  });

  // Keep SSO state in sync with local storage, store updates, and auth events
  useEffect(() => {
    const checkSSO = () => {
      const storeState = useAuthStore.getState();
      const currentToken = storeState.token || localStorage.getItem('token');
      const currentUser = storeState.user;
      const currentUserType = storeState.userType || localStorage.getItem('userType');

      if (isStudentUser(currentUser, currentUserType) || isParentUser(currentUser, currentUserType)) {
        setSsoActive(false);
        return;
      }

      const isStoredSSO = localStorage.getItem('isSSO') === 'true';
      const isAuthed = Boolean(storeState.isAuthenticated || currentToken);
      const isSSOUser = isAuthed && Boolean(storeState.isSSO || isStoredSSO || currentUser?.isSSO);
      setSsoActive(isSSOUser);
    };

    checkSSO();

    window.addEventListener('auth-change', checkSSO);
    window.addEventListener('storage', checkSSO);

    return () => {
      window.removeEventListener('auth-change', checkSSO);
      window.removeEventListener('storage', checkSSO);
    };
  }, [location.pathname, isAuthenticated, isSSO, user, token, userType]);

  useEffect(() => {
    const isStudentRoute = location.pathname.startsWith('/student');
    const isParentRoute = location.pathname.startsWith('/parent');
    const isPublicRoute =
      ['/login', '/student/login', '/parent/login', '/auth-callback'].includes(location.pathname) ||
      location.pathname.startsWith('/qr/') ||
      location.pathname.startsWith('/form/');

    const currentUser = user || (() => {
      try {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
      } catch {
        return null;
      }
    })();
    const currentUserType = userType || localStorage.getItem('userType');

    const isStudent = isStudentRoute || isStudentUser(currentUser, currentUserType);
    const isParent = isParentRoute || isParentUser(currentUser, currentUserType);

    // Strictly DO NOT show portal switcher for student or parent dashboards / sessions
    const shouldShow = Boolean(ssoActive && !isPublicRoute && !isStudent && !isParent);

    const cleanupSwitcher = () => {
      const switcher = window.PydahSwitcher || window.PydahPortalSwitcher;
      if (switcher?.close) {
        try {
          switcher.close();
        } catch (_) {}
      }

      // Hide and remove any custom web component elements created by the switcher
      const customElements = document.querySelectorAll(
        'pydah-portal-switcher, portal-switcher, [data-pydah-switcher], #pydah-portal-switcher, .pydah-switcher-host, pydah-sso-loader'
      );
      customElements.forEach((el) => {
        el.style.display = 'none';
        try {
          el.remove();
        } catch (_) {}
      });

      // Always remove the script tag when switcher should not show
      const existingScript = document.getElementById(SCRIPT_ID);
      if (existingScript) {
        try {
          existingScript.remove();
        } catch (_) {}
      }
    };

    if (!shouldShow) {
      cleanupSwitcher();

      // Guard: Watch for any late-injected switcher elements (e.g. if CDN script auto-mounts) and immediately remove them
      const observer = new MutationObserver(() => {
        const customElements = document.querySelectorAll(
          'pydah-portal-switcher, portal-switcher, [data-pydah-switcher], #pydah-portal-switcher, .pydah-switcher-host, pydah-sso-loader'
        );
        if (customElements.length > 0) {
          cleanupSwitcher();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      return () => {
        observer.disconnect();
      };
    }

    // SSO staff user on an authenticated route -> mount & initialize widget
    const customElements = document.querySelectorAll(
      'pydah-portal-switcher, portal-switcher, [data-pydah-switcher], #pydah-portal-switcher, .pydah-switcher-host'
    );
    customElements.forEach((el) => {
      el.style.display = '';
    });

    const currentToken = token || localStorage.getItem('token') || localStorage.getItem('accessToken');

    const existingScript = document.getElementById(SCRIPT_ID);
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = CDN_URL;
      script.async = true;
      script.setAttribute('data-current-portal', PORTAL_ID);
      script.setAttribute('data-api-base-url', CRM_BACKEND_URL);
      script.setAttribute('data-landing-url', CRM_FRONTEND_URL);
      script.setAttribute('data-position', 'bottom-right');

      script.onload = () => {
        if (window.PydahSwitcher) {
          try {
            if (typeof window.PydahSwitcher.init === 'function') {
              window.PydahSwitcher.init({
                currentPortal: PORTAL_ID,
                token: currentToken,
                user: currentUser,
                position: 'bottom-right',
                apiBaseUrl: CRM_BACKEND_URL,
                landingUrl: CRM_FRONTEND_URL,
              });
            }
          } catch (e) {
            console.warn('[PortalSwitcher] init error:', e);
          }
        }
      };

      document.body.appendChild(script);
    } else {
      // Script already present; refresh session or re-init
      if (window.PydahSwitcher) {
        try {
          if (typeof window.PydahSwitcher.setSession === 'function') {
            window.PydahSwitcher.setSession({
              token: currentToken,
              user: currentUser,
            });
          } else if (typeof window.PydahSwitcher.init === 'function') {
            window.PydahSwitcher.init({
              currentPortal: PORTAL_ID,
              token: currentToken,
              user: currentUser,
              position: 'bottom-right',
              apiBaseUrl: CRM_BACKEND_URL,
              landingUrl: CRM_FRONTEND_URL,
            });
          }
        } catch (e) {
          console.warn('[PortalSwitcher] session update error:', e);
        }
      }
    }

    return () => {
      if (!shouldShow) {
        cleanupSwitcher();
      }
    };
  }, [ssoActive, location.pathname, token, user, userType]);

  return null;
}
