const mongoose = require('mongoose');
const Product = require('./models/Product');
const Rental = require('./models/Rental');
const User = require('./models/User');
const KYC = require('./models/KYC');
const Inventory = require('./models/Inventory');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const rentalCatalog = [
  {
    name: 'Sony PlayStation 5',
    slug: 'ps5',
    image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&q=80&w=800',
    available: 5,
    dailyRate: 500,
    deposit: 5000,
    specs: ['4K Gaming', 'Ultra-High Speed SSD', 'Ray Tracing'],
    included: ['PS5 Console', 'DualSense Controller', 'HDMI 2.1 Cable'],
    condition: 'Excellent'
  },
  {
    name: 'Xbox Series X',
    slug: 'xbox-series-x',
    image: 'https://images.unsplash.com/photo-1621259182978-f09e5e2ca845?auto=format&fit=crop&q=80&w=800',
    available: 3,
    dailyRate: 450,
    deposit: 4500,
    specs: ['True 4K Gaming', '120 FPS Support', 'Velocity Architecture'],
    included: ['Xbox Series X Console', 'Wireless Controller', 'Ultra High Speed HDMI'],
    condition: 'Excellent'
  },
  {
    name: 'Nintendo Switch OLED',
    slug: 'nintendo-switch-oled',
    image: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?auto=format&fit=crop&q=80&w=2000',
    available: 4,
    dailyRate: 350,
    deposit: 3500,
    specs: ['7-inch OLED Screen', '64GB Storage', 'Enhanced Audio'],
    included: ['Console', 'Joy-Con (L/R)', 'Switch Dock', 'HDMI Cable', 'AC Adapter'],
    condition: 'Excellent'
  },
  {
    name: 'Meta Quest 3',
    slug: 'meta-quest-3',
    image: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?auto=format&fit=crop&q=80&w=800',
    available: 2,
    dailyRate: 1200,
    deposit: 10000,
    specs: ['Mixed Reality', '4K+ Infinite Display', 'Snapdragon XR2 Gen 2'],
    included: ['Quest 3 Headset', '2 Touch Plus Controllers', 'Charging Cable'],
    condition: 'Excellent'
  }
];

const products = [
  {
    name: 'DualSense Edge Wireless Controller',
    category: 'controller',
    price: 18999,
    rentalPrice: 499,
    image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&q=80&w=800',
    description: 'Ultra-high performance controller for PS5.',
    inStock: true
  },
  {
    name: 'Xbox Elite Series 2',
    category: 'controller',
    price: 15999,
    rentalPrice: 399,
    image: 'https://images.unsplash.com/photo-1592840331052-16e15c2c6f95?auto=format&fit=crop&q=80&w=800',
    description: "Designed to meet the needs of today's competitive gamers.",
    inStock: true
  },
  {
    name: 'Meta Quest 3 (Retail)',
    category: 'vr',
    price: 49999,
    rentalPrice: 1499,
    image: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?auto=format&fit=crop&q=80&w=800',
    description: 'The most powerful Quest yet.',
    inStock: true
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/consolezone');
    console.log('Connected to MongoDB for seeding...');
    
    await Product.deleteMany({});
    await Product.insertMany(products);

    // Seed Admin User
    await User.deleteMany({ role: 'admin' });
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = new User({
      email: 'admin@consolezone.com',
      username: 'Admin',
      password: adminPassword,
      role: 'admin',
      consolezone_id: 'CZ-ADMIN',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'
    });
    await admin.save();

    // Seed a dummy user
    await User.deleteMany({ email: 'test@example.com' });
    const dummyUser = new User({
      email: 'test@example.com',
      username: 'Test User',
      password: await bcrypt.hash('test123', 10),
      role: 'user',
      consolezone_id: 'CZ-TEST-001',
      kyc_status: 'MANUAL_REVIEW',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'
    });
    await dummyUser.save();

    await Rental.deleteMany({});
    
    // 1. Seed the Catalog (No userId) - These show up on the /rentals page
    await Rental.insertMany(rentalCatalog);

    // 2. Seed some active orders for the dummy user (With userId)
    const activeOrders = rentalCatalog.slice(0, 2).map(r => ({
      ...r,
      userId: dummyUser._id,
      user: dummyUser.username,
      email: dummyUser.email,
      product: r.name,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      totalPrice: r.dailyRate * 7,
      status: 'pending',
      timeline: [{
        status: 'pending',
        timestamp: new Date().toISOString(),
        note: 'Rental deployment requested'
      }]
    }));
    await Rental.insertMany(activeOrders);

    await KYC.deleteMany({});
    const dummyKYC = new KYC({
      userId: dummyUser._id,
      status: 'MANUAL_REVIEW',
      fullName: 'Test User',
      phone: '9876543210',
      drivingLicenseNumber: 'DL-1234567890',
      secondaryIdType: 'AADHAR',
      secondaryIdNumber: '1234-5678-9012',
      address: '123 Cyber Street, Matrix City',
      idFrontUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=400',
      idBackUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=400',
      selfieUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=400',
      selfieVideoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
      livenessCheck: 'PASSED',
      trustScore: 85,
      agentReports: [
        {
          agentName: 'Document Specialist',
          status: 'PASS',
          message: 'Driving License validated.',
          details: 'Extracted Name: Test User, DL: DL-1234567890',
          timestamp: new Date()
        },
        {
          agentName: 'Biometric Analyst',
          status: 'PASS',
          message: 'Facial match successful.',
          details: 'Confidence: 88%',
          timestamp: new Date()
        }
      ]
    });
    await dummyKYC.save();
    
    // Seed Inventory
    const consoleDefs = [
      { id: 'ps5', name: 'Sony PlayStation 5', category: 'Console', count: 5, price: 900, val: 49999 },
      { id: 'xbox-series-x', name: 'Xbox Series X', category: 'Console', count: 3, price: 800, val: 44999 },
      { id: 'nintendo-switch-oled', name: 'Nintendo Switch OLED', category: 'Console', count: 4, price: 600, val: 32999 },
      { id: 'meta-quest-3', name: 'Meta Quest 3', category: 'VR Gear', count: 2, price: 1200, val: 45999 }
    ];

    const inventoryItems = [];
    for (const def of consoleDefs) {
      for (let i = 0; i < def.count; i++) {
        inventoryItems.push({
          name: def.name,
          consoleId: def.id,
          category: def.category,
          status: 'Available',
          health: 100,
          usageCount: 0,
          lastService: new Date(),
          location: 'Secure_Bay_Alpha',
          serialNumber: `SN-${def.id.toUpperCase().substring(0, 5)}-${Math.random().toString(36).substring(7).toUpperCase()}`,
          purchaseDate: new Date(),
          basePricePerDay: def.price,
          purchasePrice: def.val,
          kitRequired: ['Console', 'Controller', 'HDMI 2.1', 'Power Lead']
        });
      }
    }
    await Inventory.deleteMany({});
    await Inventory.insertMany(inventoryItems);

    console.log('✅ Successfully seeded products, catalog, active rentals, admin, dummy KYC, and inventory!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
}

seed();
