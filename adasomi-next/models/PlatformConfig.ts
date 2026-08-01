import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface PeakWindow {
    startHour: number;
    endHour: number;
}

export interface IPlatformConfig extends Document {
    baseFee: number;
    perKmRate: number;
    peakSurcharge: number;
    peakWindows: PeakWindow[];
    platformCommissionRate: number;
    updatedBy?: Types.ObjectId;
}

interface PlatformConfigModel extends Model<IPlatformConfig> {
    getSingleton(): Promise<IPlatformConfig>;
}

const platformConfigSchema = new Schema<IPlatformConfig>(
    {
        baseFee: { type: Number, default: 500 },
        perKmRate: { type: Number, default: 120 },
        peakSurcharge: { type: Number, default: 300 },
        peakWindows: {
            type: [{ startHour: Number, endHour: Number }],
            default: [
                { startHour: 11, endHour: 14 },
                { startHour: 18, endHour: 21 }
            ]
        },
        platformCommissionRate: { type: Number, default: 0.15 },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

platformConfigSchema.statics.getSingleton = async function () {
    let config = await this.findOne();
    if (!config) config = await this.create({});
    return config;
};

export const PlatformConfig =
    (mongoose.models.PlatformConfig as PlatformConfigModel) ||
    mongoose.model<IPlatformConfig, PlatformConfigModel>('PlatformConfig', platformConfigSchema);
