import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBEyR7R8g3Ze_yASmU6UJgHt2tL_Ad7fLc",
  authDomain: "console-zone.firebaseapp.com",
  projectId: "console-zone",
  storageBucket: "console-zone.firebasestorage.app",
  messagingSenderId: "27387199701",
  appId: "1:27387199701:web:50bbb9916b9e09ab24e25c",
  measurementId: "G-6L7V22719Y"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const inventoryItems = [
  { name: 'Sony PlayStation 5', category: 'Console', status: 'available', health: 100, usageCount: 0, location: 'Secure_Bay_Alpha', serialNumber: 'SN-PS5-001', basePricePerDay: 900 },
  { name: 'Sony PlayStation 5', category: 'Console', status: 'available', health: 100, usageCount: 0, location: 'Secure_Bay_Alpha', serialNumber: 'SN-PS5-002', basePricePerDay: 900 },
  { name: 'Xbox Series X', category: 'Console', status: 'available', health: 100, usageCount: 0, location: 'Secure_Bay_Alpha', serialNumber: 'SN-XBOX-001', basePricePerDay: 800 },
  { name: 'Nintendo Switch OLED', category: 'Console', status: 'available', health: 100, usageCount: 0, location: 'Secure_Bay_Alpha', serialNumber: 'SN-SWITCH-001', basePricePerDay: 600 },
  { name: 'Meta Quest 3', category: 'VR Gear', status: 'available', health: 100, usageCount: 0, location: 'Secure_Bay_Alpha', serialNumber: 'SN-VR-001', basePricePerDay: 1200 }
];

async function seedInventory() {
  console.log('Seeding inventory to Firestore...');
  
  for (const item of inventoryItems) {
    const newItem = {
      ...item,
      lastService: new Date().toLocaleDateString(),
      purchaseDate: new Date().toISOString(),
      maintenanceHistory: [],
      rentalHistory: [],
      dynamicPricingEnabled: true,
      image: '',
      purchasePrice: 50000,
      totalRevenue: 0,
      kitRequired: ['Console', 'Controller', 'Power Lead'],
      kitStatus: { 'Console': true, 'Controller': true, 'Power Lead': true },
      conditionLogs: [],
      transferHistory: [],
      warrantyExpiry: new Date(Date.now() + 31536000000).toISOString(),
      insurancePolicy: 'POLICY-GZ-2024',
      insuranceExpiry: new Date(Date.now() + 31536000000).toISOString(),
      depreciationRate: 10
    };
    await addDoc(collection(db, 'inventory'), newItem);
    console.log(`Added unit: ${item.name} (${item.serialNumber})`);
  }
  
  console.log('Done! Added units to inventory.');
}

seedInventory().catch(console.error);