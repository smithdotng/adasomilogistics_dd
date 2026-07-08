const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { isAuthenticated, isCareProvider } = require('../middleware/auth');

// Payment dashboard
router.get('/dashboard', isAuthenticated, isCareProvider, paymentController.getPaymentDashboard);

// List all payments
router.get('/', isAuthenticated, isCareProvider, paymentController.getPayments);

// Create payment period form
router.get('/create', isAuthenticated, isCareProvider, paymentController.getCreatePayment);

// Create payment period
router.post('/', isAuthenticated, isCareProvider, paymentController.createPaymentPeriod);

// Payment details
router.get('/:id', isAuthenticated, isCareProvider, paymentController.getPaymentDetails);

// Approve payment
router.post('/:id/approve', isAuthenticated, isCareProvider, paymentController.approvePayment);

// Mark as paid
router.post('/:id/paid', isAuthenticated, isCareProvider, paymentController.markAsPaid);

// Add deduction
router.post('/:id/deductions', isAuthenticated, isCareProvider, paymentController.addDeduction);

// Generate payslip
router.get('/:id/payslip', isAuthenticated, isCareProvider, paymentController.generatePayslip);

// Export payments
router.get('/export/payments', isAuthenticated, isCareProvider, paymentController.exportPayments);

module.exports = router;