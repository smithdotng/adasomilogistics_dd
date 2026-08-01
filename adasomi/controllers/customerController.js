const RiderListing = require('../models/RiderListing');
const Order = require('../models/Order');
const PlatformConfig = require('../models/PlatformConfig');
const { haversineDistanceKm } = require('../utils/geo');
const { computePricing } = require('../utils/pricing');
const { generateOrderNumber } = require('../utils/codes');
const orderService = require('../services/orderService');

exports.dashboard = async (req, res) => {
    const orders = await Order.find({ customer: req.session.user.id }).sort({ createdAt: -1 }).limit(10);
    const activeCount = await Order.countDocuments({
        customer: req.session.user.id,
        status: { $nin: ['completed', 'cancelled'] }
    });
    res.render('customer/dashboard', {
        title: 'My Dispatch Requests',
        currentPage: 'dashboard',
        orders, activeCount
    });
};

exports.newOrderForm = async (req, res) => {
    const config = await PlatformConfig.getSingleton();
    res.render('customer/order-new', { title: 'Request a Rider', currentPage: 'new-order', config });
};

async function getVerifiedRiderIds() {
    const listings = await RiderListing.find({ status: 'approved' }).distinct('rider');
    return listings;
}

exports.createOrder = async (req, res) => {
    try {
        const customerId = req.session.user.id;
        const {
            recipientName, recipientPhone,
            pickupAddress, pickupLat, pickupLng,
            dropoffAddress, dropoffLat, dropoffLng,
            itemsDescription
        } = req.body;

        const config = await PlatformConfig.getSingleton();
        const distanceKm = haversineDistanceKm(
            parseFloat(pickupLat), parseFloat(pickupLng),
            parseFloat(dropoffLat), parseFloat(dropoffLng)
        );
        const pricing = computePricing(config, { distanceKm, itemsValue: 0 });
        const eligibleRiders = await getVerifiedRiderIds();

        const order = await Order.create({
            orderNumber: generateOrderNumber(),
            type: 'public',
            customer: customerId,
            recipientName, recipientPhone,
            pickupAddress, pickupLat, pickupLng,
            dropoffAddress, dropoffLat, dropoffLng,
            distanceKm,
            itemsDescription,
            itemsValue: 0,
            pricing,
            dispatchMode: 'broadcast',
            eligibleRiders,
            timeline: [{ status: 'awaiting_payment', note: 'Request created, awaiting payment.' }]
        });

        res.redirect(`/customer/orders/${order._id}`);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not create request: ' + err.message);
        res.redirect('/customer/orders/new');
    }
};

exports.fundEscrow = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, customer: req.session.user.id });
        if (!order) {
            req.flash('error', 'Request not found.');
            return res.redirect('/customer/dashboard');
        }
        await orderService.fundEscrow(order);
        req.flash('success', `Payment of ₦${order.pricing.totalValue.toLocaleString()} confirmed. Searching for a nearby rider.`);
        res.redirect(`/customer/orders/${order._id}`);
    } catch (err) {
        req.flash('error', 'Could not confirm payment: ' + err.message);
        res.redirect('/customer/dashboard');
    }
};

exports.orderDetail = async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, customer: req.session.user.id }).populate('assignedRider');
    if (!order) {
        req.flash('error', 'Request not found.');
        return res.redirect('/customer/dashboard');
    }
    res.render('customer/order-detail', { title: `Request ${order.orderNumber}`, currentPage: 'dashboard', order });
};

exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, customer: req.session.user.id });
        if (!order) {
            req.flash('error', 'Request not found.');
            return res.redirect('/customer/dashboard');
        }
        if (['picked_up', 'delivered', 'completed'].includes(order.status)) {
            req.flash('error', 'Cannot cancel a request already in transit or completed.');
            return res.redirect(`/customer/orders/${order._id}`);
        }
        order.status = 'cancelled';
        if (order.escrow.status === 'held') order.escrow.status = 'refunded';
        order.timeline.push({ status: 'cancelled', note: 'Request cancelled by customer.' });
        await order.save();
        req.flash('success', 'Request cancelled.');
    } catch (err) {
        req.flash('error', 'Could not cancel request: ' + err.message);
    }
    res.redirect('/customer/dashboard');
};

exports.raiseDispute = async (req, res) => {
    const Dispute = require('../models/Dispute');
    try {
        const order = await Order.findOne({ _id: req.params.id, customer: req.session.user.id });
        if (!order) {
            req.flash('error', 'Request not found.');
            return res.redirect('/customer/dashboard');
        }
        await Dispute.create({ order: order._id, raisedBy: req.session.user.id, reason: req.body.reason });
        order.status = 'disputed';
        order.timeline.push({ status: 'disputed', note: 'Dispute raised by customer.' });
        await order.save();
        req.flash('success', 'Dispute submitted to Adasomi support.');
    } catch (err) {
        req.flash('error', 'Could not raise dispute: ' + err.message);
    }
    res.redirect(`/customer/orders/${req.params.id}`);
};
