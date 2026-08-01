const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const customerController = require('../controllers/customerController');

router.use(requireRole('public_user'));

router.get('/dashboard', customerController.dashboard);
router.get('/orders/new', customerController.newOrderForm);
router.post('/orders', customerController.createOrder);
router.get('/orders/:id', customerController.orderDetail);
router.post('/orders/:id/fund-escrow', customerController.fundEscrow);
router.post('/orders/:id/cancel', customerController.cancelOrder);
router.post('/orders/:id/dispute', customerController.raiseDispute);

module.exports = router;
