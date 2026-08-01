require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const RiderListing = require('../models/RiderListing');
const PlatformConfig = require('../models/PlatformConfig');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adasomi';

async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected for seeding...');

    await PlatformConfig.getSingleton();

    const demoUsers = [
        {
            firstName: 'Ada', lastName: 'Admin', email: 'admin@adasomilogistics.com', phone: '08000000000',
            password: 'password123', role: 'admin'
        },
        {
            firstName: 'Tunde', lastName: 'Okafor', email: 'merchant@adasomilogistics.com', phone: '08011111111',
            password: 'password123', role: 'merchant',
            merchantInfo: { businessName: 'Green Harvest Foods', businessType: 'food_vendor', address: '12 Allen Avenue, Ikeja, Lagos' }
        },
        {
            firstName: 'Chidi', lastName: 'Eze', email: 'rider@adasomilogistics.com', phone: '08022222222',
            password: 'password123', role: 'rider',
            riderInfo: { licenseNumber: 'LSD-2024-0091', vehicleType: 'dispatch_bike', vehiclePlate: 'LND-234-KJ', kycStatus: 'verified', isAvailable: true }
        },
        {
            firstName: 'Bisi', lastName: 'Lawal', email: 'user@adasomilogistics.com', phone: '08033333333',
            password: 'password123', role: 'public_user'
        }
    ];

    const created = {};
    for (const data of demoUsers) {
        let user = await User.findOne({ email: data.email });
        if (!user) {
            // Seeded demo accounts are trusted by definition, so skip the
            // email verification step that real sign-ups go through.
            user = await User.create({ ...data, isEmailVerified: true });
            console.log(`Created ${data.role}: ${data.email}`);
        } else {
            console.log(`Already exists: ${data.email}`);
        }
        created[data.role] = user;
    }

    for (const role of ['merchant', 'rider']) {
        const user = created[role];
        if (user) {
            const existing = await Wallet.findOne({ owner: user._id, role });
            if (!existing) await Wallet.create({ owner: user._id, role, balance: 0 });
        }
    }

    if (created.merchant && created.rider) {
        await RiderListing.findOneAndUpdate(
            { rider: created.rider._id, merchant: created.merchant._id },
            {
                $setOnInsert: {
                    rider: created.rider._id,
                    merchant: created.merchant._id,
                    status: 'approved',
                    requestedAt: new Date(),
                    decidedAt: new Date()
                }
            },
            { upsert: true }
        );
        console.log('Linked demo rider to demo merchant fleet.');
    }

    console.log('\nDemo credentials (password: password123):');
    console.log('  Admin:     admin@adasomilogistics.com');
    console.log('  Merchant:  merchant@adasomilogistics.com');
    console.log('  Rider:     rider@adasomilogistics.com');
    console.log('  Public:    user@adasomilogistics.com');

    await mongoose.connection.close();
    process.exit(0);
}

run().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});
