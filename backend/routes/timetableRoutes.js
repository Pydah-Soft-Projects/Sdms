const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');
const authMiddleware = require('../middleware/auth');
const { verifyRole } = require('../middleware/rbac');

// All timetable routes require authentication
router.use(authMiddleware);

router.get('/my-timetable', timetableController.getMyTimetable);
router.get('/my', timetableController.getMyTimetable);
router.get('/', timetableController.list);
router.post('/bulk', verifyRole('admin', 'super_admin', 'branch_hod'), timetableController.updateBulk);
router.post('/', verifyRole('admin', 'super_admin', 'branch_hod'), timetableController.saveEntry);
router.delete('/:id', verifyRole('admin', 'super_admin', 'branch_hod'), timetableController.removeEntry);

module.exports = router;
