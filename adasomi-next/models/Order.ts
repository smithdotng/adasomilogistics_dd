import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type OrderType = 'merchant' | 'public';
export type DispatchMode = 'manual' | 'broadcast';
export type OrderStatus =
    | 'awaiting_payment'
    | 'awaiting_assignment'
    | 'assigned'
    | 'picked_up'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'disputed';
export type EscrowStatus = 'unfunded' | 'held' | 'released' | 'refunded';

export interface OrderPricing {
    baseFee: number;
    perKmRate: number;
    distanceCost: number;
    peakSurcharge: number;
    logisticsCost: number;
    platformFeeRate: number;
    platformFee: number;
    riderPayout: number;
    totalValue: number;
}

export interface TrackingPoint {
    lat: number;
    lng: number;
    at: Date;
}

export interface TimelineEntry {
    status: string;
    note?: string;
    at: Date;
}

export interface IOrder extends Document {
    orderNumber: string;
    type: OrderType;
    merchant?: Types.ObjectId;
    customer?: Types.ObjectId;

    recipientName?: string;
    recipientPhone?: string;

    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;

    dropoffAddress: string;
    dropoffLat: number;
    dropoffLng: number;

    distanceKm: number;

    itemsDescription?: string;
    itemsValue: number;

    pricing: OrderPricing;

    dispatchMode: DispatchMode;
    assignedRider?: Types.ObjectId;
    eligibleRiders: Types.ObjectId[];

    status: OrderStatus;

    escrow: {
        status: EscrowStatus;
        amountHeld: number;
        fundedAt?: Date;
        releasedAt?: Date;
    };

    otp: {
        pickupCode?: string;
        pickupVerifiedAt?: Date;
        deliveryPin?: string;
        deliveryVerifiedAt?: Date;
    };

    tracking: TrackingPoint[];
    timeline: TimelineEntry[];

    createdAt: Date;
    updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
    {
        orderNumber: { type: String, required: true, unique: true },
        type: { type: String, enum: ['merchant', 'public'], required: true },

        merchant: { type: Schema.Types.ObjectId, ref: 'User' },
        customer: { type: Schema.Types.ObjectId, ref: 'User' },

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
        itemsValue: { type: Number, default: 0 },

        pricing: {
            baseFee: Number,
            perKmRate: Number,
            distanceCost: Number,
            peakSurcharge: { type: Number, default: 0 },
            logisticsCost: Number,
            platformFeeRate: Number,
            platformFee: Number,
            riderPayout: Number,
            totalValue: Number
        },

        dispatchMode: { type: String, enum: ['manual', 'broadcast'], default: 'broadcast' },
        assignedRider: { type: Schema.Types.ObjectId, ref: 'User' },
        eligibleRiders: [{ type: Schema.Types.ObjectId, ref: 'User' }],

        status: {
            type: String,
            enum: [
                'awaiting_payment',
                'awaiting_assignment',
                'assigned',
                'picked_up',
                'delivered',
                'completed',
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

        tracking: [
            {
                lat: Number,
                lng: Number,
                at: { type: Date, default: Date.now }
            }
        ],

        timeline: [
            {
                status: String,
                note: String,
                at: { type: Date, default: Date.now }
            }
        ]
    },
    { timestamps: true }
);

export const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema);
