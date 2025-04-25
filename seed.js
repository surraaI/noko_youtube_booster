const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const existingSuperAdmin = await User.findOne({ role: 'superAdmin' });
    if (!existingSuperAdmin) {
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
    } else {
      console.log('ℹ️ Super Admin already exists');
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('🔴 Seed error:', error.message);
    process.exit(1);
  }
};

seedSuperAdmin();