import mongoose, { Schema, type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'merchant' | 'rider' | 'public_user';
export type BusinessType = 'food_processor' | 'food_vendor' | 'restaurant' | 'produce_aggregator';
export type VehicleType = 'dispatch_bike' | 'bicycle' | 'car' | 'van';
export type KycStatus = 'submitted' | 'under_review' | 'verified' | 'rejected';

export interface MerchantInfo {
    businessName?: string;
    businessType?: BusinessType;
    address?: string;
}

export interface RiderInfo {
    licenseNumber?: string;
    vehicleType?: VehicleType;
    vehiclePlate?: string;
    kycNotes?: string;
    kycStatus: KycStatus;
    isAvailable: boolean;
    currentLat?: number;
    currentLng?: number;
}

export interface IUser extends Document {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    isActive: boolean;
    isEmailVerified: boolean;
    emailVerificationTokenHash?: string;
    emailVerificationExpires?: Date;
    merchantInfo?: MerchantInfo;
    riderInfo?: RiderInfo;
    createdAt: Date;
    updatedAt: Date;
    fullName: string;
    comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
    {
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

        isEmailVerified: { type: Boolean, default: false },
        emailVerificationTokenHash: { type: String, select: false },
        emailVerificationExpires: { type: Date, select: false },

        merchantInfo: {
            businessName: { type: String, trim: true },
            businessType: {
                type: String,
                enum: ['food_processor', 'food_vendor', 'restaurant', 'produce_aggregator']
            },
            address: { type: String, trim: true }
        },

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
    },
    { timestamps: true }
);

userSchema.virtual('fullName').get(function (this: IUser) {
    return `${this.firstName} ${this.lastName}`;
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = function (candidate: string) {
    return bcrypt.compare(candidate, this.password);
};

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);
