/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ShiftInfo {
  businessDate: string;
  branch: string;
  cashier: string;
  shift: string;
  registerNumber: string;
  openingTime: string;
  closingTime: string;
}

export interface Payments {
  cash: number;
  spanMada: number;
  visa: number;
  mastercard: number;
  gccNetwork: number;
  keeta: number;
  hungerstation: number;
  jahez: number;
  mrsool: number;
  otherPayments: number;
  totalReturns: number;
}

export interface DrawerOperations {
  payIn: number;
  payOut: number;
  cashDrops: number;
  returnOperations: number;
  replacementReturn?: number;
  cashExpenses: number;
}

export interface CashCount {
  sar500: number;
  sar200: number;
  sar100: number;
  sar50: number;
  sar20: number;
  sar10: number;
  sar5: number;
  sar1: number;
  sar0_50: number;
  sar0_25?: number;
}

export interface CardBreakdown {
  mada: number;
  visa: number;
  mastercard: number;
  amex: number;
  gccNet: number;
}

export interface Reconciliation {
  expectedCash: number;
  actualCash: number;
  difference: number;
  expectedCard?: number;
  actualCard?: number;
  cardDifference?: number;
  overallDifference?: number;
  status: 'Balanced' | 'Over' | 'Short';
}

export interface Deposit {
  amountToDeposit: number;
  remainingFloat: number;
  notes: string;
  cashierSignature: string;
}

export interface DailyClosingRecord {
  id: string;
  timestamp: string;
  shiftInfo: ShiftInfo;
  payments: Payments;
  drawerOperations: DrawerOperations;
  openingFloat: number;
  cashCount: CashCount;
  cardBreakdown?: CardBreakdown;
  reconciliation: Reconciliation;
  deposit: Deposit;
  isDeletedFromLog?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'supervisor' | 'cashier';
}

export interface AppSettings {
  branches: string[];
  cashiers: string[];
  supervisors: string[];
  paymentMethods: string[];
  deliveryPlatforms: string[];
  defaultOpeningFloat: number;
  shifts: string[];
  employees?: Employee[];
}
