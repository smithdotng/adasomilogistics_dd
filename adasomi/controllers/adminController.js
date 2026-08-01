const User = require('../models/User');
const RiderListing = require('../models/RiderListing');
const Order = require('../models/Order');
const Dispute = require('../models/Dispute');
const PlatformConfig = require('../models/PlatformConfig');
const moment = require('moment');

exports.dashboard = async (req, res) => {
    const [merchantCount, riderCount, publicUserCount, totalOrders, completedOrders, disputedOrders, openDisputes] = await Promise.all([
        User.countDocuments({ role: 'merchant' }),
        User.countDocuments({ role: 'rider' }),
        User.countDocuments({ role: 'public_user' }),
        Order.countDocuments(),
        Order.countDocuments({ status: 'completed' }),
        Order.countDocuments({ status: 'disputed' }),
        Dispute.countDocuments({ status: { $in: ['open', 'investigating'] } })
    ]);

    // Verification Time KPI: avg hours between request and decision for approved listings
    const decidedListings = await RiderListing.find({ status: 'approved', decidedAt: { $exists: true } });
    let avgVerificationHours = 0;
    if (decidedListings.length) {
        const totalHours = decidedListings.reduce((sum, l) => sum + moment(l.decidedAt).diff(moment(l.requestedAt), 'hours', true), 0);
        avgVerificationHours = Math.round((totalHours / decidedListings.length) * 10) / 10;
    }

    // Order Completion Rate KPI
    const settledOrders = completedOrders + disputedOrders;
    const completionRate = settledOrders ? Math.round((completedOrders / settledOrders) * 1000) / 10 : 0;

    // Payout Velocity KPI: avg seconds between delivery PIN verification and escrow release
    const payoutOrders = await Order.find({ status: 'completed', 'otp.deliveryVerifiedAt': { $exists: true }, 'escrow.releasedAt': { $exists: true } }).limit(200);
    let avgPayoutSeconds = 0;
    if (payoutOrders.length) {
        const totalSeconds = payoutOrders.reduce((sum, o) => sum + moment(o.escrow.releasedAt).diff(moment(o.otp.deliveryVerifiedAt), 'seconds', true), 0);
        avgPayoutSeconds = Math.round((totalSeconds / payoutOrders.length) * 10) / 10;
    }

    // Rider Utilization KPI: % of riders with >=5 completed trips in the last 7 days
    const sinceDate = moment().subtract(7, 'days').toDate();
    const riders = await User.find({ role: 'rider' });
    let utilizedCount = 0;
    for (const rider of riders) {
        const trips = await Order.countDocuments({ assignedRider: rider._id, status: 'completed', updatedAt: { $gte: sinceDate } });
        if (trips >= 5) utilizedCount++;
    }
    const riderUtilizationRate = riders.length ? Math.round((utilizedCount / riders.length) * 1000) / 10 : 0;

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(8).populate('merchant').populate('customer').populate('assignedRider');

    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        currentPage: 'dashboard',
        merchantCount, riderCount, publicUserCount, totalOrders,
        completedOrders, disputedOrders, openDisputes,
        avgVerificationHours, completionRate, avgPayoutSeconds, riderUtilizationRate,
        recentOrders
    });
};

exports.riders = async (req, res) => {
    const riders = await User.find({ role: 'rider' }).sort({ createdAt: -1 });
    const listingCounts = await RiderListing.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: '$rider', count: { $sum: 1 } } }
    ]);
    const countsMap = {};
    listingCounts.forEach(c => { countsMap[c._id.toString()] = c.count; });
    res.render('admin/riders', { title: 'Rider KYC Audit', currentPage: 'riders', riders, countsMap });
};

exports.decideKyc = async (req, res) => {
    try {
        const { riderId, kycStatus } = req.body;
        await User.findByIdAndUpdate(riderId, { 'riderInfo.kycStatus': kycStatus });
        req.flash('success', 'KYC status updated.');
    } catch (err) {
        req.flash('error', 'Could not update KYC status: ' + err.message);
    }
    res.redirect('/admin/riders');
};

exports.orders = async (req, res) => {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(100).populate('merchant').populate('customer').populate('assignedRider');
    res.render('admin/orders', { title: 'All Orders', currentPage: 'orders', orders });
};

exports.disputes = async (req, res) => {
    const disputes = await Dispute.find().sort({ createdAt: -1 }).populate('order').populate('raisedBy');
    res.render('admin/disputes', { title: 'Disputes', currentPage: 'disputes', disputes });
};

exports.resolveDispute = async (req, res) => {
    try {
        const { disputeId, decision, resolutionNotes } = req.body;
        const dispute = await Dispute.findById(disputeId);
        if (!dispute) {
            req.flash('error', 'Dispute not found.');
            return res.redirect('/admin/disputes');
        }
        dispute.status = decision === 'resolve' ? 'resolved' : 'rejected';
        dispute.resolutionNotes = resolutionNotes;
        dispute.resolvedBy = req.session.user.id;
        dispute.resolvedAt = new Date();
        await dispute.save();
        req.flash('success', 'Dispute updated.');
    } catch (err) {
        req.flash('error', 'Could not update dispute: ' + err.message);
    }
    res.redirect('/admin/disputes');
};

exports.config = async (req, res) => {
    const config = await PlatformConfig.getSingleton();
    res.render('admin/config', { title: 'Platform Configuration', currentPage: 'config', config });
};

exports.updateConfig = async (req, res) => {
    try {
        const { baseFee, perKmRate, peakSurcharge, platformCommissionRate } = req.body;
        const config = await PlatformConfig.getSingleton();
        config.baseFee = parseFloat(baseFee);
        config.perKmRate = parseFloat(perKmRate);
        config.peakSurcharge = parseFloat(peakSurcharge);
        config.platformCommissionRate = parseFloat(platformCommissionRate);
        config.updatedBy = req.session.user.id;
        await config.save();
        req.flash('success', 'Platform configuration updated.');
    } catch (err) {
        req.flash('error', 'Could not update configuration: ' + err.message);
    }
    res.redirect('/admin/config');
};
