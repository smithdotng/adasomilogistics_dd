const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const riderController = require('../controllers/riderController');

router.use(requireRole('rider'));

router.get('/dashboard', riderController.dashboard);
router.post('/availability/toggle', riderController.toggleAvailability);

router.get('/verification', riderController.verification);
router.post('/verification/request', riderController.requestListing);

router.get('/orders', riderController.availableOrders);
router.get('/my-deliveries', riderController.myDeliveries);
router.get('/orders/:id', riderController.orderDetail);
router.post('/orders/:id/accept', riderController.acceptOrder);
router.post('/orders/:id/verify-pickup', riderController.verifyPickup);
router.post('/orders/:id/verify-delivery', riderController.verifyDelivery);
router.post('/orders/:id/location', riderController.updateLocation);

router.get('/wallet', riderController.wallet);

module.exports = router;
