import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type DisputeStatus = 'open' | 'investigating' | 'resolved' | 'rejected';

export interface IDispute extends Document {
    order: Types.ObjectId;
    raisedBy: Types.ObjectId;
    reason: string;
    status: DisputeStatus;
    resolutionNotes?: string;
    resolvedBy?: Types.ObjectId;
    resolvedAt?: Date;
    createdAt: Date;
}

const disputeSchema = new Schema<IDispute>(
    {
        order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
        raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, required: true },
        status: { type: String, enum: ['open', 'investigating', 'resolved', 'rejected'], default: 'open' },
        resolutionNotes: { type: String, trim: true },
        resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        resolvedAt: Date
    },
    { timestamps: true }
);

export const Dispute: Model<IDispute> = mongoose.models.Dispute || mongoose.model<IDispute>('Dispute', disputeSchema);
