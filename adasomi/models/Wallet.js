const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletSchema = new Schema({
    owner: { type: Schema.Types.ObjectId, ref: 'User' }, // null for the platform wallet
    role: { type: String, enum: ['merchant', 'rider', 'platform'], required: true },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'NGN' }
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);
