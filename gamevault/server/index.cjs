const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const User = require('./models/User');
const Product = require('./models/Product');
const Submission = require('./models/Submission');
const Rental = require('./models/Rental');
const KYC = require('./models/KYC');
const Order = require('./models/Order');
const Notification = require('./models/Notification');
const NotificationLog = require('./models/NotificationLog');
const Repair = require('./models/Repair');
const SellRequest = require('./models/SellRequest');
const Inventory = require('./models/Inventory');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'consolezone_secret_key_123';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const PORT = process.env.PORT || 5010;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/consolezone';

// Database Connection with Caching for Serverless
let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  try {
    console.log('⏳ Connecting to MongoDB...');
    cachedConnection = await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    return cachedConnection;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    throw err;
  }
};

app.use(cors());
app.use(express.json());

// Middleware to ensure DB is connected before processing requests
app.use(async (req, res, next) => {
  // Skip DB check for health endpoint if needed, or include it
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed. Please check MONGODB_URI environment variable.' });
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

const generateCZID = () => {
  return 'CZ-' + Math.random().toString(36).substring(2, 7).toUpperCase();
};

// Middleware to verify JWT token
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (ex) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// Middleware to verify Admin role
const admin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

// Auth Routes
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user if they don't exist
      user = new User({
        email,
        username: name,
        password: await bcrypt.hash(Math.random().toString(36), 10), // Random password for social login
        role: 'user',
        consolezone_id: generateCZID()
      });
      await user.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, email: user.email, username: user.username, role: user.role, kyc_status: user.kyc_status, consolezone_id: user.consolezone_id } });
  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(400).json({ error: 'Google authentication failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      email,
      username,
      password: hashedPassword,
      role: 'user',
      consolezone_id: generateCZID()
    });

    await user.save();
    
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id: user._id, email: user.email, username: user.username, role: user.role, kyc_status: user.kyc_status, consolezone_id: user.consolezone_id } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, email: user.email, username: user.username, role: user.role, kyc_status: user.kyc_status, consolezone_id: user.consolezone_id } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Fetch verified address from KYC
    let kyc_address = null;
    if (user.kyc_status === 'APPROVED') {
      const kyc = await KYC.findOne({ userId: user._id });
      if (kyc) kyc_address = kyc.address;
    }

    res.json({ ...user.toObject(), kyc_address });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// User Routes
app.get('/api/users', auth, admin, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id/role', auth, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Product Routes
app.post('/api/products', auth, admin, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inventory Routes
app.get('/api/inventory', auth, admin, async (req, res) => {
  try {
    const items = await Inventory.find().sort({ purchaseDate: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory', auth, admin, async (req, res) => {
  try {
    const item = new Inventory(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/inventory/:id/status', auth, admin, async (req, res) => {
  try {
    const item = await Inventory.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/inventory/:id/maintenance', auth, admin, async (req, res) => {
  try {
    const { type, technician, notes, cost, healthUpdate, nextStatus } = req.body;
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Asset not found' });

    const record = {
      date: new Date(),
      type,
      technician,
      notes,
      cost
    };

    item.maintenanceHistory.push(record);
    if (healthUpdate !== undefined) item.health = healthUpdate;
    if (nextStatus) item.status = nextStatus;
    item.lastService = new Date();

    await item.save();
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/inventory/:id', auth, admin, async (req, res) => {
  try {
    await Inventory.findByIdAndDelete(req.params.id);
    res.json({ message: 'Asset deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/inventory/seed', auth, admin, async (req, res) => {
  try {
    const consoleDefs = [
      { id: 'ps5', name: 'Sony PlayStation 5', category: 'Console', count: 5, price: 900, val: 49999 },
      { id: 'xbox', name: 'Xbox Series X', category: 'Console', count: 3, price: 800, val: 44999 },
      { id: 'switch', name: 'Nintendo Switch OLED', category: 'Console', count: 4, price: 600, val: 32999 },
      { id: 'vr', name: 'Meta Quest 3', category: 'VR Gear', count: 2, price: 1200, val: 45999 }
    ];

    const items = [];
    for (const consoleDef of consoleDefs) {
      for (let i = 0; i < consoleDef.count; i++) {
        items.push({
          name: consoleDef.name,
          consoleId: consoleDef.id,
          category: consoleDef.category,
          status: 'Available',
          health: 100,
          usageCount: 0,
          lastService: new Date(),
          location: 'Secure_Bay_Alpha',
          serialNumber: `SN-${consoleDef.id.toUpperCase()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
          purchaseDate: new Date(),
          basePricePerDay: consoleDef.price,
          purchasePrice: consoleDef.val,
          kitRequired: ['Console', 'Controller', 'HDMI 2.1', 'Power Lead']
        });
      }
    }
    
    await Inventory.deleteMany({});
    const seeded = await Inventory.insertMany(items);
    res.json(seeded);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rental Routes
app.get('/api/rentals', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const rentals = await Rental.find(query).populate('userId', 'username email kyc_status');
    res.json(rentals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rentals/user/:userId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const rentals = await Rental.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(rentals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/rentals/:id', auth, async (req, res) => {
  try {
    const rental = await Rental.findById(req.params.id);
    if (!rental) return res.status(404).json({ error: 'Rental not found' });

    if (req.user.role !== 'admin' && rental.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Only admin can update certain fields
    const updates = req.user.role === 'admin' ? req.body : { status: req.body.status };
    
    const updatedRental = await Rental.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(updatedRental);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/rentals/catalog', auth, admin, async (req, res) => {
  try {
    const rental = new Rental(req.body);
    await rental.save();
    res.status(201).json(rental);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/rentals/:id', auth, admin, async (req, res) => {
  try {
    await Rental.findByIdAndDelete(req.params.id);
    res.json({ message: 'Rental deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const normalizeAddress = (addr) => (addr || '').toLowerCase().replace(/[^a-z0-9]/g, '');

app.post('/api/rentals', auth, async (req, res) => {
  try {
    const { shippingAddress, deliveryMethod, startDate, pickupSlot } = req.body;
    const userId = req.user.id;
    
    // Validate User and KYC
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.kyc_status !== 'APPROVED') {
      return res.status(403).json({ error: 'KYC_NOT_APPROVED: Identity verification required for hardware deployment.' });
    }

    // Verify Address for Delivery
    if (deliveryMethod === 'delivery') {
      const kyc = await KYC.findOne({ userId });
      if (!kyc) return res.status(404).json({ error: 'KYC record not found' });

      if (normalizeAddress(shippingAddress) !== normalizeAddress(kyc.address)) {
        return res.status(403).json({ error: 'ADDRESS_MISMATCH: Deliveries are strictly restricted to your verified KYC residency.' });
      }
    }

    // Check slot availability if pickup slot is specified
    if (pickupSlot && startDate) {
      const slotDate = new Date(startDate).toISOString().split('T')[0];
      const existingPickups = await Rental.countDocuments({
        'pickupSlot.slotId': pickupSlot.slotId,
        startDate: { $gte: new Date(slotDate + 'T00:00:00'), $lt: new Date(slotDate + 'T23:59:59') },
        status: { $nin: ['cancelled', 'completed', 'returned'] }
      });
      const maxBookings = pickupSlot.maxBookings || 3;
      if (existingPickups >= maxBookings) {
        return res.status(409).json({ error: 'SLOT_UNAVAILABLE: This time slot is fully booked. Please select another slot.' });
      }
    }

    // FIRST TIME ONLY HOME DELIVERY DONT ALLOW STORE BICKUP
    if (deliveryMethod === 'pickup') {
      const rentalCount = await Rental.countDocuments({ userId });
      if (rentalCount === 0) {
        return res.status(403).json({ error: 'FIRST_TIME_RESTRICTION: First-time deployment requires Home Delivery for security validation.' });
      }
    }

    const rental = new Rental({ ...req.body, userId });
    await rental.save();
    res.status(201).json(rental);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get slot availability for a specific date
app.get('/api/rentals/slots/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = new Date(date).toISOString().split('T')[0];
    const dayStart = new Date(targetDate + 'T00:00:00');
    const dayEnd = new Date(targetDate + 'T23:59:59');

    const bookings = await Rental.find({
      startDate: { $gte: dayStart, $lt: dayEnd },
      status: { $nin: ['cancelled', 'completed', 'returned'] }
    });

    const slots = [
      { id: 'morning', label: 'Morning', startTime: '10:00', endTime: '12:00', maxBookings: 3 },
      { id: 'midday', label: 'Midday', startTime: '12:00', endTime: '14:00', maxBookings: 3 },
      { id: 'afternoon', label: 'Afternoon', startTime: '14:00', endTime: '16:00', maxBookings: 3 },
      { id: 'late-afternoon', label: 'Late Afternoon', startTime: '16:00', endTime: '18:00', maxBookings: 3 },
      { id: 'evening', label: 'Evening', startTime: '18:00', endTime: '20:00', maxBookings: 3 }
    ];

    const slotAvailability = slots.map(slot => {
      const slotBookings = bookings.filter(b => b.pickupSlot?.slotId === slot.id);
      return {
        ...slot,
        bookedCount: slotBookings.length,
        available: slot.maxBookings - slotBookings.length,
        isAvailable: slot.maxBookings - slotBookings.length > 0
      };
    });

    res.json(slotAvailability);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventory/available', async (req, res) => {
  try {
    const { startDate, endDate, consoleId } = req.query;
    if (!startDate || !endDate || !consoleId) {
      return res.status(400).json({ error: 'Missing required parameters: startDate, endDate, consoleId' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // 1. Get all units for this consoleId
    const units = await Inventory.find({ consoleId, status: { $ne: 'Retired' } });
    
    // 2. Get all overlapping rentals
    const overlappingRentals = await Rental.find({
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ],
      status: { $nin: ['cancelled', 'completed', 'returned'] }
    });

    const rentedUnitIds = overlappingRentals.map(r => r.unitId);
    
    const availableUnits = units.filter(u => !rentedUnitIds.includes(u._id.toString()) && u.status === 'Available');

    res.json({
      available: availableUnits.length,
      units: availableUnits.map(u => ({ id: u._id, serialNumber: u.serialNumber })),
      total: units.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KYC Routes
app.post('/api/kyc/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

app.get('/api/kyc-all', auth, admin, async (req, res) => {
  try {
    const kycs = await KYC.find().sort({ submittedAt: -1 });
    res.json(kycs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/kyc/:userId', auth, admin, async (req, res) => {
  try {
    const { userId } = req.params;
    await KYC.findOneAndDelete({ userId });
    await User.findByIdAndUpdate(userId, { 
      kyc_status: null,
      kyc_resubmissions: 0
    });
    res.json({ message: 'KYC record purged and status reset.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/kyc/:userId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const kyc = await KYC.findOne({ userId: req.params.userId });
    res.json(kyc || { status: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/kyc', auth, async (req, res) => {
  try {
    const { userId, ...data } = req.body;
    
    if (req.user.id !== userId) return res.status(403).json({ error: 'Access denied.' });

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if resubmission is allowed (only for rejected or reverification requested KYC)
    const existingKyc = await KYC.findOne({ userId });
    if (existingKyc?.status === 'REJECTED' && !existingKyc.resubmissionAllowed) {
      return res.status(403).json({ error: 'KYC_REJECTED_PERMANENT: Further resubmissions are not allowed.' });
    }

    const canResubmit = !existingKyc || existingKyc.status === 'REJECTED' || existingKyc.status === 'REVERIFICATION_REQUESTED';
    if (!canResubmit) {
      return res.status(400).json({ error: 'KYC_ALREADY_EXISTS: A verification process is already active or complete.' });
    }

    // Check resubmission limit (max 3 attempts)
    const resubmissions = user.kyc_resubmissions || 0;
    if (existingKyc?.status === 'REJECTED' && resubmissions >= 3) {
      await KYC.findOneAndUpdate({ userId }, { resubmissionAllowed: false });
      return res.status(403).json({ error: 'KYC_LIMIT_EXCEEDED: Maximum resubmission attempts (3) reached.' });
    }

    // Backend Agent Simulation
    const reports = [
      {
        agentName: 'Document Specialist',
        status: 'PASS',
        message: 'Primary ID validated. OCR successfully extracted data.',
        details: `Extracted Name: ${data.fullName}, ID: ${data.drivingLicenseNumber}`,
        timestamp: new Date()
      }
    ];

    // Validate secondary ID if provided
    if (data.secondaryIdType) {
      reports.push({
        agentName: 'Document Specialist',
        status: 'PASS',
        message: `Secondary ID (${data.secondaryIdType.toUpperCase()}) validated.`,
        details: `Secondary ID Number: ${data.secondaryIdNumber}`,
        timestamp: new Date()
      });
    }

    reports.push(
      {
        agentName: 'Biometric Analyst',
        status: 'PASS',
        message: 'Facial match successful. Confidence: 92%',
        details: 'Live video liveness check PASSED.',
        timestamp: new Date()
      },
      {
        agentName: 'Compliance Officer',
        status: 'PASS',
        message: 'No risk indicators found.',
        details: 'Social records verified.',
        timestamp: new Date()
      }
    );

    const trustScore = 95;
    const status = 'MANUAL_REVIEW';

    const kycUpdate = { 
      ...data, 
      agentReports: reports,
      trustScore,
      status,
      updatedAt: Date.now(),
      submittedAt: existingKyc?.status === 'REJECTED' ? new Date() : existingKyc?.submittedAt || new Date(),
      resubmissionAllowed: true,
      rejectionReason: null
    };

    const kyc = await KYC.findOneAndUpdate(
      { userId },
      kycUpdate,
      { upsert: true, new: true }
    );

    // Update User KYC Status and resubmission count
    const userUpdate = { 
      kyc_status: status,
      last_kyc_submission: new Date()
    };
    
    if (existingKyc?.status === 'REJECTED') {
      userUpdate.kyc_resubmissions = resubmissions + 1;
    }

    await User.findByIdAndUpdate(userId, userUpdate);

    res.json(kyc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/kyc/:id/status', auth, admin, async (req, res) => {
  try {
    const { status, notes, verifiedBy, verifiedAt, rejectionReason, allowResubmission } = req.body;
    const updateData = {
      status,
      adminNotes: notes,
      verifiedBy,
      verifiedAt
    };

    if (status === 'REJECTED' || status === 'REVERIFICATION_REQUESTED') {
      updateData.rejectionReason = rejectionReason || 'Documents did not meet verification criteria.';
      updateData.resubmissionAllowed = allowResubmission !== false;
    }

    const kyc = await KYC.findByIdAndUpdate(      req.params.id,
      updateData,
      { new: true }
    );
    
    if (kyc) {
      await User.findByIdAndUpdate(kyc.userId, { kyc_status: status });
    }
    
    res.json(kyc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Order Routes
app.get('/api/orders', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const orders = await Order.find(query).sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/user/:userId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const orders = await Order.find({ userId: req.params.userId }).sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', auth, async (req, res) => {
  try {
    const { shippingAddress } = req.body;
    const userId = req.user.id;
    
    // Validate User and KYC
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.kyc_status !== 'APPROVED') {
      return res.status(403).json({ error: 'KYC_NOT_APPROVED: Identity verification required for orders.' });
    }

    // Verify Address
    const kyc = await KYC.findOne({ userId });
    if (!kyc) return res.status(404).json({ error: 'KYC record not found' });

    if (normalizeAddress(shippingAddress) !== normalizeAddress(kyc.address)) {
      return res.status(403).json({ error: 'ADDRESS_MISMATCH: Deliveries are strictly restricted to your verified KYC residency.' });
    }

    const orderCount = await Order.countDocuments({ userId });
    const rentalCount = await Rental.countDocuments({ userId });
    if (orderCount === 0 && rentalCount === 0) {
      if (req.body.deliveryMethod === 'pickup') {
        return res.status(403).json({ error: 'FIRST_TIME_RESTRICTION: First-time orders require Home Delivery for security validation.' });
      }
    }

    const order = new Order({ ...req.body, userId });
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/orders/:id', auth, admin, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Notification Routes
app.get('/api/notifications/:userId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const notifications = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications', auth, admin, async (req, res) => {
  try {
    const notification = new Notification(req.body);
    await notification.save();
    res.status(201).json(notification);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/notifications/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.userId.toString() !== req.user.id) return res.status(403).json({ error: 'Access denied.' });

    notification.read = true;
    await notification.save();
    res.json(notification);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Notification Log Routes (MongoDB)
app.get('/api/notification-logs', auth, admin, async (req, res) => {
  try {
    const { customerId, rentalId, status, channel, page = 1, limit = 50 } = req.query;
    const query = {};
    if (customerId) query.customerId = customerId;
    if (rentalId) query.rentalId = rentalId;
    if (status) query.status = status;
    if (channel) query.channels = channel;

    const logs = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const total = await NotificationLog.countDocuments(query);
    res.json({ logs, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notification-logs', auth, admin, async (req, res) => {
  try {
    const { templateId, templateName, customerId, customerName, customerEmail, customerPhone, channels, status, subject, body, rentalId, trigger, metadata, deliveryResults } = req.body;
    const logId = `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    const log = new NotificationLog({
      logId,
      templateId,
      templateName,
      customerId,
      customerName: customerName || 'Unknown',
      customerEmail: customerEmail || '',
      customerPhone,
      channels: channels || [],
      status: status || 'sent',
      subject,
      body,
      rentalId,
      trigger,
      metadata: metadata || {},
      deliveryResults: deliveryResults || []
    });
    
    await log.save();
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/notification-logs/stats', auth, admin, async (req, res) => {
  try {
    const total = await NotificationLog.countDocuments();
    const sent = await NotificationLog.countDocuments({ status: { $in: ['sent', 'delivered', 'opened'] } });
    const failed = await NotificationLog.countDocuments({ status: 'failed' });
    const pending = await NotificationLog.countDocuments({ status: 'pending' });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await NotificationLog.countDocuments({ createdAt: { $gte: today } });

    const byChannel = await NotificationLog.aggregate([
      { $unwind: '$channels' },
      { $group: { _id: '$channels', count: { $sum: 1 } } }
    ]);

    const byTemplate = await NotificationLog.aggregate([
      { $group: { _id: '$templateName', count: { $sum: 1 } } }
    ]);

    const channelStats = {};
    byChannel.forEach(c => { channelStats[c._id] = c.count; });
    
    const templateStats = {};
    byTemplate.forEach(t => { templateStats[t._id] = t.count; });

    res.json({
      total,
      sent,
      failed,
      pending,
      todayCount,
      byChannel: channelStats,
      byTemplate: templateStats,
      successRate: total > 0 ? ((sent / total) * 100).toFixed(1) : '0'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/notification-logs/:id/status', auth, admin, async (req, res) => {
  try {
    const log = await NotificationLog.findOneAndUpdate(
      { logId: req.params.id },
      { status: req.body.status, deliveryResults: req.body.deliveryResults },
      { new: true }
    );
    res.json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Repair Routes
app.get('/api/repairs', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const repairs = await Repair.find(query).sort({ createdAt: -1 });
    res.json(repairs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/repairs/:id', auth, admin, async (req, res) => {
  try {
    const repair = await Repair.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(repair);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/repairs', auth, async (req, res) => {
  try {
    const repair = new Repair({ ...req.body, userId: req.user.id });
    await repair.save();
    res.status(201).json(repair);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// SellRequest Routes
app.get('/api/sell-requests', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const requests = await SellRequest.find(query).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sell-requests/:id', auth, admin, async (req, res) => {
  try {
    const request = await SellRequest.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sell-requests', auth, async (req, res) => {
  try {
    const request = new SellRequest({ ...req.body, userId: req.user.id });
    await request.save();
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Submission Route (Forms & Photos)
app.post('/api/submit', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]), async (req, res) => {
  try {
    const { customerName, email, message } = req.body;
    
    const submissionData = {
      customerName,
      email,
      message,
      photoUrl: req.files['photo'] ? `/uploads/${req.files['photo'][0].filename}` : null,
      documentUrl: req.files['document'] ? `/uploads/${req.files['document'][0].filename}` : null
    };

    const submission = new Submission(submissionData);
    await submission.save();
    
    res.status(201).json({ 
      message: '✅ Submission received!', 
      data: submission 
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
}

module.exports = app;
