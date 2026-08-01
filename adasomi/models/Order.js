const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
    orderNumber: { type: String, required: true, unique: true },

    // 'merchant' = commercial operator dispatching a customer order (food/produce)
    // 'public'   = individual public user requesting direct parcel pickup/delivery
    type: { type: String, enum: ['merchant', 'public'], required: true },

    merchant: { type: Schema.Types.ObjectId, ref: 'User' }, // present for type=merchant
    customer: { type: Schema.Types.ObjectId, ref: 'User' }, // present for type=public

    // end recipient details (may not be a platform account)
    recipientName: { type: String, trim: true },
    recipientPhone: { type: String, trim: true },

    pickupAddress: { type: String, required: true },
    pickupLat: { type: Number, required: true },
    pickupLng: { type: Number, required: true },

    dropoffAddress: { type: String, required: true },
    dropoffLat: { type: Number, required: true },
    dropoffLng: { type: Number, required: true },

    distanceKm: { type: Number, required: true },

    itemsDescription: { type: String, trim: true },
    itemsValue: { type: Number, default: 0 }, // V_items

    pricing: {
        baseFee: Number,
        perKmRate: Number,
        distanceCost: Number,
        peakSurcharge: { type: Number, default: 0 },
        logisticsCost: Number,       // C_logistics
        platformFeeRate: Number,
        platformFee: Number,         // cut of C_logistics retained by Adasomi
        riderPayout: Number,         // C_logistics - platformFee
        totalValue: Number           // V_items + C_logistics
    },

    dispatchMode: { type: String, enum: ['manual', 'broadcast'], default: 'broadcast' },
    assignedRider: { type: Schema.Types.ObjectId, ref: 'User' },
    eligibleRiders: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    status: {
        type: String,
        enum: [
            'awaiting_payment',      // escrow not yet funded
            'awaiting_assignment',   // funded, waiting for a rider
            'assigned',              // rider accepted, heading to pickup
            'picked_up',             // pickup OTP verified
            'delivered',             // delivery PIN verified, payout pending
            'completed',             // payout settled
            'cancelled',
            'disputed'
        ],
        default: 'awaiting_payment'
    },

    escrow: {
        status: { type: String, enum: ['unfunded', 'held', 'released', 'refunded'], default: 'unfunded' },
        amountHeld: { type: Number, default: 0 },
        fundedAt: Date,
        releasedAt: Date
    },

    otp: {
        pickupCode: String,
        pickupVerifiedAt: Date,
        deliveryPin: String,
        deliveryVerifiedAt: Date
    },

    tracking: [{
        lat: Number,
        lng: Number,
        at: { type: Date, default: Date.now }
    }],

    timeline: [{
        status: String,
        note: String,
        at: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
