const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { isAuthenticated, isCareProvider } = require('../middleware/auth');

// IMPORTANT: Order matters - specific routes must come before dynamic routes

// Payment dashboard
router.get('/dashboard', isAuthenticated, isCareProvider, paymentController.getPaymentDashboard);

// Timesheet management - specific routes first
router.get('/timesheets/create', isAuthenticated, isCareProvider, (req, res) => {
    res.render('careProvider/payments/timesheet-create', {
        title: 'Create Timesheet',
        user: req.session.user,
        moment: require('moment')
    });
});

router.get('/timesheets', isAuthenticated, isCareProvider, paymentController.getTimesheets);
router.post('/timesheets', isAuthenticated, isCareProvider, paymentController.createTimesheet);

// This dynamic route must come AFTER specific routes
router.get('/timesheets/:id', isAuthenticated, isCareProvider, paymentController.getTimesheetDetails);
router.post('/timesheets/:id/approve', isAuthenticated, isCareProvider, paymentController.approveTimesheet);

// Payment generation
router.post('/payments/generate', isAuthenticated, isCareProvider, paymentController.generatePayment);
router.get('/payments/export', isAuthenticated, isCareProvider, paymentController.exportPaymentReport);

module.exports = router;