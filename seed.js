const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seedSuperAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri || !process.env.SUPERADMIN_EMAIL || !process.env.SUPERADMIN_INITIAL_PASSWORD) {
      console.error('🔴 Seed error: Missing required environment variables. Please check MONGO_URI, SUPERADMIN_EMAIL, and SUPERADMIN_INITIAL_PASSWORD.');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);

    const existingSuperAdmin = await User.findOne({ role: 'superAdmin' });
    if (existingSuperAdmin) {
      console.log('ℹ️ Super Admin already exists');
      await mongoose.disconnect();
      return;
    }

    const hashedPassword = await bcrypt.hash(process.env.SUPERADMIN_INITIAL_PASSWORD, 12);

    const superAdmin = new User({
      name: 'Super Admin',
      email: process.env.SUPERADMIN_EMAIL,
      password: hashedPassword,
      role: 'superAdmin',
      isVerified: true
    });

    await superAdmin.save();
    console.log('🎉 Super Admin created successfully!');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('🔴 Seed error:', error.message);
    process.exit(1);
  }
};

seedSuperAdmin();
