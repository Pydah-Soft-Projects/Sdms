const express = require('express');
const router = express.Router();
const profileChangeController = require('../controllers/profileChangeController');
const authMiddleware = require('../middleware/auth');
const { verifyPermission, attachUserScope } = require('../middleware/rbac');
const { hasPermission, MODULES } = require('../constants/rbac');

const requireStudent = (req, res, next) => {
    if (req.user && req.user.role === 'student') {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'Student access required'
    });
};

// Check if user is Super Admin or has explicit view permission in User Management
const canViewProfileRequests = (req, res, next) => {
    const user = req.user || req.admin;
    if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const role = (user.role || '').toLowerCase();
    if (
        role === 'super_admin' ||
        role === 'admin' ||
        hasPermission(user.permissions, MODULES.STUDENT_MANAGEMENT, 'view_profile_requests') ||
        hasPermission(user.permissions, MODULES.STUDENT_MANAGEMENT, 'edit_profile_requests')
    ) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view profile requests'
    });
};

// Check if user is Super Admin or has explicit edit/manage permission in User Management
const canManageProfileRequests = (req, res, next) => {
    const user = req.user || req.admin;
    if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const role = (user.role || '').toLowerCase();
    if (
        role === 'super_admin' ||
        role === 'admin' ||
        hasPermission(user.permissions, MODULES.STUDENT_MANAGEMENT, 'edit_profile_requests')
    ) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have write/approval permissions for profile requests'
    });
};

// Student Routes — own profile only (identity from JWT)
router.post('/request', authMiddleware, requireStudent, profileChangeController.submitRequest);
router.get('/my-requests', authMiddleware, requireStudent, profileChangeController.getStudentRequests);
router.post('/mark-verified', authMiddleware, requireStudent, profileChangeController.markVerified);

// Admin Routes — view_profile_requests/edit_profile_requests + college/course/branch scope
router.get(
    '/report',
    authMiddleware,
    verifyPermission(MODULES.REPORTS, 'view_profile_reports'),
    attachUserScope,
    profileChangeController.getProfileCompletionReport
);

router.get(
    '/all',
    authMiddleware,
    canViewProfileRequests,
    attachUserScope,
    profileChangeController.getAllRequests
);

router.get(
    '/by-student/:admission_number',
    authMiddleware,
    canViewProfileRequests,
    attachUserScope,
    profileChangeController.getRequestsByAdmission
);

// Staff/Admin/Principal can submit a change request on behalf of a student
router.post(
    '/submit',
    authMiddleware,
    canManageProfileRequests,
    attachUserScope,
    profileChangeController.submitRequestByAdmin
);

router.put(
    '/:id/status',
    authMiddleware,
    canManageProfileRequests,
    attachUserScope,
    profileChangeController.updateRequestStatus
);

module.exports = router;
