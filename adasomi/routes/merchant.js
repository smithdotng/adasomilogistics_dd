const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const merchantController = require('../controllers/merchantController');

router.use(requireRole('merchant'));

router.get('/dashboard', merchantController.dashboard);

router.get('/riders', merchantController.riders);
router.get('/riders/search', merchantController.searchRiders);
router.post('/riders/invite', merchantController.inviteRider);
router.post('/riders/decide', merchantController.decideRiderRequest);

router.get('/orders', merchantController.ordersList);
router.get('/orders/new', merchantController.newOrderForm);
router.post('/orders', merchantController.createOrder);
router.get('/orders/:id', merchantController.orderDetail);
router.post('/orders/:id/fund-escrow', merchantController.fundEscrow);
router.post('/orders/:id/cancel', merchantController.cancelOrder);
router.post('/orders/:id/dispute', merchantController.raiseDispute);

router.get('/wallet', merchantController.wallet);

module.exports = router;
