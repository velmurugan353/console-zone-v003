const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/consolezone';

// Minimal schemas for seeding
const ProductSchema = new mongoose.Schema({
  id: String,
  name: String,
  category: String,
  price: Number,
  rentalPrice: Number,
  image: String,
  rating: Number,
  reviews: Number,
  inStock: Boolean,
  isRental: Boolean,
  description: String
});

const InventorySchema = new mongoose.Schema({
  name: String,
  consoleId: String,
  category: String,
  status: String,
  health: Number,
  usageCount: Number,
  lastService: Date,
  location: String,
  serialNumber: String,
  purchaseDate: Date,
  basePricePerDay: Number,
  purchasePrice: Number,
  kitRequired: [String],
  maintenanceHistory: Array
});

const Product = mongoose.model('Product', ProductSchema);
const Inventory = mongoose.model('Inventory', InventorySchema);

const products = [
  {
    id: '1',
    name: 'PlayStation 5 Pro',
    category: 'console',
    price: 69990,
    rentalPrice: 2500,
    image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&q=80&w=1000',
    rating: 4.9,
    reviews: 128,
    inStock: true,
    isRental: true,
    description: "The latest PS5 Pro console with 8K gaming support and ultra-high speed SSD."
  },
  {
    id: '2',
    name: 'Xbox Series X',
    category: 'console',
    price: 49990,
    rentalPrice: 2000,
    image: 'https://images.unsplash.com/photo-1621259182902-3b836c824e22?auto=format&fit=crop&q=80&w=1000',
    rating: 4.8,
    reviews: 95,
    inStock: true,
    isRental: true,
    description: "Power your dreams with the fastest, most powerful Xbox ever."
  },
  {
    id: '3',
    name: 'DualSense Edge Controller',
    category: 'controller',
    price: 5990,
    image: 'https://images.unsplash.com/photo-1580327344181-c1163234e5a0?auto=format&fit=crop&q=80&w=1000',
    rating: 4.7,
    reviews: 45,
    inStock: true,
    isRental: false,
    description: "Built with high performance and personalization in mind."
  },
  {
    id: '4',
    name: 'Nintendo Switch OLED',
    category: 'console',
    price: 34990,
    rentalPrice: 1500,
    image: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?auto=format&fit=crop&q=80&w=1000',
    rating: 4.8,
    reviews: 210,
    inStock: true,
    isRental: true,
    description: "7-inch OLED screen for vivid colors and crisp contrast."
  },
  {
    id: '5',
    name: 'Meta Quest 3',
    category: 'vr',
    price: 49990,
    rentalPrice: 3000,
    image: 'https://images.unsplash.com/photo-1622979135225-d2ba269fb1bd?auto=format&fit=crop&q=80&w=1000',
    rating: 4.6,
    reviews: 67,
    inStock: true,
    isRental: true,
    description: "Dive into mixed reality with the most powerful Meta Quest yet."
  },
  {
    id: '6',
    name: 'Elden Ring (PS5)',
    category: 'game',
    price: 4999,
    image: 'https://images.unsplash.com/photo-1642425149556-b6f90e946859?auto=format&fit=crop&q=80&w=1000',
    rating: 5.0,
    reviews: 340,
    inStock: true,
    isRental: false,
    description: "Winner of Game of the Year. An epic fantasy action-RPG."
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB for direct seeding');

    await Product.deleteMany({});
    await Product.insertMany(products);
    console.log('Products seeded successfully');

    const consoleDefs = [
      { id: 'ps5', name: 'Sony PlayStation 5', category: 'Console', count: 5, price: 900, val: 49999 },
      { id: 'xbox', name: 'Xbox Series X', category: 'Console', count: 3, price: 800, val: 44999 },
      { id: 'switch', name: 'Nintendo Switch OLED', category: 'Console', count: 4, price: 600, val: 32999 },
      { id: 'vr', name: 'Meta Quest 3', category: 'VR Gear', count: 2, price: 1200, val: 45999 }
    ];

    const inventoryItems = [];
    for (const consoleDef of consoleDefs) {
      for (let i = 0; i < consoleDef.count; i++) {
        inventoryItems.push({
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
          kitRequired: ['Console', 'Controller', 'HDMI 2.1', 'Power Lead'],
          maintenanceHistory: []
        });
      }
    }

    await Inventory.deleteMany({});
    await Inventory.insertMany(inventoryItems);
    console.log('Inventory seeded successfully');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
