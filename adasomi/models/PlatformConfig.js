const mongoose = require('mongoose');
const { Schema } = mongoose;

// Singleton document holding platform-wide pricing & commission configuration
const platformConfigSchema = new Schema({
    baseFee: { type: Number, default: 500 },
    perKmRate: { type: Number, default: 120 },
    peakSurcharge: { type: Number, default: 300 },
    peakWindows: {
        type: [{ startHour: Number, endHour: Number }],
        default: [{ startHour: 11, endHour: 14 }, { startHour: 18, endHour: 21 }]
    },
    platformCommissionRate: { type: Number, default: 0.15 }, // 15% of C_logistics
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

platformConfigSchema.statics.getSingleton = async function () {
    let config = await this.findOne();
    if (!config) config = await this.create({});
    return config;
};

module.exports = mongoose.model('PlatformConfig', platformConfigSchema);
