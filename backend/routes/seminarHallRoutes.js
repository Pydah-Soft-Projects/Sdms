const express = require('express');
const router = express.Router();
const clubController = require('../controllers/clubController');
const verifyToken = require('../middleware/auth');
const { hasPermission } = require('../constants/rbac');
const { masterPool } = require('../config/database');

const GLOBAL_ADMIN_ROLES = new Set(['admin', 'super_admin', 'superadmin']);
const SEMINAR_HALL_PERMISSIONS = [
    'view_seminar_halls',
    'create_seminar_hall_request',
    'manage_seminar_halls'
];

const requireSeminarHallPermission = (...permissions) => (req, res, next) => {
    const user = req.user || req.admin;
    if (GLOBAL_ADMIN_ROLES.has(String(user?.role || '').toLowerCase())) return next();
    if (permissions.some(permission => hasPermission(user?.permissions, 'seminar_halls', permission))) {
        return next();
    }
    return res.status(403).json({ success: false, message: 'Seminar Hall permission required' });
};

router.use(verifyToken);

router.get(
    '/requests',
    requireSeminarHallPermission(...SEMINAR_HALL_PERMISSIONS),
    clubController.getSeminarHallRequests
);
router.get(
    '/halls',
    requireSeminarHallPermission(...SEMINAR_HALL_PERMISSIONS),
    clubController.getSeminarHalls
);
router.get(
    '/clubs',
    requireSeminarHallPermission(...SEMINAR_HALL_PERMISSIONS),
    async (req, res) => {
        try {
            const [clubs] = await masterPool.query(
                'SELECT id, name FROM clubs WHERE is_active = TRUE ORDER BY name'
            );
            res.json({ success: true, data: clubs });
        } catch (error) {
            console.error('Failed to load clubs for seminar hall requests:', error);
            res.status(500).json({ success: false, message: 'Failed to load club options' });
        }
    }
);
router.post(
    '/halls',
    requireSeminarHallPermission('manage_seminar_halls'),
    clubController.createSeminarHall
);
router.put(
    '/halls/:hallId',
    requireSeminarHallPermission('manage_seminar_halls'),
    clubController.updateSeminarHall
);
router.delete(
    '/halls/:hallId',
    requireSeminarHallPermission('manage_seminar_halls'),
    clubController.deleteSeminarHall
);
router.post(
    '/estimate',
    requireSeminarHallPermission('create_seminar_hall_request', 'manage_seminar_halls'),
    clubController.getSeminarHallAudienceEstimate
);
router.post(
    '/requests',
    requireSeminarHallPermission('create_seminar_hall_request', 'manage_seminar_halls'),
    clubController.createSeminarHallRequest
);
router.patch(
    '/requests/:requestId',
    requireSeminarHallPermission('manage_seminar_halls'),
    clubController.updateSeminarHallRequestStatus
);

module.exports = router;
