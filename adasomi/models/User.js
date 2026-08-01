const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const userSchema = new Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['admin', 'merchant', 'rider', 'public_user'],
        required: true
    },
    isActive: { type: Boolean, default: true },

    // Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    // Merchant-specific (Commercial Operators)
    merchantInfo: {
        businessName: { type: String, trim: true },
        businessType: {
            type: String,
            enum: ['food_processor', 'food_vendor', 'restaurant', 'produce_aggregator']
        },
        address: { type: String, trim: true }
    },

    // Rider-specific
    riderInfo: {
        licenseNumber: { type: String, trim: true },
        vehicleType: { type: String, enum: ['dispatch_bike', 'bicycle', 'car', 'van'] },
        vehiclePlate: { type: String, trim: true },
        kycNotes: { type: String, trim: true },
        kycStatus: {
            type: String,
            enum: ['submitted', 'under_review', 'verified', 'rejected'],
            default: 'submitted'
        },
        isAvailable: { type: Boolean, default: true },
        currentLat: Number,
        currentLng: Number
    }
}, { timestamps: true });

userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = function (candidate) {
    return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
