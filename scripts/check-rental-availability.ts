import assert from 'node:assert/strict';
import { addDays } from 'date-fns';
import { filterAvailableUnits, resolveRentalConsoleKey } from '../src/services/rentalAvailability';

const today = new Date('2026-03-29T00:00:00.000Z');

assert.equal(resolveRentalConsoleKey('ps5'), 'ps5');
assert.equal(resolveRentalConsoleKey('PlayStation 5 Standard Edition'), 'ps5');
assert.equal(resolveRentalConsoleKey('nintendo-switch-oled'), 'switch');

const inventoryUnits = [
  { id: 'unit-1', name: 'Sony PlayStation 5', serialNumber: 'SN-PS5-AAA', status: 'Available' },
  { id: 'unit-2', productId: 'ps5', name: 'Sony PlayStation 5', serialNumber: 'SN-PS5-BBB', status: 'Maintenance' },
  { id: 'unit-3', name: 'Xbox Series X', serialNumber: 'SN-XBOX-CCC', status: 'Available' }
];

const activeRentals = [
  {
    unitId: 'unit-1',
    productId: 'ITEM-174',
    productName: 'PlayStation 5 Standard Edition',
    status: 'pending',
    startDate: today.toISOString(),
    endDate: addDays(today, 2).toISOString()
  }
];

const overlappingUnits = filterAvailableUnits(inventoryUnits, activeRentals, 'ps5', today, addDays(today, 1));
assert.equal(overlappingUnits.length, 0, 'expected overlapping PS5 rental to block unit matched by name');

const nextWindowUnits = filterAvailableUnits(inventoryUnits, activeRentals, 'ps5', addDays(today, 4), addDays(today, 5));
assert.deepEqual(nextWindowUnits.map(unit => unit.id), ['unit-1'], 'expected PS5 unit without productId to be matched by inventory name');

const xboxWindowUnits = filterAvailableUnits(inventoryUnits, activeRentals, 'xbox', today, addDays(today, 1));
assert.deepEqual(xboxWindowUnits.map(unit => unit.id), ['unit-3'], 'expected other console units to remain available');

console.log('rental availability checks passed');
