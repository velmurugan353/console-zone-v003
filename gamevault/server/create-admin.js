const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Force 127.0.0.1 to avoid IPv6 issues with 'localhost'
const MONGODB_URI = 'mongodb://127.0.0.1:27017/consolezone';

async function createAdmin() {
  try {
    console.log('Connecting to MongoDB at:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const adminEmail = 'admin@consolezone.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('Admin user already exists. Updating password and role...');
      existingAdmin.password = await bcrypt.hash('admin123', 10);
      existingAdmin.role = 'admin';
      if (!existingAdmin.consolezone_id) existingAdmin.consolezone_id = 'CZ-ADMIN';
      await existingAdmin.save();
      console.log('✅ Admin user updated successfully');
    } else {
      console.log('Creating new admin user...');
      const adminPassword = await bcrypt.hash('admin123', 10);
      const admin = new User({
        email: adminEmail,
        username: 'Admin',
        password: adminPassword,
        role: 'admin',
        consolezone_id: 'CZ-ADMIN',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'
      });
      await admin.save();
      console.log('✅ Admin user created successfully');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

createAdmin();
