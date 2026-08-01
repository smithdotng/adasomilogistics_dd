const User = require('../models/User');
const RiderListing = require('../models/RiderListing');
const Order = require('../models/Order');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const orderService = require('../services/orderService');

exports.dashboard = async (req, res) => {
    const riderId = req.session.user.id;
    const [verifiedCount, pendingCount, activeOrder, wallet, rider] = await Promise.all([
        RiderListing.countDocuments({ rider: riderId, status: 'approved' }),
        RiderListing.countDocuments({ rider: riderId, status: 'pending' }),
        Order.findOne({ assignedRider: riderId, status: { $in: ['assigned', 'picked_up'] } }),
        Wallet.findOne({ owner: riderId, role: 'rider' }),
        User.findById(riderId)
    ]);
    res.render('rider/dashboard', {
        title: 'Rider Dashboard',
        currentPage: 'dashboard',
        verifiedCount, pendingCount, activeOrder,
        walletBalance: wallet ? wallet.balance : 0,
        rider
    });
};

exports.toggleAvailability = async (req, res) => {
    const rider = await User.findById(req.session.user.id);
    rider.riderInfo.isAvailable = !rider.riderInfo.isAvailable;
    await rider.save();
    req.session.user.riderInfo = rider.riderInfo;
    req.flash('success', `You are now ${rider.riderInfo.isAvailable ? 'available' : 'unavailable'} for dispatch.`);
    res.redirect('/rider/dashboard');
};

exports.verification = async (req, res) => {
    const riderId = req.session.user.id;
    const q = (req.query.q || '').trim();
    let searchResults = [];
    if (q) {
        searchResults = await User.find({
            role: 'merchant',
            $or: [
                { 'merchantInfo.businessName': new RegExp(q, 'i') },
                { email: new RegExp(q, 'i') }
            ]
        }).limit(20);
    }
    const listings = await RiderListing.find({ rider: riderId }).populate('merchant').sort({ createdAt: -1 });
    res.render('rider/verification', {
        title: 'Operator Verification',
        currentPage: 'verification',
        listings, searchResults, searchQuery: q
    });
};

exports.requestListing = async (req, res) => {
    try {
        const riderId = req.session.user.id;
        const { merchantId } = req.body;
        await RiderListing.findOneAndUpdate(
            { rider: riderId, merchant: merchantId },
            { $setOnInsert: { rider: riderId, merchant: merchantId, status: 'pending' } },
            { upsert: true, new: true }
        );
        req.flash('success', 'Verification request sent to operator.');
    } catch (err) {
        req.flash('error', 'Could not send request: ' + err.message);
    }
    res.redirect('/rider/verification');
};

exports.availableOrders = async (req, res) => {
    const riderId = req.session.user.id;
    const orders = await Order.find({
        status: 'awaiting_assignment',
        assignedRider: { $exists: false },
        eligibleRiders: riderId
    }).sort({ createdAt: -1 }).populate('merchant');
    res.render('rider/orders', { title: 'Available Deliveries', currentPage: 'orders', orders });
};

exports.acceptOrder = async (req, res) => {
    try {
        const riderId = req.session.user.id;
        const order = await Order.findOne({
            _id: req.params.id,
            status: 'awaiting_assignment',
            assignedRider: { $exists: false },
            eligibleRiders: riderId
        });
        if (!order) {
            req.flash('error', 'This delivery is no longer available.');
            return res.redirect('/rider/orders');
        }
        order.assignedRider = riderId;
        order.status = 'assigned';
        order.timeline.push({ status: 'assigned', note: 'Accepted by rider (first-come, first-served).' });
        await order.save();
        req.flash('success', 'Delivery accepted. Head to pickup.');
        res.redirect(`/rider/orders/${order._id}`);
    } catch (err) {
        req.flash('error', 'Could not accept order: ' + err.message);
        res.redirect('/rider/orders');
    }
};

exports.myDeliveries = async (req, res) => {
    const orders = await Order.find({ assignedRider: req.session.user.id }).sort({ createdAt: -1 });
    res.render('rider/my-deliveries', { title: 'My Deliveries', currentPage: 'orders', orders });
};

exports.orderDetail = async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, assignedRider: req.session.user.id }).populate('merchant');
    if (!order) {
        req.flash('error', 'Order not found.');
        return res.redirect('/rider/orders');
    }
    res.render('rider/order-detail', { title: `Delivery ${order.orderNumber}`, currentPage: 'orders', order });
};

exports.verifyPickup = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, assignedRider: req.session.user.id });
        if (!order) {
            req.flash('error', 'Order not found.');
            return res.redirect('/rider/orders');
        }
        await orderService.verifyPickupOtp(order, req.body.code);
        req.flash('success', 'Pickup confirmed. En route to drop-off.');
    } catch (err) {
        req.flash('error', err.message);
    }
    res.redirect(`/rider/orders/${req.params.id}`);
};

exports.verifyDelivery = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, assignedRider: req.session.user.id });
        if (!order) {
            req.flash('error', 'Order not found.');
            return res.redirect('/rider/orders');
        }
        await orderService.verifyDeliveryPin(order, req.body.pin);
        req.flash('success', `Delivery completed. ₦${order.pricing.riderPayout.toLocaleString()} credited to your wallet.`);
    } catch (err) {
        req.flash('error', err.message);
    }
    res.redirect(`/rider/orders/${req.params.id}`);
};

exports.updateLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const order = await Order.findOne({ _id: req.params.id, assignedRider: req.session.user.id });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        order.tracking.push({ lat, lng, at: new Date() });
        if (order.tracking.length > 200) order.tracking.shift();
        await order.save();
        await User.findByIdAndUpdate(req.session.user.id, {
            'riderInfo.currentLat': lat,
            'riderInfo.currentLng': lng
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.wallet = async (req, res) => {
    const wallet = await Wallet.findOne({ owner: req.session.user.id, role: 'rider' });
    const transactions = wallet
        ? await Transaction.find({ wallet: wallet._id }).sort({ createdAt: -1 }).populate('order')
        : [];
    res.render('rider/wallet', { title: 'Wallet', currentPage: 'wallet', wallet, transactions });
};
