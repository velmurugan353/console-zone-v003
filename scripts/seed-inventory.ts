const API_URL = 'http://localhost:5010';

const inventoryItems = [
  { name: 'Sony PlayStation 5', category: 'Console', status: 'available', health: 100, usageCount: 0, location: 'Secure_Bay_Alpha', serialNumber: 'SN-PS5-001', basePricePerDay: 900 },
  { name: 'Sony PlayStation 5', category: 'Console', status: 'available', health: 100, usageCount: 0, location: 'Secure_Bay_Alpha', serialNumber: 'SN-PS5-002', basePricePerDay: 900 },
  { name: 'Xbox Series X', category: 'Console', status: 'available', health: 100, usageCount: 0, location: 'Secure_Bay_Alpha', serialNumber: 'SN-XBOX-001', basePricePerDay: 800 },
  { name: 'Nintendo Switch OLED', category: 'Console', status: 'available', health: 100, usageCount: 0, location: 'Secure_Bay_Alpha', serialNumber: 'SN-SWITCH-001', basePricePerDay: 600 },
  { name: 'Meta Quest 3', category: 'VR Gear', status: 'available', health: 100, usageCount: 0, location: 'Secure_Bay_Alpha', serialNumber: 'SN-VR-001', basePricePerDay: 1200 }
];

async function seedInventory() {
  console.log('Seeding inventory to Matrix API...');
  
  for (const item of inventoryItems) {
    const newItem = {
      ...item,
      lastService: new Date(),
      purchaseDate: new Date(),
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
      warrantyExpiry: new Date(Date.now() + 31536000000),
      insurancePolicy: 'POLICY-GZ-2024',
      insuranceExpiry: new Date(Date.now() + 31536000000),
      depreciationRate: 10
    };
    
    try {
      const response = await fetch(`${API_URL}/api/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      if (response.ok) {
        console.log(`Added unit: ${item.name} (${item.serialNumber})`);
      } else {
        console.error(`Failed to add: ${item.name}`, await response.text());
      }
    } catch (e) {
      console.error(`Error adding ${item.name}:`, e);
    }
  }
  
  console.log('Done!');
}

seedInventory().catch(console.error);
