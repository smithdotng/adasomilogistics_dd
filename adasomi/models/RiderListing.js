const mongoose = require('mongoose');
const { Schema } = mongoose;

// Represents a rider requesting/being verified into a Commercial Operator's
// preferred fleet. A single rider may hold many listings across operators.
const riderListingSchema = new Schema({
    rider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    merchant: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    requestedAt: { type: Date, default: Date.now },
    decidedAt: Date,
    notes: { type: String, trim: true }
}, { timestamps: true });

riderListingSchema.index({ rider: 1, merchant: 1 }, { unique: true });

module.exports = mongoose.model('RiderListing', riderListingSchema);
