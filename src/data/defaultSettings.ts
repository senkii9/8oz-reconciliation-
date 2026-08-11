/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  branches: [
    'Riyadh Olaya Branch',
    'Jeddah Corniche Branch',
    'Al Khobar Front Branch',
    'Takhassusi Branch',
    'Malqa District Branch'
  ],
  cashiers: [
    'Ahmed Al-Harbi',
    'Sara Al-Otaibi',
    'Yousef Al-Ghamdi',
    'Laila Al-Qahtani',
    'Fahad Al-Malki'
  ],
  supervisors: [
    'Mohammad Al-Shehri',
    'Rania Al-Anazi',
    'Khalid Al-Dossari',
    'Reema Al-Saud'
  ],
  paymentMethods: [
    'Cash',
    'Span (Mada)',
    'Visa',
    'Mastercard',
    'GCC Network',
    'Other'
  ],
  deliveryPlatforms: [
    'Keeta',
    'HungerStation',
    'Jahez',
    'Mrsool'
  ],
  defaultOpeningFloat: 1000,
  shifts: [
    'Morning Shift',
    'Evening Shift',
    'Night Shift'
  ],
  employees: [],
};
