const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { verifyRole, verifyPermission, verifyPermissionAny, verifyCanCreateRole, verifyCanManageUser } = require('../middleware/rbac');
const { USER_ROLES, hasPermission } = require('../constants/rbac');
const { masterPool } = require('../config/database');
const rbacUserController = require('../controllers/rbacUserController');
const studentFieldsController = require('../controllers/studentFieldsController');

// All routes require authentication
router.use(authMiddleware);

const verifyCurrentUserManagementPermission = (...actions) => async (req, res, next) => {
  const user = req.user || req.admin;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (['admin', 'super_admin', 'superadmin'].includes(String(user.role || '').trim().toLowerCase())) {
    return next();
  }

  try {
    const [rows] = await masterPool.query(
      'SELECT permissions FROM rbac_users WHERE id = ? LIMIT 1',
      [user.id]
    );
    const permissions = rows[0]?.permissions;

    if (actions.some(action => hasPermission(permissions, 'user_management', action))) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Requires user_management/${actions.join(' or ')} permission`
    });
  } catch (error) {
    console.error('Failed to verify current user management permissions:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify user management permission' });
  }
};

// Get available student fields (for field-level permissions)
router.get('/student-fields', studentFieldsController.getStudentFields);

// Get available roles and modules (for user creation form)
router.get('/roles/available', rbacUserController.getAvailableRoles);
router.get('/modules', rbacUserController.getModules);

// Get all users (filtered by scope)
// Requires current user_management view or control permission
router.get(
  '/',
  verifyCurrentUserManagementPermission('view', 'control'),
  rbacUserController.getUsers
);

// Search HRMS Employees (for pre-mapping users and club admin assignment)
// Requires user_management control permission or club management privileges
router.get(
  '/search-hrms-employee',
  verifyPermissionAny([
    ['user_management', 'control'],
    ['clubs', 'manage_club_admins'],
    ['clubs', 'manage_settings'],
    ['clubs', 'manage']
  ]),
  rbacUserController.searchHRMSEmployee
);

// Get single user
router.get(
  '/:id',
  verifyPermission('user_management', 'view'),
  rbacUserController.getUser
);

// Create user
// Requires user_management write permission and role creation check
router.post(
  '/',
  verifyCurrentUserManagementPermission('control'),
  verifyCanCreateRole,
  rbacUserController.createUser
);

// Update user
// Requires user_management write permission and management check
router.put(
  '/:id',
  verifyPermission('user_management', 'control'),
  verifyCanManageUser,
  rbacUserController.updateUser
);

// Delete user (soft delete)
// Requires user_management write permission and management check
router.delete(
  '/:id',
  verifyPermission('user_management', 'control'),
  verifyCanManageUser,
  rbacUserController.deleteUser
);

// Permanently delete user
// Requires user_management write permission and super admin role
router.delete(
  '/:id/permanent',
  verifyPermission('user_management', 'control'),
  verifyCanManageUser,
  rbacUserController.permanentDeleteUser
);

// Reset user password and send email
// Requires user_management write permission
router.post(
  '/:id/reset-password',
  verifyPermission('user_management', 'control'),
  verifyCanManageUser,
  rbacUserController.resetPassword
);

module.exports = router;

