import assert from 'node:assert/strict';
import { useAdminOverview, buildAdminOverview } from '../src/hooks/useAdminOverview';

const now = new Date('2026-03-29T12:00:00.000Z');

const overview = buildAdminOverview({
  now,
  orders: [
    {
      id: 'order-1',
      total: 1200,
      status: 'processing',
      date: '2026-03-29',
      customer: 'Alpha Buyer'
    },
    {
      id: 'order-2',
      total: 400,
      status: 'cancelled',
      date: '2026-03-28',
      customer: 'Cancelled Buyer'
    }
  ],
  rentals: [
    {
      id: 'rental-1',
      totalPrice: 900,
      lateFees: 100,
      status: 'late',
      startDate: '2026-03-27T00:00:00.000Z',
      endDate: '2026-03-28T00:00:00.000Z',
      product: 'PlayStation 5'
    },
    {
      id: 'rental-2',
      totalPrice: 500,
      lateFees: 0,
      status: 'completed',
      startDate: '2026-03-24T00:00:00.000Z',
      endDate: '2026-03-25T00:00:00.000Z',
      product: 'Nintendo Switch'
    }
  ],
  inventory: [
    { id: 'inv-1', name: 'PS5 Unit', status: 'Available', health: 92, lastService: '2026-03-20' },
    { id: 'inv-2', name: 'Xbox Unit', status: 'Maintenance', health: 72, lastService: '2026-03-18' },
    { id: 'inv-3', name: 'Switch Unit', status: 'Rented', health: 88, lastService: '2026-03-10' }
  ],
  users: [
    { id: 'user-1', name: 'Admin Test', created_at: '2026-03-01T00:00:00.000Z' }
  ],
  kyc: [
    {
      id: 'kyc-1',
      fullName: 'Pending User',
      status: 'MANUAL_REVIEW',
      submittedAt: '2026-03-29T10:30:00.000Z'
    },
    {
      id: 'kyc-2',
      fullName: 'Approved User',
      status: 'APPROVED',
      submittedAt: '2026-03-28T10:30:00.000Z'
    }
  ],
  notifications: [
    {
      id: 'notif-1',
      userId: 'admin',
      title: 'Fraud spike',
      message: 'Manual review queue exceeded threshold',
      type: 'system',
      priority: 'critical',
      read: false,
      timestamp: '2026-03-29T11:00:00.000Z',
      actionPath: '/admin/kyc'
    },
    {
      id: 'notif-2',
      userId: 'admin',
      title: 'Invoice retry',
      message: 'Invoice send needs retry',
      type: 'system',
      priority: 'high',
      read: false,
      timestamp: '2026-03-29T09:00:00.000Z',
      actionPath: '/admin/invoices'
    }
  ]
});

assert.equal(overview.metrics.grossRevenue, 2700, 'gross revenue should combine non-cancelled orders and rentals');
assert.equal(overview.metrics.ordersInFlight, 1, 'orders in flight should count processing orders');
assert.equal(overview.metrics.activeRentals, 1, 'active rentals should count late rentals');
assert.equal(overview.metrics.fleetReady, 1, 'fleet ready should count only available inventory');
assert.equal(overview.metrics.fleetReadyRate, 1 / 3, 'fleet ready rate should be based on total inventory');
assert.equal(overview.metrics.kycQueue, 1, 'kyc queue should count manual review');
assert.equal(overview.metrics.criticalSignals, 2, 'critical signals should count unread high and critical notifications');

assert.equal(overview.revenueTrend.length, 7, 'revenue trend should always have seven buckets');
assert.equal(overview.inventoryDistribution.length, 3, 'known inventory statuses should be grouped without empty unknown bucket');
assert.equal(overview.priorityQueue.length, 5, 'priority queue should include critical and high notifications plus late rental, manual review, and maintenance');
assert.deepEqual(
  overview.priorityQueue.map((item) => item.kind),
  ['notification', 'notification', 'rental', 'kyc', 'inventory'],
  'priority queue should be severity ordered'
);

assert.equal(overview.activityFeed.length, 8, 'activity feed should merge recent records up to the cap of eight');
assert.equal(overview.activityFeed[0]?.type, 'SYSTEM', 'newest activity should lead the feed');

console.log('admin overview checks passed');
