require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adasomi';

// Usage: node seed/createAdmin.js "First" "Last" "email@example.com" "08012345678" "yourPassword"
const [firstName, lastName, email, phone, password] = process.argv.slice(2);

async function run() {
    if (!email || !password) {
        console.log('Usage: node seed/createAdmin.js "First" "Last" "email@example.com" "phone" "password"');
        console.log('Example: node seed/createAdmin.js Jane Doe jane@adasomilogistics.com 08012345678 SuperSecret123');
        process.exit(1);
    }

    await mongoose.connect(MONGODB_URI);
    console.log('Connected...');

    let admin = await User.findOne({ email: email.toLowerCase().trim() });

    if (admin) {
        admin.firstName = firstName || admin.firstName;
        admin.lastName = lastName || admin.lastName;
        admin.phone = phone || admin.phone;
        admin.password = password; // pre-save hook re-hashes this
        admin.role = 'admin';
        admin.isActive = true;
        admin.isEmailVerified = true; // admins created via this trusted CLI skip the email verification step
        await admin.save();
        console.log(`Updated existing user and promoted to admin: ${admin.email}`);
    } else {
        admin = await User.create({
            firstName: firstName || 'Admin',
            lastName: lastName || 'User',
            email: email.toLowerCase().trim(),
            phone: phone || '00000000000',
            password,
            role: 'admin',
            isActive: true,
            isEmailVerified: true
        });
        console.log(`Admin account created: ${admin.email}`);
    }

    await mongoose.connection.close();
    process.exit(0);
}

run().catch(err => {
    console.error('Error creating admin:', err);
    process.exit(1);
});
