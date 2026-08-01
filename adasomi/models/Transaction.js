const mongoose = require('mongoose');
const { Schema } = mongoose;

const transactionSchema = new Schema({
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
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
