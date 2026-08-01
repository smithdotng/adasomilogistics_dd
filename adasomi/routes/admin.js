const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.use(requireRole('admin'));

router.get('/dashboard', adminController.dashboard);

router.get('/riders', adminController.riders);
router.post('/riders/kyc', adminController.decideKyc);

router.get('/orders', adminController.orders);

router.get('/disputes', adminController.disputes);
router.post('/disputes/resolve', adminController.resolveDispute);

router.get('/config', adminController.config);
router.post('/config', adminController.updateConfig);

module.exports = router;
