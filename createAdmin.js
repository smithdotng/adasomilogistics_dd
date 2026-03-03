const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const admin = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@care.com',
      password: 'admin123', // Change this in production
      role: 'admin',
      phone: '+1234567890',
      isActive: true
    });
    
    await admin.save();
    console.log('Admin user created successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error creating admin:', err);
    process.exit(1);
  });