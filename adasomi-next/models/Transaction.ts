import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type TransactionType =
    | 'escrow_hold'
    | 'payout_items'
    | 'payout_logistics'
    | 'platform_fee'
    | 'refund'
    | 'adjustment';

export interface ITransaction extends Document {
    wallet: Types.ObjectId;
    order?: Types.ObjectId;
    type: TransactionType;
    amount: number;
    balanceAfter: number;
    description?: string;
    createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
    {
        wallet: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
        order: { type: Schema.Types.ObjectId, ref: 'Order' },
        type: {
            type: String,
            enum: ['escrow_hold', 'payout_items', 'payout_logistics', 'platform_fee', 'refund', 'adjustment'],
            required: true
        },
        amount: { type: Number, required: true },
        balanceAfter: { type: Number, required: true },
        description: { type: String, trim: true }
    },
    { timestamps: true }
);

export const Transaction: Model<ITransaction> =
    mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', transactionSchema);
