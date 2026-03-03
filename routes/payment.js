const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { isAuthenticated, isProvider } = require('../middleware/auth');

// Payment dashboard
router.get('/dashboard', isAuthenticated, isProvider, paymentController.getPaymentDashboard);

// List all payments
router.get('/', isAuthenticated, isProvider, paymentController.getPayments);

// Create payment period form
router.get('/create', isAuthenticated, isProvider, paymentController.getCreatePayment);

// Create payment period
router.post('/', isAuthenticated, isProvider, paymentController.createPaymentPeriod);

// Payment details
router.get('/:id', isAuthenticated, isProvider, paymentController.getPaymentDetails);

// Approve payment
router.post('/:id/approve', isAuthenticated, isProvider, paymentController.approvePayment);

// Mark as paid
router.post('/:id/paid', isAuthenticated, isProvider, paymentController.markAsPaid);

// Add deduction
router.post('/:id/deductions', isAuthenticated, isProvider, paymentController.addDeduction);

// Generate payslip
router.get('/:id/payslip', isAuthenticated, isProvider, paymentController.generatePayslip);

// Export payments
router.get('/export/payments', isAuthenticated, isProvider, paymentController.exportPayments);

module.exports = router;