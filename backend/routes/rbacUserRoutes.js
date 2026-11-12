const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { verifyPermission, verifyCanCreateRole, verifyCanManageUser } = require('../middleware/rbac');
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

const verifyClubAdminUserCreationAccess = (...permissionPairs) => async (req, res, next) => {
  const user = req.user || req.admin;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (['admin', 'super_admin', 'superadmin'].includes(String(user.role || '').trim().toLowerCase())) {
    return next();
  }

  try {
    const [userRows] = await masterPool.query(
      'SELECT username, email, hrms_id, permissions FROM rbac_users WHERE id = ? LIMIT 1',
      [user.id]
    );
    const userData = userRows[0] || {};
    const hasRequestedPermission = permissionPairs.some(([module, action]) =>
      hasPermission(userData.permissions, module, action)
    );
    req.userManagementControl = hasPermission(userData.permissions, 'user_management', 'control');

    const identityKeys = new Set([
      user.id && `id_${String(user.id).trim().toLowerCase()}`,
      (userData.email || user.email) && `email_${String(userData.email || user.email).trim().toLowerCase()}`,
      (userData.username || user.username) && `username_${String(userData.username || user.username).trim().toLowerCase()}`,
      (userData.hrms_id || user.hrms_id) && `hrms_${String(userData.hrms_id || user.hrms_id).trim().toLowerCase()}`
    ].filter(Boolean));
    const [clubs] = await masterPool.query(`
      SELECT clubs.id, clubs.admin_roles, club_roles.role_code
      FROM clubs
      INNER JOIN club_roles ON club_roles.can_create_users = TRUE
      WHERE clubs.is_active = TRUE
    `);

    for (const club of clubs || []) {
      let assignments;
      try {
        assignments = typeof club.admin_roles === 'string'
          ? JSON.parse(club.admin_roles)
          : (club.admin_roles || []);
      } catch (error) {
        console.error(`Invalid admin_roles data for club ${club.id}:`, error);
        continue;
      }

      const hasMatchingAssignment = (Array.isArray(assignments) ? assignments : []).some(assignment => {
        if (!assignment || String(assignment.roleCode || '').trim().toLowerCase() !==
          String(club.role_code || '').trim().toLowerCase()) {
          return false;
        }

        const assignmentKeys = [
          assignment.userId && `id_${String(assignment.userId).trim().toLowerCase()}`,
          assignment.email && `email_${String(assignment.email).trim().toLowerCase()}`,
          assignment.empNo && `username_${String(assignment.empNo).trim().toLowerCase()}`,
          assignment.hrmsId && `hrms_${String(assignment.hrmsId).trim().toLowerCase()}`
        ].filter(Boolean);
        return assignmentKeys.some(key => identityKeys.has(key));
      });

      if (hasMatchingAssignment) {
        req.clubRoleUserCreationAccess = true;
        break;
      }
    }

    if (hasRequestedPermission || req.clubRoleUserCreationAccess) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'User creation requires user management permission or an enabled club role'
    });
  } catch (error) {
    console.error('Failed to verify club admin user creation access:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify user creation access' });
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
// Requires user management control, club management privileges, or an enabled club role
router.get(
  '/search-hrms-employee',
  verifyClubAdminUserCreationAccess(
    ['user_management', 'control'],
    ['clubs', 'manage_club_admins'],
    ['clubs', 'manage_settings'],
    ['clubs', 'manage']
  ),
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

router.post(
  '/from-club-admin',
  verifyClubAdminUserCreationAccess(['user_management', 'control']),
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

