const User = require('../models/User');
const RiderListing = require('../models/RiderListing');
const Order = require('../models/Order');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const PlatformConfig = require('../models/PlatformConfig');
const { haversineDistanceKm } = require('../utils/geo');
const { computePricing } = require('../utils/pricing');
const { generateOrderNumber } = require('../utils/codes');
const orderService = require('../services/orderService');

exports.dashboard = async (req, res) => {
    const merchantId = req.session.user.id;

    const [fleetCount, pendingRequests, activeOrders, wallet, recentOrders] = await Promise.all([
        RiderListing.countDocuments({ merchant: merchantId, status: 'approved' }),
        RiderListing.countDocuments({ merchant: merchantId, status: 'pending' }),
        Order.countDocuments({ merchant: merchantId, status: { $nin: ['completed', 'cancelled'] } }),
        Wallet.findOne({ owner: merchantId, role: 'merchant' }),
        Order.find({ merchant: merchantId }).sort({ createdAt: -1 }).limit(6)
    ]);

    res.render('merchant/dashboard', {
        title: 'Merchant Dashboard',
        currentPage: 'dashboard',
        fleetCount, pendingRequests, activeOrders,
        walletBalance: wallet ? wallet.balance : 0,
        recentOrders
    });
};

exports.riders = async (req, res) => {
    const merchantId = req.session.user.id;
    const [pending, fleet] = await Promise.all([
        RiderListing.find({ merchant: merchantId, status: 'pending' }).populate('rider').sort({ createdAt: -1 }),
        RiderListing.find({ merchant: merchantId, status: 'approved' }).populate('rider').sort({ createdAt: -1 })
    ]);
    res.render('merchant/riders', {
        title: 'Fleet & Riders',
        currentPage: 'riders',
        pending, fleet,
        searchResults: null,
        searchQuery: ''
    });
};

exports.searchRiders = async (req, res) => {
    const merchantId = req.session.user.id;
    const q = (req.query.q || '').trim();
    let searchResults = [];
    if (q) {
        searchResults = await User.find({
            role: 'rider',
            $or: [
                { email: new RegExp(q, 'i') },
                { firstName: new RegExp(q, 'i') },
                { lastName: new RegExp(q, 'i') }
            ]
        }).limit(20);
    }
    const [pending, fleet] = await Promise.all([
        RiderListing.find({ merchant: merchantId, status: 'pending' }).populate('rider').sort({ createdAt: -1 }),
        RiderListing.find({ merchant: merchantId, status: 'approved' }).populate('rider').sort({ createdAt: -1 })
    ]);
    res.render('merchant/riders', {
        title: 'Fleet & Riders',
        currentPage: 'riders',
        pending, fleet, searchResults, searchQuery: q
    });
};

exports.inviteRider = async (req, res) => {
    try {
        const merchantId = req.session.user.id;
        const { riderId } = req.body;
        await RiderListing.findOneAndUpdate(
            { rider: riderId, merchant: merchantId },
            { $setOnInsert: { rider: riderId, merchant: merchantId, status: 'approved', decidedAt: new Date() } },
            { upsert: true, new: true }
        );
        req.flash('success', 'Rider added to your fleet.');
    } catch (err) {
        req.flash('error', 'Could not add rider: ' + err.message);
    }
    res.redirect('/merchant/riders');
};

exports.decideRiderRequest = async (req, res) => {
    try {
        const { listingId, decision } = req.body;
        const listing = await RiderListing.findOne({ _id: listingId, merchant: req.session.user.id });
        if (!listing) {
            req.flash('error', 'Listing not found.');
            return res.redirect('/merchant/riders');
        }
        listing.status = decision === 'approve' ? 'approved' : 'rejected';
        listing.decidedAt = new Date();
        await listing.save();
        req.flash('success', `Rider request ${listing.status}.`);
    } catch (err) {
        req.flash('error', 'Could not process request: ' + err.message);
    }
    res.redirect('/merchant/riders');
};

exports.newOrderForm = async (req, res) => {
    const fleet = await RiderListing.find({ merchant: req.session.user.id, status: 'approved' }).populate('rider');
    const config = await PlatformConfig.getSingleton();
    res.render('merchant/order-new', {
        title: 'Dispatch New Order',
        currentPage: 'orders',
        fleet, config
    });
};

exports.createOrder = async (req, res) => {
    try {
        const merchantId = req.session.user.id;
        const {
            recipientName, recipientPhone,
            pickupAddress, pickupLat, pickupLng,
            dropoffAddress, dropoffLat, dropoffLng,
            itemsDescription, itemsValue,
            dispatchMode, assignedRiderId
        } = req.body;

        const config = await PlatformConfig.getSingleton();
        const distanceKm = haversineDistanceKm(
            parseFloat(pickupLat), parseFloat(pickupLng),
            parseFloat(dropoffLat), parseFloat(dropoffLng)
        );
        const pricing = computePricing(config, { distanceKm, itemsValue: parseFloat(itemsValue) || 0 });

        let eligibleRiders = [];
        if (dispatchMode === 'broadcast') {
            const listings = await RiderListing.find({ merchant: merchantId, status: 'approved' });
            eligibleRiders = listings.map(l => l.rider);
        }

        const order = await Order.create({
            orderNumber: generateOrderNumber(),
            type: 'merchant',
            merchant: merchantId,
            recipientName, recipientPhone,
            pickupAddress, pickupLat, pickupLng,
            dropoffAddress, dropoffLat, dropoffLng,
            distanceKm,
            itemsDescription,
            itemsValue: parseFloat(itemsValue) || 0,
            pricing,
            dispatchMode,
            assignedRider: dispatchMode === 'manual' ? assignedRiderId : undefined,
            eligibleRiders,
            timeline: [{ status: 'awaiting_payment', note: 'Order created, awaiting escrow funding.' }]
        });

        res.redirect(`/merchant/orders/${order._id}`);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not create order: ' + err.message);
        res.redirect('/merchant/orders/new');
    }
};

exports.fundEscrow = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, merchant: req.session.user.id });
        if (!order) {
            req.flash('error', 'Order not found.');
            return res.redirect('/merchant/orders');
        }
        await orderService.fundEscrow(order);
        if (order.dispatchMode === 'manual' && order.assignedRider) {
            order.status = 'assigned';
            order.timeline.push({ status: 'assigned', note: 'Manually assigned to selected rider.' });
            await order.save();
        }
        req.flash('success', `Escrow funded (₦${order.pricing.totalValue.toLocaleString()}). Dispatch is now live.`);
        res.redirect(`/merchant/orders/${order._id}`);
    } catch (err) {
        req.flash('error', 'Could not fund escrow: ' + err.message);
        res.redirect('/merchant/orders');
    }
};

exports.ordersList = async (req, res) => {
    const orders = await Order.find({ merchant: req.session.user.id }).sort({ createdAt: -1 });
    res.render('merchant/orders', { title: 'Orders', currentPage: 'orders', orders });
};

exports.orderDetail = async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, merchant: req.session.user.id })
        .populate('assignedRider')
        .populate('eligibleRiders');
    if (!order) {
        req.flash('error', 'Order not found.');
        return res.redirect('/merchant/orders');
    }
    res.render('merchant/order-detail', { title: `Order ${order.orderNumber}`, currentPage: 'orders', order });
};

exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, merchant: req.session.user.id });
        if (!order) {
            req.flash('error', 'Order not found.');
            return res.redirect('/merchant/orders');
        }
        if (['picked_up', 'delivered', 'completed'].includes(order.status)) {
            req.flash('error', 'Cannot cancel an order already in transit or completed.');
            return res.redirect(`/merchant/orders/${order._id}`);
        }
        order.status = 'cancelled';
        if (order.escrow.status === 'held') order.escrow.status = 'refunded';
        order.timeline.push({ status: 'cancelled', note: 'Order cancelled by merchant.' });
        await order.save();
        req.flash('success', 'Order cancelled.');
    } catch (err) {
        req.flash('error', 'Could not cancel order: ' + err.message);
    }
    res.redirect('/merchant/orders');
};

exports.wallet = async (req, res) => {
    const wallet = await Wallet.findOne({ owner: req.session.user.id, role: 'merchant' });
    const transactions = wallet
        ? await Transaction.find({ wallet: wallet._id }).sort({ createdAt: -1 }).populate('order')
        : [];
    res.render('merchant/wallet', { title: 'Wallet', currentPage: 'wallet', wallet, transactions });
};

exports.raiseDispute = async (req, res) => {
    const Dispute = require('../models/Dispute');
    try {
        const order = await Order.findOne({ _id: req.params.id, merchant: req.session.user.id });
        if (!order) {
            req.flash('error', 'Order not found.');
            return res.redirect('/merchant/orders');
        }
        await Dispute.create({ order: order._id, raisedBy: req.session.user.id, reason: req.body.reason });
        order.status = 'disputed';
        order.timeline.push({ status: 'disputed', note: 'Dispute raised by merchant.' });
        await order.save();
        req.flash('success', 'Dispute submitted to Adasomi support.');
    } catch (err) {
        req.flash('error', 'Could not raise dispute: ' + err.message);
    }
    res.redirect(`/merchant/orders/${req.params.id}`);
};
