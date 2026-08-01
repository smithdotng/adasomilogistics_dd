import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type RiderListingStatus = 'pending' | 'approved' | 'rejected';

export interface IRiderListing extends Document {
    rider: Types.ObjectId;
    merchant: Types.ObjectId;
    status: RiderListingStatus;
    requestedAt: Date;
    decidedAt?: Date;
    notes?: string;
}

const riderListingSchema = new Schema<IRiderListing>(
    {
        rider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        merchant: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        requestedAt: { type: Date, default: Date.now },
        decidedAt: Date,
        notes: { type: String, trim: true }
    },
    { timestamps: true }
);

riderListingSchema.index({ rider: 1, merchant: 1 }, { unique: true });

export const RiderListing: Model<IRiderListing> =
    mongoose.models.RiderListing || mongoose.model<IRiderListing>('RiderListing', riderListingSchema);
