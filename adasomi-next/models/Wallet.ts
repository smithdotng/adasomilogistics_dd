import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type WalletRole = 'merchant' | 'rider' | 'platform';

export interface IWallet extends Document {
    owner?: Types.ObjectId;
    role: WalletRole;
    balance: number;
    currency: string;
}

const walletSchema = new Schema<IWallet>(
    {
        owner: { type: Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['merchant', 'rider', 'platform'], required: true },
        balance: { type: Number, default: 0 },
        currency: { type: String, default: 'NGN' }
    },
    { timestamps: true }
);

export const Wallet: Model<IWallet> = mongoose.models.Wallet || mongoose.model<IWallet>('Wallet', walletSchema);
