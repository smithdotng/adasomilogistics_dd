const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const apiController = require('../controllers/apiController');

router.get('/orders/:id/tracking', requireAuth, apiController.orderTracking);

module.exports = router;
