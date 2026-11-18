const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { verifyPermission, attachUserScope } = require('../middleware/rbac');
const { MODULES } = require('../constants/rbac');
const serviceController = require('../controllers/serviceController');

// All routes require authentication
router.use(authMiddleware);

// --- Services Configuration (Admin) ---
// View all services: permission 'view'
// View all services: permission 'view' for admins, public/active for students
router.get('/', (req, res, next) => {
    // If student (or no role which implies student in this context if auth passed), allow access
    if (req.user && (req.user.role === 'student' || !req.user.role)) {
        return next();
    }
    // For admins/staff, require permission
    return verifyPermission(MODULES.SERVICES, 'view')(req, res, next);
}, serviceController.getServices);

// Create service: permission 'manage_config'
router.post('/', verifyPermission(MODULES.SERVICES, 'manage_config'), serviceController.createService);

// Update service: permission 'manage_config'
router.put('/:id', verifyPermission(MODULES.SERVICES, 'manage_config'), serviceController.updateService);

// Delete/Deactivate service: permission 'manage_config'
router.delete('/:id', verifyPermission(MODULES.SERVICES, 'manage_config'), serviceController.deleteService);


// --- Service Requests ---

// Student Request (Student Role Only)
router.post('/requests', serviceController.requestService);

// Delete Request (Student Role Only)
router.delete('/requests/:id', serviceController.deleteServiceRequest);

// Admin Create Request (Admin Only)
router.post('/requests/admin', verifyPermission(MODULES.SERVICES, 'manage_requests'), serviceController.createRequestByAdmin);

// Get Service Requests (Student sees own, Admin sees all with permission)
router.get('/requests', (req, res, next) => {
    // If student, allow access
    if (req.user && req.user.role === 'student') {
        return next();
    }
    // If admin/staff, check permission and attach scope
    const middleware = [verifyPermission(MODULES.SERVICES, 'view'), attachUserScope];
    return verifyPermission(MODULES.SERVICES, 'view')(req, res, () => {
        attachUserScope(req, res, next);
    });
}, serviceController.getServiceRequests);

// Update Request Status (Admin/Staff with permission)
router.put('/requests/:id/status', verifyPermission(MODULES.SERVICES, 'manage_requests'), serviceController.updateRequestStatus);

// Update Request Data (Admin/Staff with permission)
router.put('/requests/:id', verifyPermission(MODULES.SERVICES, 'manage_requests'), serviceController.updateServiceRequest);

// Process Payment / Mark Payment (Admin)
router.post('/pay', verifyPermission(MODULES.SERVICES, 'manage_requests'), serviceController.processPayment);

// Download Certificate (Student/Admin)
router.get('/requests/:id/download', serviceController.downloadCertificate);

// Preview Template (Admin)
router.post('/preview', verifyPermission(MODULES.SERVICES, 'manage_config'), serviceController.previewTemplate);

module.exports = router;
