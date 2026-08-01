require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adasomi';

// One-time migration helper: marks every account that predates the email
// verification feature as already verified, so existing users aren't locked
// out of accounts they created before this requirement existed.
async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected...');

    const result = await User.updateMany(
        { isEmailVerified: { $ne: true } },
        { $set: { isEmailVerified: true } }
    );

    console.log(`Marked ${result.modifiedCount} existing account(s) as email-verified.`);

    await mongoose.connection.close();
    process.exit(0);
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
