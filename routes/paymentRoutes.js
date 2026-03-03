const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { isAuthenticated, isProvider } = require('../middleware/auth');

// IMPORTANT: Order matters - specific routes must come before dynamic routes

// Payment dashboard
router.get('/dashboard', isAuthenticated, isProvider, paymentController.getPaymentDashboard);

// Timesheet management - specific routes first
router.get('/timesheets/create', isAuthenticated, isProvider, (req, res) => {
    res.render('provider/payments/timesheet-create', {
        title: 'Create Timesheet',
        user: req.session.user,
        moment: require('moment')
    });
});

router.get('/timesheets', isAuthenticated, isProvider, paymentController.getTimesheets);
router.post('/timesheets', isAuthenticated, isProvider, paymentController.createTimesheet);

// This dynamic route must come AFTER specific routes
router.get('/timesheets/:id', isAuthenticated, isProvider, paymentController.getTimesheetDetails);
router.post('/timesheets/:id/approve', isAuthenticated, isProvider, paymentController.approveTimesheet);

// Payment generation
router.post('/payments/generate', isAuthenticated, isProvider, paymentController.generatePayment);
router.get('/payments/export', isAuthenticated, isProvider, paymentController.exportPaymentReport);

module.exports = router;