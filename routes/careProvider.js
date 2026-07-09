const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const careProviderController = require('../controllers/careProviderController');
const serviceUserController = require('../controllers/serviceUserController');
const carePlanController = require('../controllers/carePlanController');
const scheduleController = require('../controllers/scheduleController');
const reportController = require('../controllers/reportController');
const settingsController = require('../controllers/settingsController');
const { isAuthenticated, isCareProvider, checkSubscriptionLimit } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/support-workers/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'support-worker-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images and PDFs are allowed'));
    }
});

// Dashboard
router.get('/dashboard', isAuthenticated, isCareProvider, careProviderController.getDashboard);

// Support Worker Management
router.get('/support-workers', isAuthenticated, isCareProvider, careProviderController.getOperators);
router.get('/support-workers/create', isAuthenticated, isCareProvider, checkSubscriptionLimit('support_worker'), careProviderController.getCreateOperator);
router.post('/support-workers', isAuthenticated, isCareProvider, checkSubscriptionLimit('support_worker'), careProviderController.createOperator);
router.get('/support-workers/:id', isAuthenticated, isCareProvider, careProviderController.getOperatorDetails);
router.get('/support-workers/:id/edit', isAuthenticated, isCareProvider, careProviderController.getEditOperator);
router.put('/support-workers/:id', isAuthenticated, isCareProvider, careProviderController.updateOperator);
router.get('/support-workers/:supportWorkerId/assign-service-users', isAuthenticated, isCareProvider, careProviderController.getAssignServiceUsers);
router.post('/support-workers/:supportWorkerId/assign-service-users', isAuthenticated, isCareProvider, careProviderController.assignServiceUsers);

// Upload support worker documents
router.post('/support-workers/:id/upload-document', 
    isAuthenticated, 
    isCareProvider, 
    upload.single('document'),
    (req, res) => {
        req.flash('success', 'Document uploaded successfully');
        res.redirect(`/care-provider/support-workers/${req.params.id}`);
    }
);

// Service User Management
router.get('/service-users', isAuthenticated, isCareProvider, serviceUserController.getClients);
router.get('/service-users/create', isAuthenticated, isCareProvider, checkSubscriptionLimit('service_user'), serviceUserController.getCreateClient);
router.post('/service-users', isAuthenticated, isCareProvider, checkSubscriptionLimit('service_user'), serviceUserController.createClient);
router.get('/service-users/:id', isAuthenticated, isCareProvider, serviceUserController.getClientDetails);
router.get('/service-users/:id/edit', isAuthenticated, isCareProvider, serviceUserController.getEditClient);
router.put('/service-users/:id', isAuthenticated, isCareProvider, serviceUserController.updateClient);

// Care Plans
router.get('/care-plans', isAuthenticated, isCareProvider, carePlanController.getCarePlans);
router.get('/care-plans/create/:serviceUserId', isAuthenticated, isCareProvider, carePlanController.getCreateCarePlan);
router.post('/care-plans', isAuthenticated, isCareProvider, carePlanController.createCarePlan);
router.get('/care-plans/:id', isAuthenticated, isCareProvider, carePlanController.getCarePlanDetails);
router.get('/care-plans/:id/edit', isAuthenticated, isCareProvider, carePlanController.getEditCarePlan);
router.put('/care-plans/:id', isAuthenticated, isCareProvider, carePlanController.updateCarePlan);

// Scheduling
router.get('/schedule', isAuthenticated, isCareProvider, scheduleController.getSchedule);
router.get('/schedule/create', isAuthenticated, isCareProvider, scheduleController.getCreateSchedule);
router.post('/schedule', isAuthenticated, isCareProvider, scheduleController.createSchedule);
router.get('/schedule/:id', isAuthenticated, isCareProvider, scheduleController.getScheduleDetails);
router.put('/schedule/:id', isAuthenticated, isCareProvider, scheduleController.updateSchedule);
router.delete('/schedule/:id', isAuthenticated, isCareProvider, scheduleController.deleteSchedule);

// Reports
router.get('/reports', isAuthenticated, isCareProvider, reportController.getReports);
router.get('/reports/export/:type', isAuthenticated, isCareProvider, reportController.exportReport);

// Settings routes
router.get('/settings', isAuthenticated, isCareProvider, settingsController.getSettings);
router.put('/settings', isAuthenticated, isCareProvider, settingsController.updateSettings);
router.get('/settings/billing', isAuthenticated, isCareProvider, settingsController.getBilling);
router.post('/settings/upgrade', isAuthenticated, isCareProvider, settingsController.upgradeSubscription);
router.get('/settings/team', isAuthenticated, isCareProvider, settingsController.getTeam);
router.post('/settings/team/invite', isAuthenticated, isCareProvider, settingsController.inviteTeamMember);
router.get('/settings/notifications', isAuthenticated, isCareProvider, settingsController.getNotifications);
router.post('/settings/notifications', isAuthenticated, isCareProvider, settingsController.updateNotifications);
router.get('/settings/security', isAuthenticated, isCareProvider, settingsController.getSecurity);
router.post('/settings/security', isAuthenticated, isCareProvider, settingsController.updateSecurity);
router.get('/settings/api', isAuthenticated, isCareProvider, settingsController.getApi);
router.post('/settings/api/regenerate', isAuthenticated, isCareProvider, settingsController.regenerateApiKey);

module.exports = router;