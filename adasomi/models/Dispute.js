const mongoose = require('mongoose');
const { Schema } = mongoose;

const disputeSchema = new Schema({
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['open', 'investigating', 'resolved', 'rejected'], default: 'open' },
    resolutionNotes: { type: String, trim: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Dispute', disputeSchema);
