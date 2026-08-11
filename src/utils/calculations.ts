/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Payments, CashCount, DrawerOperations } from '../types';

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCardPayments(payments: Payments): number {
  return round(
    (payments.spanMada || 0) +
    (payments.visa || 0) +
    (payments.mastercard || 0) +
    (payments.gccNetwork || 0)
  );
}

export function calculateDeliveryPayments(payments: Payments): number {
  return round(
    (payments.keeta || 0) +
    (payments.hungerstation || 0) +
    (payments.jahez || 0) +
    (payments.mrsool || 0)
  );
}

export function calculateTotalPayments(payments: Payments): number {
  return round(
    (payments.cash || 0) +
    calculateCardPayments(payments) +
    calculateDeliveryPayments(payments) +
    (payments.otherPayments || 0)
  );
}

export function calculateNetPayments(payments: Payments): number {
  return round(calculateTotalPayments(payments) - (payments.totalReturns || 0));
}

export function calculateActualCash(cashCount: CashCount): number {
  return round(
    (cashCount.sar500 || 0) * 500 +
    (cashCount.sar200 || 0) * 200 +
    (cashCount.sar100 || 0) * 100 +
    (cashCount.sar50 || 0) * 50 +
    (cashCount.sar20 || 0) * 20 +
    (cashCount.sar10 || 0) * 10 +
    (cashCount.sar5 || 0) * 5 +
    (cashCount.sar1 || 0) * 1 +
    (cashCount.sar0_50 || 0) * 0.5 +
    (cashCount.sar0_25 || 0) * 0.25
  );
}

export function calculateExpectedCash(
  openingFloat: number,
  cashSales: number,
  drawer: DrawerOperations
): number {
  return round(
    (openingFloat || 0) +
    (cashSales || 0) +
    (drawer.payIn || 0) -
    (drawer.payOut || 0) -
    (drawer.cashDrops || 0) -
    (drawer.returnOperations || 0) -
    (drawer.cashExpenses || 0)
  );
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace('SAR', 'SAR ');
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

