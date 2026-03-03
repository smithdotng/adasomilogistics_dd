const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const providerController = require('../controllers/providerController');
const clientController = require('../controllers/clientController');
const carePlanController = require('../controllers/carePlanController');
const scheduleController = require('../controllers/scheduleController');
const reportController = require('../controllers/reportController');
const settingsController = require('../controllers/settingsController');
const { isAuthenticated, isProvider, checkSubscriptionLimit } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/operators/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'operator-' + uniqueSuffix + path.extname(file.originalname));
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
router.get('/dashboard', isAuthenticated, isProvider, providerController.getDashboard);

// Operator Management
router.get('/operators', isAuthenticated, isProvider, providerController.getOperators);
router.get('/operators/create', isAuthenticated, isProvider, checkSubscriptionLimit('operator'), providerController.getCreateOperator);
router.post('/operators', isAuthenticated, isProvider, checkSubscriptionLimit('operator'), providerController.createOperator);
router.get('/operators/:id', isAuthenticated, isProvider, providerController.getOperatorDetails);
router.get('/operators/:id/edit', isAuthenticated, isProvider, providerController.getEditOperator);
router.put('/operators/:id', isAuthenticated, isProvider, providerController.updateOperator);
router.post('/operators/:operatorId/assign-clients', isAuthenticated, isProvider, providerController.assignClients);

// Upload operator documents
router.post('/operators/:id/upload-document', 
    isAuthenticated, 
    isProvider, 
    upload.single('document'),
    (req, res) => {
        req.flash('success', 'Document uploaded successfully');
        res.redirect(`/provider/operators/${req.params.id}`);
    }
);

// Client Management
router.get('/clients', isAuthenticated, isProvider, clientController.getClients);
router.get('/clients/create', isAuthenticated, isProvider, checkSubscriptionLimit('client'), clientController.getCreateClient);
router.post('/clients', isAuthenticated, isProvider, checkSubscriptionLimit('client'), clientController.createClient);
router.get('/clients/:id', isAuthenticated, isProvider, clientController.getClientDetails);
router.get('/clients/:id/edit', isAuthenticated, isProvider, clientController.getEditClient);
router.put('/clients/:id', isAuthenticated, isProvider, clientController.updateClient);

// Care Plans
router.get('/care-plans', isAuthenticated, isProvider, carePlanController.getCarePlans);
router.get('/care-plans/create/:clientId', isAuthenticated, isProvider, carePlanController.getCreateCarePlan);
router.post('/care-plans', isAuthenticated, isProvider, carePlanController.createCarePlan);
router.get('/care-plans/:id', isAuthenticated, isProvider, carePlanController.getCarePlanDetails);
router.get('/care-plans/:id/edit', isAuthenticated, isProvider, carePlanController.getEditCarePlan);
router.put('/care-plans/:id', isAuthenticated, isProvider, carePlanController.updateCarePlan);

// Scheduling
router.get('/schedule', isAuthenticated, isProvider, scheduleController.getSchedule);
router.get('/schedule/create', isAuthenticated, isProvider, scheduleController.getCreateSchedule);
router.post('/schedule', isAuthenticated, isProvider, scheduleController.createSchedule);
router.get('/schedule/:id', isAuthenticated, isProvider, scheduleController.getScheduleDetails);
router.put('/schedule/:id', isAuthenticated, isProvider, scheduleController.updateSchedule);
router.delete('/schedule/:id', isAuthenticated, isProvider, scheduleController.deleteSchedule);

// Reports
router.get('/reports', isAuthenticated, isProvider, reportController.getReports);
router.get('/reports/export/:type', isAuthenticated, isProvider, reportController.exportReport);

// Settings routes
router.get('/settings', isAuthenticated, isProvider, settingsController.getSettings);
router.put('/settings', isAuthenticated, isProvider, settingsController.updateSettings);
router.get('/settings/billing', isAuthenticated, isProvider, settingsController.getBilling);
router.post('/settings/upgrade', isAuthenticated, isProvider, settingsController.upgradeSubscription);
router.get('/settings/team', isAuthenticated, isProvider, settingsController.getTeam);
router.post('/settings/team/invite', isAuthenticated, isProvider, settingsController.inviteTeamMember);
router.get('/settings/notifications', isAuthenticated, isProvider, settingsController.getNotifications);
router.post('/settings/notifications', isAuthenticated, isProvider, settingsController.updateNotifications);
router.get('/settings/security', isAuthenticated, isProvider, settingsController.getSecurity);
router.post('/settings/security', isAuthenticated, isProvider, settingsController.updateSecurity);
router.get('/settings/api', isAuthenticated, isProvider, settingsController.getApi);
router.post('/settings/api/regenerate', isAuthenticated, isProvider, settingsController.regenerateApiKey);

module.exports = router;