import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layouts
import AdminLayout from './components/Layout/AdminLayout';
import StudentLayout from './components/Layout/StudentLayout';

// Pages
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import TicketConfiguration from './pages/admin/TicketConfiguration';
import EmployeeManagement from './pages/admin/EmployeeManagement';
import TaskManagement from './pages/admin/TaskManagement';
import SubAdminCreation from './pages/admin/SubAdminCreation';
import RoleManagement from './pages/admin/RoleManagement';

// Student Pages
import Dashboard from './pages/student/Dashboard';
import RaiseTicket from './pages/student/RaiseTicket';
import MyTickets from './pages/student/MyTickets';
import { isHrmsOnlyTicketUser } from './utils/hrmsPortal';

// Store & Components
import useAuthStore from './store/authStore';
import LoadingAnimation from './components/LoadingAnimation';

// RBAC
import { FRONTEND_MODULES } from './constants/rbac';

const ProtectedRoute = ({ children, allowedRoles, requiredPermission }) => {
  const { isAuthenticated, user, userType, hasPermission, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <LoadingAnimation message="Verifying access..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles) {
    const isRequesterRoute = allowedRoles.includes('student') || allowedRoles.includes('requester');
    const isAdminRoute = allowedRoles.includes('admin');
    const isSuperAdminOrAdmin = user?.role === 'super_admin' || user?.role === 'admin';

    if (isRequesterRoute && !['student', 'requester'].includes(userType) && !isSuperAdminOrAdmin) {
      return <Navigate to={user?.role === 'worker' || user?.is_worker ? '/task-management' : '/dashboard'} replace />;
    }

    if (isAdminRoute && userType !== 'admin' && !isSuperAdminOrAdmin) {
      return <Navigate to="/student/dashboard" replace />;
    }
  }

  // Optional: Check granular permissions if provided
  if (requiredPermission && hasPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

const StudentDefaultRedirect = () => {
  return <Navigate to="dashboard" replace />;
};

const DashboardRoute = () => {
  const { user } = useAuthStore();
  if (user?.role === 'worker' || user?.is_worker) {
    return <Navigate to="/task-management" replace />;
  }
  return <AdminDashboard />;
};

const AdminOnlyRoute = ({ children }) => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  if (!isAdmin) {
    return <Navigate to="/task-management" replace />;
  }
  return children;
};

const App = () => {
  const { isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <LoadingAnimation message="Initializing Application..." size="lg" />
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />

      <Routes>
        {/* Auth callback for portal-to-app workspace integration (if needed later) */}
        <Route path="/auth-callback" element={<AuthCallback />} />

        {/* Local Login for direct access */}
        <Route path="/login" element={<Login />} />

        {/* Redirect /student/login to main login to keep it unified */}
        <Route path="/student/login" element={<Login isStudent={true} />} />

        {/* Admin/Manager/Worker Routes */}
        <Route element={<Navigate to="/login" replace />} path="/" />

        {/* Admin Layout Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardRoute />} />
          <Route path="configuration" element={<TicketConfiguration />} />
          <Route path="employees" element={<EmployeeManagement />} />
          <Route path="task-management" element={<TaskManagement />} />
          <Route path="sub-admins" element={<AdminOnlyRoute><SubAdminCreation /></AdminOnlyRoute>} />
          <Route path="roles" element={<AdminOnlyRoute><RoleManagement /></AdminOnlyRoute>} />
          <Route path="tickets" element={<Navigate to="/task-management" replace />} />
          <Route path="unauthorized" element={
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800">
              <h1 className="text-4xl font-bold mb-4">403</h1>
              <h2 className="text-2xl font-semibold mb-2">Unauthorized Access</h2>
              <p className="mb-6 text-gray-500">You do not have permission to view this page.</p>
              <button
                onClick={() => window.location.href = '/login'}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Return to Login
              </button>
            </div>
          } />
        </Route>

        {/* Student / Requester Routes */}
        <Route
          path="/student/*"
          element={
            <ProtectedRoute allowedRoles={['student', 'requester']}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="raise-ticket" element={<RaiseTicket />} />
          <Route path="my-tickets" element={<MyTickets />} />
          {/* Default redirect for /student root */}
          <Route path="*" element={<StudentDefaultRedirect />} />
        </Route>

      </Routes>
    </>
  );
};

export default App;
