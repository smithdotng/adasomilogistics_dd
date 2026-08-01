const Order = require('../models/Order');

exports.orderTracking = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('assignedRider', 'firstName lastName phone riderInfo');
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const user = req.session.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const isMerchantOwner = order.merchant && order.merchant.toString() === user.id;
        const isCustomerOwner = order.customer && order.customer.toString() === user.id;
        const isAssignedRider = order.assignedRider && order.assignedRider._id.toString() === user.id;
        const isAdmin = user.role === 'admin';

        if (!isMerchantOwner && !isCustomerOwner && !isAssignedRider && !isAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const lastPoint = order.tracking.length ? order.tracking[order.tracking.length - 1] : null;

        res.json({
            status: order.status,
            escrowStatus: order.escrow.status,
            currentLocation: lastPoint ? { lat: lastPoint.lat, lng: lastPoint.lng, at: lastPoint.at } : null,
            trackingHistory: order.tracking,
            assignedRider: order.assignedRider ? {
                name: `${order.assignedRider.firstName} ${order.assignedRider.lastName}`,
                phone: order.assignedRider.phone,
                vehicleType: order.assignedRider.riderInfo ? order.assignedRider.riderInfo.vehicleType : null
            } : null,
            timeline: order.timeline
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
