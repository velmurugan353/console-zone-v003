import { notificationService } from './notificationService';
import { getControllerSettings } from './controller-settings';

export interface AutomationRules {
  autoReduceStock: boolean;
  autoDisableOutOfStock: boolean;
  autoBlockRentalDates: boolean;
  autoApplyLatePenalty: boolean;
  autoNotifyAdminOnLowStock: boolean;
  lowStockThreshold: number;
  latePenaltyPerDay: number;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  kycStatus?: string;
  totalRentals: number;
  activeRentals: number;
  completedRentals: number;
  cancelledRentals: number;
  totalSpent: number;
  totalLateFees: number;
  totalRepairCosts: number;
  depositBalance: number;
  lastRentalDate?: string;
  firstRentalDate?: string;
  riskScore: 'low' | 'medium' | 'high';
  notes: string;
  createdAt: string;
}

export interface RentalHistoryEntry {
  id: string;
  rentalId: string;
  unitId: string;
  customer: string;
  customerId?: string;
  email: string;
  phone?: string;
  product: string;
  startDate: string;
  endDate: string;
  actualReturnDate?: string;
  totalPrice: number;
  deposit: number;
  status: 'active' | 'completed' | 'late' | 'cancelled' | 'pending';
  checkOutAt?: string;
  checkInAt?: string;
  returnCondition?: 'good' | 'minor' | 'major';
  repairCost: number;
  lateFee: number;
  depositRefunded: boolean;
  notes: string;
  createdAt: string;
}

export interface MaintenanceEntry {
  id: string;
  unitId: string;
  date: string;
  type: string;
  technician: string;
  notes: string;
  cost: number;
  triggeredBy: string;
}

export interface AutomationLog {
  id: string;
  timestamp: string;
  type: 'checkout' | 'checkin' | 'cancel' | 'booking' | 'maintenance' | 'notification' | 'penalty' | 'refund';
  rentalId: string;
  customerId: string;
  customerName: string;
  message: string;
  status: 'success' | 'failed' | 'pending';
}

export const DEFAULT_RULES: AutomationRules = {
  autoReduceStock: true,
  autoDisableOutOfStock: true,
  autoBlockRentalDates: true,
  autoApplyLatePenalty: true,
  autoNotifyAdminOnLowStock: true,
  lowStockThreshold: 5,
  latePenaltyPerDay: 500
};

class RentalAutomationService {
  private rules: AutomationRules = { ...DEFAULT_RULES };
  private alertedProducts: Set<string> = new Set();

  getRules() {
    return this.rules;
  }

  updateRules(newRules: Partial<AutomationRules>) {
    this.rules = { ...this.rules, ...newRules };
  }

  // =================== DATABASE HELPERS ===================

  getRentalHistory(): RentalHistoryEntry[] {
    const stored = localStorage.getItem('rentalHistory');
    return stored ? JSON.parse(stored) : [];
  }

  saveRentalHistory(history: RentalHistoryEntry[]) {
    localStorage.setItem('rentalHistory', JSON.stringify(history));
  }

  getMaintenanceHistory(): MaintenanceEntry[] {
    const stored = localStorage.getItem('maintenanceHistory');
    return stored ? JSON.parse(stored) : [];
  }

  saveMaintenanceHistory(history: MaintenanceEntry[]) {
    localStorage.setItem('maintenanceHistory', JSON.stringify(history));
  }

  getInventory(): any[] {
    const stored = localStorage.getItem('rentalInventory');
    return stored ? JSON.parse(stored) : [];
  }

  saveInventory(inventory: any[]) {
    localStorage.setItem('rentalInventory', JSON.stringify(inventory));
  }

  getAutomationLogs(): AutomationLog[] {
    const stored = localStorage.getItem('automationLogs');
    return stored ? JSON.parse(stored) : [];
  }

  saveAutomationLogs(logs: AutomationLog[]) {
    localStorage.setItem('automationLogs', JSON.stringify(logs));
  }

  addLog(entry: Omit<AutomationLog, 'id' | 'timestamp'>) {
    const logs = this.getAutomationLogs();
    const newLog: AutomationLog = {
      ...entry,
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog);
    if (logs.length > 500) logs.length = 500;
    this.saveAutomationLogs(logs);
    return newLog;
  }

  // =================== CUSTOMER MANAGEMENT ===================

  getCustomers(): CustomerProfile[] {
    const stored = localStorage.getItem('customerProfiles');
    return stored ? JSON.parse(stored) : [];
  }

  saveCustomers(customers: CustomerProfile[]) {
    localStorage.setItem('customerProfiles', JSON.stringify(customers));
  }

  getOrCreateCustomer(customerData: { name: string; email: string; phone?: string }): CustomerProfile {
    const customers = this.getCustomers();
    let customer = customers.find(c => c.email === customerData.email);

    if (!customer) {
      customer = {
        id: `CUST-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        totalRentals: 0,
        activeRentals: 0,
        completedRentals: 0,
        cancelledRentals: 0,
        totalSpent: 0,
        totalLateFees: 0,
        totalRepairCosts: 0,
        depositBalance: 0,
        riskScore: 'low',
        notes: '',
        createdAt: new Date().toISOString()
      };
      customers.push(customer);
      this.saveCustomers(customers);
      console.log(`[CUSTOMER_DB] New customer created: ${customer.id}`);
    }

    return customer;
  }

  getCustomerById(customerId: string): CustomerProfile | null {
    const customers = this.getCustomers();
    return customers.find(c => c.id === customerId) || null;
  }

  getCustomerByEmail(email: string): CustomerProfile | null {
    const customers = this.getCustomers();
    return customers.find(c => c.email === email) || null;
  }

  updateCustomerProfile(customerId: string, updates: Partial<CustomerProfile>) {
    const customers = this.getCustomers();
    const index = customers.findIndex(c => c.id === customerId);
    if (index === -1) return null;
    customers[index] = { ...customers[index], ...updates };
    this.saveCustomers(customers);
    return customers[index];
  }

  addCustomerNote(customerId: string, note: string) {
    const customers = this.getCustomers();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return null;
    const timestamp = new Date().toLocaleString();
    customer.notes = customer.notes ? `${customer.notes}\n[${timestamp}] ${note}` : `[${timestamp}] ${note}`;
    this.saveCustomers(customers);
    return customer;
  }

  recalculateCustomerStats(customerId: string) {
    const history = this.getRentalHistory();
    const customerRentals = history.filter(r => r.customerId === customerId || r.email === this.getCustomerById(customerId)?.email);

    const totalRentals = customerRentals.length;
    const activeRentals = customerRentals.filter(r => r.status === 'active').length;
    const completedRentals = customerRentals.filter(r => r.status === 'completed').length;
    const cancelledRentals = customerRentals.filter(r => r.status === 'cancelled').length;
    const totalSpent = customerRentals.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.totalPrice + (r.lateFee || 0) + (r.repairCost || 0), 0);
    const totalLateFees = customerRentals.reduce((sum, r) => sum + (r.lateFee || 0), 0);
    const totalRepairCosts = customerRentals.reduce((sum, r) => sum + (r.repairCost || 0), 0);

    let riskScore: 'low' | 'medium' | 'high' = 'low';
    if (totalLateFees > 1000 || (totalRentals > 0 && cancelledRentals / totalRentals > 0.3)) {
      riskScore = 'high';
    } else if (totalLateFees > 500 || cancelledRentals > 0) {
      riskScore = 'medium';
    }

    const lastRental = customerRentals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const firstRental = customerRentals.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

    return {
      totalRentals,
      activeRentals,
      completedRentals,
      cancelledRentals,
      totalSpent,
      totalLateFees,
      totalRepairCosts,
      riskScore,
      lastRentalDate: lastRental?.createdAt,
      firstRentalDate: firstRental?.createdAt
    };
  }

  // =================== RENTAL HISTORY MANAGEMENT ===================

  addRentalEntry(entry: Omit<RentalHistoryEntry, 'id' | 'createdAt'>) {
    const history = this.getRentalHistory();
    const newEntry: RentalHistoryEntry = {
      ...entry,
      id: `RNT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      createdAt: new Date().toISOString()
    };
    history.push(newEntry);
    this.saveRentalHistory(history);

    if (entry.customerId) {
      this.getOrCreateCustomer({ name: entry.customer, email: entry.email, phone: entry.phone });
      const stats = this.recalculateCustomerStats(entry.customerId);
      if (stats) {
        this.updateCustomerProfile(entry.customerId, stats);
      }
    }

    this.addLog({
      type: 'booking',
      rentalId: newEntry.id,
      customerId: entry.customerId || '',
      customerName: entry.customer,
      message: `New rental booking: ${entry.product}`,
      status: 'success'
    });

    console.log(`[RENTAL_DB] New rental entry: ${newEntry.id}`);
    return newEntry;
  }

  updateRentalEntry(rentalId: string, updates: Partial<RentalHistoryEntry>) {
    const history = this.getRentalHistory();
    const index = history.findIndex(r => r.id === rentalId || r.rentalId === rentalId);
    if (index === -1) {
      console.warn(`[RENTAL_DB] Rental not found: ${rentalId}`);
      return null;
    }
    history[index] = { ...history[index], ...updates };
    this.saveRentalHistory(history);

    if (history[index].customerId) {
      const stats = this.recalculateCustomerStats(history[index].customerId!);
      if (stats) {
        this.updateCustomerProfile(history[index].customerId!, stats);
      }
    }

    console.log(`[RENTAL_DB] Updated rental: ${rentalId}`, updates);
    return history[index];
  }

  getRentalById(rentalId: string): RentalHistoryEntry | null {
    const history = this.getRentalHistory();
    return history.find(r => r.id === rentalId || r.rentalId === rentalId) || null;
  }

  getRentalsByUnitId(unitId: string): RentalHistoryEntry[] {
    const history = this.getRentalHistory();
    return history.filter(r => r.unitId === unitId);
  }

  getRentalsByCustomer(customerId: string): RentalHistoryEntry[] {
    const history = this.getRentalHistory();
    return history.filter(r => r.customerId === customerId);
  }

  getActiveRentals(): RentalHistoryEntry[] {
    const history = this.getRentalHistory();
    return history.filter(r => r.status === 'active' || r.status === 'late');
  }

  getPendingRentals(): RentalHistoryEntry[] {
    const history = this.getRentalHistory();
    return history.filter(r => r.status === 'pending');
  }

  // =================== MAINTENANCE HISTORY ===================

  addMaintenanceEntry(entry: Omit<MaintenanceEntry, 'id'>) {
    const history = this.getMaintenanceHistory();
    const newEntry: MaintenanceEntry = {
      ...entry,
      id: `MNT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    };
    history.push(newEntry);
    this.saveMaintenanceHistory(history);

    this.addLog({
      type: 'maintenance',
      rentalId: entry.triggeredBy,
      customerId: '',
      customerName: 'System',
      message: `Maintenance on ${entry.unitId}: ${entry.type}`,
      status: 'success'
    });

    console.log(`[MAINT_DB] New maintenance entry: ${newEntry.id}`);
    return newEntry;
  }

  getMaintenanceByUnitId(unitId: string): MaintenanceEntry[] {
    const history = this.getMaintenanceHistory();
    return history.filter(m => m.unitId === unitId);
  }

  // =================== INVENTORY MANAGEMENT ===================

  updateUnitStatus(unitId: string, status: string, health?: number) {
    const inventory = this.getInventory();
    const index = inventory.findIndex((u: any) => u.id === unitId || u._id === unitId);
    if (index === -1) {
      console.warn(`[INVENTORY_DB] Unit not found: ${unitId}`);
      return null;
    }
    inventory[index] = { ...inventory[index], status };
    if (health !== undefined) {
      inventory[index].health = health;
    }
    this.saveInventory(inventory);
    console.log(`[INVENTORY_DB] Unit ${unitId} status: ${status}${health !== undefined ? `, health: ${health}%` : ''}`);
    return inventory[index];
  }

  getAvailableUnits(): any[] {
    const inventory = this.getInventory();
    return inventory.filter((u: any) => u.status === 'Available');
  }

  // =================== RENTAL WORKFLOW AUTOMATION ===================

  async handleRentalCheckout(rentalId: string, unitId: string, data: any) {
    console.log(`[WORKFLOW] Check-out: ${rentalId} → Unit ${unitId}`);

    const updated = this.updateRentalEntry(rentalId, {
      status: 'active',
      unitId,
      checkOutAt: new Date().toISOString(),
      notes: data.notes || ''
    });

    if (updated) {
      this.updateUnitStatus(unitId, 'Rented');

      this.addLog({
        type: 'checkout',
        rentalId: rentalId,
        customerId: updated.customerId || '',
        customerName: updated.customer,
        message: `Check-out: ${updated.product} → Unit ${unitId}`,
        status: 'success'
      });

      await notificationService.send('rental_checkout', {
        customerName: updated.customer,
        productName: updated.product,
        unitId,
        checkOutAt: updated.checkOutAt
      }, { email: updated.email, phone: updated.phone });

      console.log(`[WORKFLOW] Unit ${unitId} marked as Rented. Customer notified.`);
    }

    return updated;
  }

  async handleRentalCheckin(rentalId: string, data: { condition: string; repairCost: number; notes: string; imageUrl?: string }) {
    console.log(`[WORKFLOW] Check-in: ${rentalId} → Condition: ${data.condition}`);

    const rental = this.getRentalById(rentalId);
    if (!rental) {
      console.error(`[WORKFLOW] Rental not found: ${rentalId}`);
      return null;
    }

    const now = new Date();
    const endDate = new Date(rental.endDate);
    let lateFee = 0;

    if (now > endDate && this.rules.autoApplyLatePenalty) {
      const hoursLate = Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60));
      lateFee = hoursLate * (this.rules.latePenaltyPerDay / 24);
      console.log(`[WORKFLOW] Late fee calculated: ₹${lateFee} (${hoursLate} hours)`);

      if (lateFee > 0) {
        this.addLog({
          type: 'penalty',
          rentalId: rentalId,
          customerId: rental.customerId || '',
          customerName: rental.customer,
          message: `Late fee: ₹${lateFee} (${hoursLate} hours overdue)`,
          status: 'success'
        });
      }
    }

    const updated = this.updateRentalEntry(rentalId, {
      status: 'completed',
      actualReturnDate: now.toISOString(),
      checkInAt: now.toISOString(),
      returnCondition: data.condition as any,
      repairCost: data.repairCost,
      lateFee,
      notes: data.notes || rental.notes
    });

    if (updated) {
      this.updateUnitStatus(rental.unitId, 'Available');

      if (data.condition === 'major') {
        this.updateUnitStatus(rental.unitId, 'Maintenance');
        this.addMaintenanceEntry({
          unitId: rental.unitId,
          date: now.toISOString(),
          type: 'Post-Return Inspection',
          technician: 'Auto-Assigned',
          notes: `Major damage detected during check-in. ${data.notes}`,
          cost: data.repairCost,
          triggeredBy: `Rental ${rentalId}`
        });
        console.log(`[WORKFLOW] Unit ${rental.unitId} flagged for maintenance.`);
      }

      if (data.condition === 'minor' && data.repairCost > 0) {
        this.addMaintenanceEntry({
          unitId: rental.unitId,
          date: now.toISOString(),
          type: 'Minor Repair',
          technician: 'Auto-Assigned',
          notes: `Minor damage: ₹${data.repairCost}. ${data.notes}`,
          cost: data.repairCost,
          triggeredBy: `Rental ${rentalId}`
        });
      }

      this.addLog({
        type: 'checkin',
        rentalId: rentalId,
        customerId: updated.customerId || '',
        customerName: updated.customer,
        message: `Check-in: ${updated.product} → Condition: ${data.condition}`,
        status: 'success'
      });

      await notificationService.send('rental_checkin', {
        customerName: updated.customer,
        productName: updated.product,
        condition: data.condition,
        lateFee,
        repairCost: data.repairCost,
        totalCharges: lateFee + data.repairCost
      }, { email: updated.email, phone: updated.phone });

      console.log(`[WORKFLOW] Unit ${rental.unitId} released. Customer notified.`);
    }

    return updated;
  }

  async handleRentalCancel(rentalId: string, data: { reason: string; refundDeposit: boolean }) {
    console.log(`[WORKFLOW] Cancel: ${rentalId} → Reason: ${data.reason}`);

    const rental = this.getRentalById(rentalId);
    if (!rental) return null;

    const updated = this.updateRentalEntry(rentalId, {
      status: 'cancelled',
      depositRefunded: data.refundDeposit,
      notes: `Cancelled: ${data.reason}. Refund: ${data.refundDeposit ? 'Yes' : 'No'}`
    });

    if (updated) {
      if (rental.unitId) {
        this.updateUnitStatus(rental.unitId, 'Available');
      }

      this.addLog({
        type: 'cancel',
        rentalId: rentalId,
        customerId: updated.customerId || '',
        customerName: updated.customer,
        message: `Cancelled: ${data.reason}. Deposit refund: ${data.refundDeposit ? 'Yes' : 'No'}`,
        status: 'success'
      });

      if (data.refundDeposit) {
        this.addLog({
          type: 'refund',
          rentalId: rentalId,
          customerId: updated.customerId || '',
          customerName: updated.customer,
          message: `Deposit refund: ₹${updated.deposit}`,
          status: 'success'
        });
      }

      await notificationService.send('rental_cancelled', {
        customerName: updated.customer,
        productName: updated.product,
        reason: data.reason,
        refundStatus: data.refundDeposit ? 'Refund processed' : 'No refund'
      }, { email: updated.email, phone: updated.phone });

      console.log(`[WORKFLOW] Rental cancelled. Unit released.`);
    }

    return updated;
  }

  async handleRentalBooking(booking: any) {
    if (this.rules.autoBlockRentalDates) {
      console.log(`[AUTOMATION] Blocking dates ${booking.startDate} to ${booking.endDate} for ${booking.consoleName}`);
    }

    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const totalPrice = days * booking.pricePerDay + booking.securityDeposit;

    console.log(`[AUTOMATION] Calculated Rental Price: ${totalPrice}`);

    const customer = this.getOrCreateCustomer({
      name: booking.customerName,
      email: booking.email,
      phone: booking.phone
    });

    const entry = this.addRentalEntry({
      rentalId: booking.id || '',
      unitId: booking.unitId || '',
      customerId: customer.id,
      customer: booking.customerName,
      email: booking.email,
      phone: booking.phone,
      product: booking.consoleName,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPrice,
      deposit: booking.securityDeposit,
      status: 'pending',
      repairCost: 0,
      lateFee: 0,
      depositRefunded: false,
      notes: ''
    });

    await notificationService.send('rental_confirmation', {
      customerName: booking.customerName,
      consoleName: booking.consoleName,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPrice,
      deposit: booking.securityDeposit,
      rentalId: entry.id
    }, { email: booking.email, phone: booking.phone });

    console.log(`[AUTOMATION] Rental booked: ${entry.id}`);
    return entry;
  }

  async handleInventoryChange(product: any) {
    const controllerSettings = getControllerSettings();
    let buffer = 3;

    if (product.type === 'ps4') {
      buffer = controllerSettings.hysteresis.ps4.stockAlertBuffer;
    } else if (product.type === 'ps5') {
      buffer = controllerSettings.hysteresis.ps5.stockAlertBuffer;
    }

    if (product.stock >= this.rules.lowStockThreshold + buffer) {
      if (this.alertedProducts.has(product.id)) {
        console.log(`[AUTOMATION] Stock recovered for ${product.name}, clearing low stock alert.`);
        this.alertedProducts.delete(product.id);
      }
    } else if (product.stock <= this.rules.lowStockThreshold && this.rules.autoNotifyAdminOnLowStock) {
      if (!this.alertedProducts.has(product.id)) {
        console.log(`[AUTOMATION] ALERT: Low stock for ${product.name}`);
        this.alertedProducts.add(product.id);
      }
    }
  }

  async handleOrderPlacement(order: any, products: any[]) {
    if (this.rules.autoReduceStock) {
      console.log(`[AUTOMATION] Reducing stock for ${products.length} items`);

      products.forEach(p => {
        if (p.stock <= this.rules.lowStockThreshold && this.rules.autoNotifyAdminOnLowStock) {
          if (!this.alertedProducts.has(p.id)) {
            console.log(`[AUTOMATION] ALERT: Low stock for ${p.name}`);
            this.alertedProducts.add(p.id);
          }
        }
      });
    }

    console.log(`[AUTOMATION] Generating invoice for Order #${order.id}`);

    await notificationService.send('order_confirmation', {
      orderId: order.id,
      customerName: order.customerName,
      productName: products.map(p => p.name).join(', ')
    }, { email: order.email, phone: order.phone });
  }

  async handleRepairRequest(request: any) {
    const ticketId = Math.random().toString(36).substring(7).toUpperCase();
    console.log(`[AUTOMATION] Created Repair Ticket #${ticketId}`);

    const technicians = ['Alex', 'Jordan', 'Sam'];
    const assigned = technicians[Math.floor(Math.random() * technicians.length)];
    console.log(`[AUTOMATION] Assigned technician ${assigned} to Ticket #${ticketId}`);

    await notificationService.send('repair_update', {
      customerName: request.customerName,
      deviceType: request.deviceType,
      ticketId,
      status: 'Technician Assigned'
    }, { email: request.email, phone: request.phone });
  }

  async handleSellRequest(request: any) {
    console.log(`[AUTOMATION] New Sell Request for ${request.consoleModel}`);

    await notificationService.send('sell_offer', {
      customerName: request.customerName,
      consoleModel: request.consoleModel,
      offerAmount: request.offerAmount || 'Pending Review'
    }, { email: request.email, phone: request.phone });
  }

  async triggerWorkflow(workflowId: string, data: any) {
    console.log(`[AUTOMATION] Triggering Workflow: ${workflowId}`, data);

    switch (workflowId) {
      case 'rental_confirmed':
        return await this.handleRentalBooking(data);
      case 'rental_checkout':
        return await this.handleRentalCheckout(data.rentalId, data.unitId, data);
      case 'rental_checkin':
        return await this.handleRentalCheckin(data.rentalId, data);
      case 'rental_cancel':
        return await this.handleRentalCancel(data.rentalId, data);
      case 'repair_created':
        return await this.handleRepairRequest(data);
      case 'buyback_quote_sent':
        return await this.handleSellRequest(data);
      default:
        console.log(`[AUTOMATION] No specific handler for workflow: ${workflowId}`);
    }
  }

  // =================== STATS & REPORTS ===================

  getStats() {
    const history = this.getRentalHistory();
    const maintenance = this.getMaintenanceHistory();

    const totalRentals = history.length;
    const activeRentals = history.filter(r => r.status === 'active').length;
    const completedRentals = history.filter(r => r.status === 'completed').length;
    const cancelledRentals = history.filter(r => r.status === 'cancelled').length;
    const lateRentals = history.filter(r => r.status === 'late').length;
    const totalRevenue = history.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.totalPrice, 0);
    const totalLateFees = history.reduce((sum, r) => sum + (r.lateFee || 0), 0);
    const totalRepairCosts = history.reduce((sum, r) => sum + (r.repairCost || 0), 0);
    const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + m.cost, 0);

    return {
      totalRentals,
      activeRentals,
      completedRentals,
      cancelledRentals,
      lateRentals,
      totalRevenue,
      totalLateFees,
      totalRepairCosts,
      totalMaintenanceCost,
      maintenanceRecords: maintenance.length
    };
  }

  getUnitReport(unitId: string) {
    const rentals = this.getRentalsByUnitId(unitId);
    const maintenance = this.getMaintenanceByUnitId(unitId);

    const totalRentals = rentals.length;
    const totalRevenue = rentals.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.totalPrice, 0);
    const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + m.cost, 0);
    const avgRentalDuration = rentals.length > 0
      ? rentals.reduce((sum, r) => {
          const start = new Date(r.startDate);
          const end = r.actualReturnDate ? new Date(r.actualReturnDate) : new Date(r.endDate);
          return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / totalRentals
      : 0;

    return {
      unitId,
      totalRentals,
      totalRevenue,
      totalMaintenanceCost,
      avgRentalDuration,
      lastRental: rentals[rentals.length - 1] || null,
      maintenanceCount: maintenance.length
    };
  }
}

export const rentalAutomationService = new RentalAutomationService();
export const automationService = rentalAutomationService;
