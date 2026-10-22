import { create } from 'zustand';
import api from '../config/api';
import { queryClient } from '../config/queryClient';
import {
    MODULE_ROUTE_MAP,
    getModuleKeyForPath,
    getAllowedFrontendModules,
    isFullAccessRole,
    FRONTEND_MODULES
} from '../constants/rbac';

// Re-export for backward compatibility
export { MODULE_ROUTE_MAP, getModuleKeyForPath };

export const resolveUserType = (user) => {
    if (!user) return null;
    // CRITICAL: Super Admin and Admin are ALWAYS admin, even if an HRMS ID is linked!
    if (user.role === 'super_admin' || user.role === 'admin') return 'admin';
    if (user.role === 'student') return 'student';
    // HRMS users without explicit ticket management access are always requesters
    if (user.is_hrms_session || user.hrmsId || user.is_hrms_user) {
        if (user.ticketAccess !== 'manage') return 'requester';
    }
    if (user.ticketAccess === 'request') return 'requester';
    return 'admin';
};

const resolveDefaultRoute = (user, userType = null) => {
    if (!user) return '/login';

    // Super Admin and Admin ALWAYS route to Admin Dashboard
    if (user.role === 'super_admin' || user.role === 'admin') {
        return '/dashboard';
    }

    const type = userType || resolveUserType(user);

    if (type === 'student' || type === 'requester') {
        return '/student/dashboard';
    }

    if (user?.role === 'worker' || user?.is_worker) {
        return '/task-management';
    }

    return '/dashboard';
};

const useAuthStore = create((set) => {
    // Initialize from localStorage
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const resolvedUserType = parsedUser ? resolveUserType(parsedUser) : (localStorage.getItem('userType') || null);
    if (parsedUser && resolvedUserType) {
        localStorage.setItem('userType', resolvedUserType);
    }

    return {
        user: parsedUser,
        token: storedToken || null,
        isAuthenticated: !!storedToken,
        userType: resolvedUserType,

        hasPermission: (module, action = 'read') => {
            const user = useAuthStore.getState().user;
            if (!user) return false;
            if (user.role === 'super_admin' || user.role === 'admin') return true;
            const permissions = user.permissions;
            if (!permissions || typeof permissions !== 'object') return false;
            const modPerm = permissions[module];
            if (!modPerm) return false;
            if (typeof modPerm === 'boolean') return modPerm;
            if (typeof modPerm === 'object') {
                if (action && modPerm[action] !== undefined) return modPerm[action] === true;
                return Object.values(modPerm).some(v => v === true);
            }
            return false;
        },

        login: async (username, password) => {
            try {
                const response = await api.post('/auth/unified-login', { username, password });

                if (!response.data.success) {
                    return {
                        success: false,
                        message: response.data.message || 'Login failed'
                    };
                }

                const { token, user } = response.data;

                if (!token || !user) {
                    return {
                        success: false,
                        message: 'Invalid response from server'
                    };
                }

                const userType = resolveUserType(user);

                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('userType', userType);
                localStorage.removeItem('admin');

                set({ user, token, isAuthenticated: true, userType });
                return { success: true, redirectPath: resolveDefaultRoute(user, userType) };
            } catch (error) {
                console.error('Login error:', error);
                const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
                return {
                    success: false,
                    message: errorMessage
                };
            }
        },

        loginAsStudent: async (username, password) => {
            return useAuthStore.getState().login(username, password);
        },

        setAuth: (user, token, userType = 'student') => {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('userType', userType);
            set({ user, token, isAuthenticated: true, userType });
        },

        updateUser: (userData) => set((state) => ({
            user: { ...state.user, ...userData }
        })),

        logout: () => {
            queryClient.clear();

            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('userType');
            localStorage.removeItem('admin');

            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('react-query') || key.startsWith('cache') || key.startsWith('app-'))) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
            } catch (error) {
                console.warn('Error during localStorage cleanup:', error);
            }

            set({ user: null, token: null, isAuthenticated: false, userType: null });
        },

        verifyToken: async () => {
            try {
                const response = await api.get('/auth/verify');
                const { user } = response.data || {};
                if (user) {
                    localStorage.setItem('user', JSON.stringify(user));
                    localStorage.removeItem('admin');
                    const type = resolveUserType(user);

                    set({ user, isAuthenticated: true, userType: type });
                    return true;
                }
                throw new Error('Invalid response');
            } catch (error) {
                set({ user: null, token: null, isAuthenticated: false, userType: null });
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('userType');
                return false;
            }
        }
    }
});

export default useAuthStore;
