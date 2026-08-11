/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShiftInfo, 
  Payments, 
  DrawerOperations, 
  CashCount, 
  CardBreakdown,
  Deposit, 
  DailyClosingRecord, 
  AppSettings 
} from '../types';
import { 
  calculateCardPayments, 
  calculateDeliveryPayments, 
  calculateTotalPayments, 
  calculateNetPayments, 
  calculateActualCash, 
  calculateExpectedCash, 
  formatCurrency 
} from '../utils/calculations';
import { Coins, CheckCircle, AlertTriangle, XCircle, Save, RefreshCw, Printer, FileSpreadsheet, Plus, Minus, FileDown } from 'lucide-react';

import { doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { translations, Language } from '../lib/translations';

interface DailyClosingTabProps {
  settings: AppSettings;
  onSave: (record: Omit<DailyClosingRecord, 'id' | 'timestamp'>) => void;
  isSyncing: boolean;
  onSyncNow?: () => void;
  language: Language;
  dbInstance?: any;
}

const DENOMINATIONS = [
  { label: '500 SAR', value: 500, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: '200 SAR', value: 200, color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { label: '100 SAR', value: 100, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { label: '50 SAR', value: 50, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { label: '20 SAR', value: 20, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { label: '10 SAR', value: 10, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: '5 SAR', value: 5, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { label: '1 SAR', value: 1, color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { label: '0.50 SAR', value: 0.5, color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { label: '0.25 SAR', value: 0.25, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
];

export default function DailyClosingTab({ 
  settings, 
  onSave, 
  isSyncing, 
  onSyncNow,
  language = 'en',
  dbInstance
}: DailyClosingTabProps) {
  // 1. Shift Information State
  const [shiftInfo, setShiftInfo] = useState<ShiftInfo>({
    businessDate: new Date().toISOString().split('T')[0],
    branch: settings.branches[0] || '',
    cashier: settings.cashiers[0] || '',
    shift: (settings.shifts && settings.shifts[0]) || 'Evening',
    registerNumber: '1',
    openingTime: '08:00 AM',
    closingTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  });

  // 2. Payments State
  const [payments, setPayments] = useState<Payments>({
    cash: 0,
    spanMada: 0,
    visa: 0,
    mastercard: 0,
    gccNetwork: 0,
    keeta: 0,
    hungerstation: 0,
    jahez: 0,
    mrsool: 0,
    otherPayments: 0,
    totalReturns: 0,
  });

  // 3. Drawer Operations State
  const [drawer, setDrawer] = useState<DrawerOperations>({
    payIn: 0,
    payOut: 0,
    cashDrops: 0,
    returnOperations: 0,
    cashExpenses: 0,
  });

  // 4. Opening Float State
  const [openingFloat, setOpeningFloat] = useState<number>(settings.defaultOpeningFloat);

  // 5. Cash Count State (Saudi Denominations)
  const [cashCount, setCashCount] = useState<CashCount>({
    sar500: 0,
    sar200: 0,
    sar100: 0,
    sar50: 0,
    sar20: 0,
    sar10: 0,
    sar5: 0,
    sar1: 0,
    sar0_50: 0,
    sar0_25: 0,
  });

  // 6. Deposit State
  const [deposit, setDeposit] = useState<Deposit>({
    amountToDeposit: 0,
    remainingFloat: settings.defaultOpeningFloat,
    notes: '',
    cashierSignature: '',
  });

  const [actualCardBreakdown, setActualCardBreakdown] = useState<CardBreakdown>({
    mada: 0,
    visa: 0,
    mastercard: 0,
    amex: 0,
    gccNet: 0
  });

  const actualCard = 
    (actualCardBreakdown.mada || 0) +
    (actualCardBreakdown.visa || 0) +
    (actualCardBreakdown.mastercard || 0) +
    (actualCardBreakdown.amex || 0) +
    (actualCardBreakdown.gccNet || 0);

  const isRemoteUpdate = React.useRef(false);
  const [isReady, setIsReady] = useState(false);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    desc: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    desc: '',
    onConfirm: () => {},
    type: 'warning'
  });

  // Sync Draft FROM Firebase
  useEffect(() => {
    if (!dbInstance) return;
    const docRef = doc(dbInstance, 'store', '8oz_main', 'activeDraft', 'draft');
    
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists() && !snap.metadata.hasPendingWrites) {
        const data = snap.data();
        isRemoteUpdate.current = true;
        
        if (data.shiftInfo) setShiftInfo(data.shiftInfo);
        if (data.payments) setPayments(data.payments);
        if (data.drawer) setDrawer(data.drawer);
        if (data.openingFloat !== undefined) setOpeningFloat(data.openingFloat);
        if (data.cashCount) setCashCount(data.cashCount);
        if (data.deposit) setDeposit(data.deposit);
        if (data.actualCardBreakdown) setActualCardBreakdown(data.actualCardBreakdown);
      }
      setIsReady(true);
    });

    return () => unsubscribe();
  }, [dbInstance]);

  // Sync Draft TO Firebase
  useEffect(() => {
    if (!dbInstance || !isReady) return;
    
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    const docRef = doc(dbInstance, 'store', '8oz_main', 'activeDraft', 'draft');
    const draftData = {
      shiftInfo,
      payments,
      drawer,
      openingFloat,
      cashCount,
      deposit,
      actualCardBreakdown
    };

    setDoc(docRef, draftData, { merge: true }).catch(err => {
      console.error("Error saving draft to Firebase:", err);
    });

  }, [shiftInfo, payments, drawer, openingFloat, cashCount, deposit, actualCardBreakdown, dbInstance, isReady]);

  // Keep opening float in sync with settings
  useEffect(() => {
    setOpeningFloat(settings.defaultOpeningFloat);
  }, [settings.defaultOpeningFloat]);

  // Update default selections when settings change
  useEffect(() => {
    setShiftInfo(prev => ({
      ...prev,
      branch: settings.branches[0] || prev.branch,
      cashier: settings.cashiers[0] || prev.cashier,
      shift: (settings.shifts && settings.shifts.length > 0) 
        ? (settings.shifts.includes(prev.shift) ? prev.shift : settings.shifts[0]) 
        : prev.shift,
    }));
    setDeposit(prev => ({
      ...prev,
    }));
  }, [settings]);

  // Automated Calculations (Derived State)
  const cardPaymentsSum = calculateCardPayments(payments);
  const deliveryPaymentsSum = calculateDeliveryPayments(payments);
  const totalPaymentsSum = calculateTotalPayments(payments);
  const netPaymentsSum = calculateNetPayments(payments);

  const actualCashCount = calculateActualCash(cashCount);
  const expectedCash = calculateExpectedCash(openingFloat, payments.cash, drawer);
  
  const cashDifference = actualCashCount - expectedCash;
  const expectedCard = cardPaymentsSum;
  const cardDifference = actualCard - expectedCard;
  const overallDifference = cashDifference + cardDifference;
  const difference = cashDifference; // compatibility for cash difference

  let status: 'Balanced' | 'Over' | 'Short' = 'Balanced';
  if (overallDifference > 0.01) status = 'Over';
  if (overallDifference < -0.01) status = 'Short';

  // Automatically calculate Amount to Deposit and Remaining Float on cash count changes
  useEffect(() => {
    // Standard rule: Cashier deposits everything above the default opening float,
    // keeping the default float in the drawer.
    const expectedRemainingFloat = settings.defaultOpeningFloat;
    const calculatedDeposit = Math.max(0, actualCashCount - expectedRemainingFloat);
    
    setDeposit(prev => ({
      ...prev,
      amountToDeposit: Number(calculatedDeposit.toFixed(2)),
      remainingFloat: Number((actualCashCount - calculatedDeposit).toFixed(2)),
    }));
  }, [actualCashCount, settings.defaultOpeningFloat]);

  const handleDenominationChange = (key: keyof CashCount, val: number) => {
    setCashCount(prev => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  const adjustDenomination = (key: keyof CashCount, amount: number) => {
    setCashCount(prev => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + amount),
    }));
  };

  const handlePaymentsChange = (key: keyof Payments, val: string) => {
    setPayments(prev => ({
      ...prev,
      [key]: parseFloat(val) || 0,
    }));
  };

  const handleActualCardBreakdownChange = (key: keyof CardBreakdown, val: string) => {
    setActualCardBreakdown(prev => ({
      ...prev,
      [key]: parseFloat(val) || 0,
    }));
  };

  const handleDrawerChange = (key: keyof DrawerOperations, val: string) => {
    setDrawer(prev => ({
      ...prev,
      [key]: parseFloat(val) || 0,
    }));
  };

  const clearForm = () => {
    if (dbInstance) {
      const draftRef = doc(dbInstance, 'store', '8oz_main', 'activeDraft', 'draft');
      deleteDoc(draftRef).catch(err => console.error("Failed to clear draft", err));
    }

    setPayments({
      cash: 0,
      spanMada: 0,
      visa: 0,
      mastercard: 0,
      gccNetwork: 0,
      keeta: 0,
      hungerstation: 0,
      jahez: 0,
      mrsool: 0,
      otherPayments: 0,
      totalReturns: 0,
    });
    setDrawer({
      payIn: 0,
      payOut: 0,
      cashDrops: 0,
      returnOperations: 0,
      replacementReturn: 0,
      cashExpenses: 0,
    });
    setCashCount({
      sar500: 0,
      sar200: 0,
      sar100: 0,
      sar50: 0,
      sar20: 0,
      sar10: 0,
      sar5: 0,
      sar1: 0,
      sar0_50: 0,
      sar0_25: 0,
    });
    setDeposit({
      amountToDeposit: 0,
      remainingFloat: settings.defaultOpeningFloat,
      notes: '',
      cashierSignature: '',
    });
    setActualCardBreakdown({
      mada: 0,
      visa: 0,
      mastercard: 0,
      amex: 0,
      gccNet: 0
    });
    setShiftInfo({
      businessDate: new Date().toISOString().split('T')[0],
      branch: settings.branches[0] || '',
      cashier: settings.cashiers[0] || '',
      shift: (settings.shifts && settings.shifts[0]) || 'Evening',
      registerNumber: '1',
      openingTime: '08:00 AM',
      closingTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const resetForm = () => {
    setModalConfig({
      isOpen: true,
      title: language === 'ar' ? 'تأكيد مسح البيانات' : 'Confirm Clear Form',
      desc: translations[language].confirmResetForm,
      type: 'danger',
      onConfirm: () => {
        clearForm();
      }
    });
  };

  const getDenominationKey = (value: number): keyof CashCount => {
    if (value === 0.5) return 'sar0_50';
    if (value === 0.25) return 'sar0_25';
    return `sar${value}` as keyof CashCount;
  };

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (!shiftInfo.businessDate) {
      alert(translations[language].errSelectDate);
      return;
    }

    onSave({
      shiftInfo,
      payments,
      drawerOperations: drawer,
      openingFloat,
      cashCount,
      cardBreakdown: actualCardBreakdown,
      reconciliation: {
        expectedCash,
        actualCash: actualCashCount,
        difference: cashDifference,
        expectedCard,
        actualCard,
        cardDifference,
        overallDifference,
        status,
      },
      deposit: {
        ...deposit,
        cashierSignature: 'System Verified'
      },
    });

    clearForm();
  };

  const handlePrint = () => {
    const title = language === 'ar' ? 'تقرير تسوية ومطابقة النقدية' : 'Cash Reconciliation & Closing Report';
    
    const cardSales = payments.spanMada || 0;

    const deliverySales =
      (payments.keeta || 0) +
      (payments.hungerstation || 0) +
      (payments.jahez || 0) +
      (payments.mrsool || 0);

    const statusText = language === 'ar' 
      ? (status === 'Balanced' ? 'متطابق' : status === 'Over' ? 'زيادة' : 'عجز')
      : status;

    let shiftText = shiftInfo.shift;
    if (shiftInfo.shift === 'Morning' || shiftInfo.shift === 'Morning Shift') {
      shiftText = translations[language].morningShift;
    } else if (shiftInfo.shift === 'Evening' || shiftInfo.shift === 'Evening Shift') {
      shiftText = translations[language].eveningShift;
    }

    const htmlContent = `
      <div class="report-container">
        <!-- Header -->
        <div class="header">
          <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #2563eb; letter-spacing: 0.1em;">
            ${translations[language].cashReconciliation} - 8oz
          </span>
          <h1>
            ${language === 'ar' ? 'تقرير تسوية وإغلاق عهدة 8oz' : '8oz Cash Custody Reconciliation Report'}
          </h1>
          <p>${language === 'ar' ? 'تاريخ ووقت التصدير:' : 'Exported on:'} ${new Date().toLocaleString()}</p>
        </div>

        <div class="grid-layout">
          <!-- Column 1 -->
          <div>
            <!-- Shift Information -->
            <div class="section-card" style="margin-bottom: 10px;">
              <h3 class="section-title">
                <span>${translations[language].shiftInformation}</span>
              </h3>
              <table>
                <tr>
                  <td class="text-left" style="color: #64748b;">${translations[language].businessDate}</td>
                  <td class="text-right" style="font-weight: bold;">${shiftInfo.businessDate}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b;">${translations[language].branch}</td>
                  <td class="text-right" style="font-weight: bold;">${shiftInfo.branch}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b;">${translations[language].cashierName}</td>
                  <td class="text-right" style="font-weight: bold;">${shiftInfo.cashier}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b;">${translations[language].shift}</td>
                  <td class="text-right" style="font-weight: bold;">${shiftText}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b;">${translations[language].registerNumber}</td>
                  <td class="text-right font-mono" style="font-weight: bold;">${shiftInfo.registerNumber}</td>
                </tr>
              </table>
            </div>

            <!-- Physical Cash Count -->
            <div class="section-card">
              <h3 class="section-title">
                <span>${translations[language].physicalCashCount}</span>
                <span style="font-size: 9px; color: #64748b; font-weight: normal;">${translations[language].actualCashCounted}</span>
              </h3>
              <table class="font-mono">
                <thead>
                  <tr style="color: #64748b; font-size: 9.5px; font-family: sans-serif; border-bottom: 1px solid #e2e8f0;">
                    <th class="text-left" style="padding-bottom: 4px; font-weight: 600;">${translations[language].denomination}</th>
                    <th class="text-center" style="padding-bottom: 4px; font-weight: 600;">${translations[language].qty}</th>
                    <th class="text-right" style="padding-bottom: 4px; font-weight: 600;">${translations[language].total}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td>500 ${translations[language].sar}</td><td class="text-center">${cashCount.sar500}</td><td class="text-right">${formatCurrency(cashCount.sar500 * 500)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td>200 ${translations[language].sar}</td><td class="text-center">${cashCount.sar200}</td><td class="text-right">${formatCurrency(cashCount.sar200 * 200)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td>100 ${translations[language].sar}</td><td class="text-center">${cashCount.sar100}</td><td class="text-right">${formatCurrency(cashCount.sar100 * 100)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td>50 ${translations[language].sar}</td><td class="text-center">${cashCount.sar50}</td><td class="text-right">${formatCurrency(cashCount.sar50 * 50)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td>20 ${translations[language].sar}</td><td class="text-center">${cashCount.sar20}</td><td class="text-right">${formatCurrency(cashCount.sar20 * 20)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td>10 ${translations[language].sar}</td><td class="text-center">${cashCount.sar10}</td><td class="text-right">${formatCurrency(cashCount.sar10 * 10)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td>5 ${translations[language].sar}</td><td class="text-center">${cashCount.sar5}</td><td class="text-right">${formatCurrency(cashCount.sar5 * 5)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td>1 ${translations[language].sar}</td><td class="text-center">${cashCount.sar1}</td><td class="text-right">${formatCurrency(cashCount.sar1 * 1)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td>0.50 ${translations[language].sar}</td><td class="text-center">${cashCount.sar0_50}</td><td class="text-right">${formatCurrency(cashCount.sar0_50 * 0.5)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td>0.25 ${translations[language].sar}</td><td class="text-center">${cashCount.sar0_25 || 0}</td><td class="text-right">${formatCurrency((cashCount.sar0_25 || 0) * 0.25)}</td></tr>
                  <tr style="font-weight: bold; font-size: 11px;">
                    <td class="text-left" style="padding-top: 6px; font-family: sans-serif; color: #0f172a;">${language === 'ar' ? 'النقد الفعلي الإجمالي' : 'Total Actual Cash'}</td>
                    <td></td>
                    <td class="text-right" style="padding-top: 6px; color: #2563eb; font-weight: 800;">${formatCurrency(actualCashCount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Physical Card Count -->
            <div class="section-card" style="margin-top: 10px;">
              <h3 class="section-title">
                <span>${language === 'ar' ? 'العد الفعلي للشبكة' : 'Physical Card Count'}</span>
              </h3>
              <table class="font-mono">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td>${language === 'ar' ? 'مدى الفعلي' : 'mada (Actual)'}</td>
                  <td class="text-right">${formatCurrency(actualCardBreakdown.mada || 0)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td>${language === 'ar' ? 'فيزا الفعلي' : 'Visa (Actual)'}</td>
                  <td class="text-right">${formatCurrency(actualCardBreakdown.visa || 0)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td>${language === 'ar' ? 'ماستركارد الفعلي' : 'MasterCard (Actual)'}</td>
                  <td class="text-right">${formatCurrency(actualCardBreakdown.mastercard || 0)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td>${language === 'ar' ? 'أمريكان إكسبريس الفعلي' : 'AMEX (Actual)'}</td>
                  <td class="text-right">${formatCurrency(actualCardBreakdown.amex || 0)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td>${language === 'ar' ? 'الشبكة الخليجية الفعلي' : 'GCC Net (Actual)'}</td>
                  <td class="text-right">${formatCurrency(actualCardBreakdown.gccNet || 0)}</td>
                </tr>
                <tr style="font-weight: bold; font-size: 11px;">
                  <td style="color: #0f172a;">${language === 'ar' ? 'إجمالي الشبكة الفعلي' : 'Total Actual Card'}</td>
                  <td class="text-right" style="color: #2563eb; font-weight: 800;">${formatCurrency(actualCard)}</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- Column 2 -->
          <div>
            <!-- Payments Breakdown -->
            <div class="section-card" style="margin-bottom: 10px;">
              <h3 class="section-title">
                <span>${translations[language].paymentBreakdown}</span>
              </h3>
              <table class="font-mono">
                <tr>
                  <td class="text-left" style="color: #475569; font-family: sans-serif;">${translations[language].cashSales}</td>
                  <td class="text-right" style="font-weight: bold;">${formatCurrency(payments.cash)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #475569; font-family: sans-serif;">${translations[language].spanExpected}</td>
                  <td class="text-right" style="font-weight: bold;">${formatCurrency(payments.spanMada)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #475569; font-family: sans-serif;">${translations[language].keeta}</td>
                  <td class="text-right" style="font-weight: bold;">${formatCurrency(payments.keeta)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #475569; font-family: sans-serif;">${translations[language].hungerstation}</td>
                  <td class="text-right" style="font-weight: bold;">${formatCurrency(payments.hungerstation)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #475569; font-family: sans-serif;">${translations[language].mrsool}</td>
                  <td class="text-right" style="font-weight: bold;">${formatCurrency(payments.mrsool)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #475569; font-family: sans-serif;">${translations[language].jahez}</td>
                  <td class="text-right" style="font-weight: bold;">${formatCurrency(payments.jahez)}</td>
                </tr>
                <tr style="color: #dc2626;">
                  <td class="text-left" style="font-family: sans-serif;">${translations[language].totalReturns}</td>
                  <td class="text-right" style="font-weight: bold;">-${formatCurrency(payments.totalReturns)}</td>
                </tr>
                <tr style="border-top: 1.5px solid #cbd5e1; font-weight: bold;">
                  <td class="text-left" style="color: #0f172a; font-family: sans-serif;">${translations[language].netPayments}</td>
                  <td class="text-right" style="color: #2563eb;">${formatCurrency(netPaymentsSum)}</td>
                </tr>
              </table>
            </div>

            <!-- Drawer Operations -->
            <div class="section-card" style="margin-bottom: 10px;">
              <h3 class="section-title">
                <span>${translations[language].drawerOperations}</span>
              </h3>
              <table class="font-mono">
                <tr>
                  <td class="text-left" style="color: #64748b; font-family: sans-serif;">${translations[language].openingFloat}</td>
                  <td class="text-right" style="font-weight: bold;">${formatCurrency(openingFloat)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b; font-family: sans-serif;">${translations[language].payInTotal}</td>
                  <td class="text-right" style="color: #059669;">+${formatCurrency(drawer.payIn || 0)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b; font-family: sans-serif;">${translations[language].payOut}</td>
                  <td class="text-right" style="color: #ef4444;">-${formatCurrency(drawer.payOut || 0)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b; font-family: sans-serif;">${translations[language].cashDrops}</td>
                  <td class="text-right" style="color: #ef4444;">-${formatCurrency(drawer.cashDrops || 0)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b; font-family: sans-serif;">${translations[language].returnOps}</td>
                  <td class="text-right" style="color: #ef4444;">-${formatCurrency(drawer.returnOperations || 0)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b; font-family: sans-serif;">${translations[language].replacementReturn}</td>
                  <td class="text-right" style="color: #64748b;">${formatCurrency(drawer.replacementReturn || 0)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b; font-family: sans-serif;">${translations[language].cashExpenses}</td>
                  <td class="text-right" style="color: #ef4444;">-${formatCurrency(drawer.cashExpenses || 0)}</td>
                </tr>
                <tr style="border-top: 1px dashed #cbd5e1; font-weight: bold;">
                  <td class="text-left" style="color: #475569; font-family: sans-serif;">${translations[language].expectedDrawerCash}</td>
                  <td class="text-right" style="color: #0f172a;">${formatCurrency(expectedCash)}</td>
                </tr>
              </table>
            </div>

            <!-- Reconciliation Summary -->
            <div class="section-card" style="margin-bottom: 10px;">
              <h3 class="section-title">
                <span>${translations[language].custodyStatus}</span>
              </h3>
              <table class="font-mono">
                <tr>
                  <td class="text-left" style="color: #64748b; font-family: sans-serif;">${translations[language].expectedDrawerCash}</td>
                  <td class="text-right" style="font-weight: bold;">${formatCurrency(expectedCash)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b; font-family: sans-serif;">${translations[language].actualCashCounted}</td>
                  <td class="text-right" style="font-weight: bold; color: #2563eb;">${formatCurrency(actualCashCount)}</td>
                </tr>
                <tr style="border-bottom: 1px dashed #cbd5e1;">
                  <td class="text-left" style="font-family: sans-serif; color: #475569;">${translations[language].cashDifference}</td>
                  <td class="text-right" style="font-weight: bold; color: ${cashDifference === 0 ? '#059669' : cashDifference > 0 ? '#d97706' : '#dc2626'}">
                    ${cashDifference > 0 ? '+' : ''}${formatCurrency(cashDifference)}
                  </td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b; font-family: sans-serif; padding-top: 3px;">${translations[language].expectedCard}</td>
                  <td class="text-right" style="font-weight: bold; padding-top: 3px;">${formatCurrency(expectedCard)}</td>
                </tr>
                <tr>
                  <td class="text-left" style="color: #64748b; font-family: sans-serif;">${translations[language].actualCard}</td>
                  <td class="text-right" style="font-weight: bold; color: #2563eb;">${formatCurrency(actualCard)}</td>
                </tr>
                <tr style="border-bottom: 1px dashed #cbd5e1;">
                  <td class="text-left" style="font-family: sans-serif; color: #475569;">${translations[language].cardDifference}</td>
                  <td class="text-right" style="font-weight: bold; color: ${cardDifference === 0 ? '#059669' : cardDifference > 0 ? '#d97706' : '#dc2626'}">
                    ${cardDifference > 0 ? '+' : ''}${formatCurrency(cardDifference)}
                  </td>
                </tr>
                <tr style="font-weight: bold; font-size: 11px;">
                  <td class="text-left" style="padding-top: 5px; font-family: sans-serif; color: #0f172a;">${translations[language].custodyDifference}</td>
                  <td class="text-right" style="padding-top: 5px; color: ${overallDifference === 0 ? '#059669' : overallDifference > 0 ? '#d97706' : '#dc2626'}">
                    ${overallDifference > 0 ? '+' : ''}${formatCurrency(overallDifference)}
                  </td>
                </tr>
              </table>
              
              <div class="status-banner ${status === 'Balanced' ? 'balanced' : status === 'Over' ? 'over' : 'short'}">
                ${translations[language].custodyStatus}: ${statusText}
              </div>
            </div>
          </div>
        </div>

        <!-- Notes and Signatures -->
        <div class="section-card" style="margin-top: 12px; width: 100%; box-sizing: border-box;">
          <h3 class="section-title">
            <span>${language === 'ar' ? 'الاعتماد والملاحظات المرفقة' : 'Signatures & Verifications'}</span>
          </h3>
          <div style="font-size: 10px; margin-bottom: 8px; line-height: 1.5;">
            <strong>${language === 'ar' ? 'ملاحظات الشفت:' : 'Shift Notes:'}</strong>
            <span style="color: #475569;">${deposit.notes || (language === 'ar' ? 'لا يوجد' : 'None')}</span>
          </div>
        </div>

        <!-- Custom Corporate Dual-Corner Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #0f172a; padding-top: 8px; margin-top: 6px; direction: ltr;">
          <!-- Left corner: 8oz system -->
          <div style="font-family: 'Inter', sans-serif; font-size: 10px; font-weight: bold; color: #475569;">
            8oz system
          </div>
          <!-- Right corner: مستند معتمد with small green checkmark -->
          <div style="display: flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: bold; color: #16a34a;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; background-color: #dcfce7; border-radius: 50%; color: #15803d; font-size: 9px; margin-right: 4px; font-weight: 900;">✓</span>
            <span style="font-family: 'Cairo', sans-serif;">مستند معتمد</span>
          </div>
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
          <head>
            <title>${title}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800;900&display=swap');
              
              @font-face {
                font-family: 'The year of handicraft';
                src: local('The year of handicraft'),
                     local('Year of Handicrafts'),
                     local('MOC Handicrafts'),
                     local('MOC_Handicrafts'),
                     local('MOC Handicrafts Regular'),
                     local('Handicrafts'),
                     url('/fonts/ThmanyahDisplay-Regular.woff2') format('woff2');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
              }

              @font-face {
                font-family: 'The year of handicraft';
                src: local('The year of handicraft Bold'),
                     local('Year of Handicrafts Bold'),
                     local('MOC Handicrafts Bold'),
                     local('MOC_Handicrafts Bold'),
                     local('Handicrafts Bold'),
                     url('/fonts/ThmanyahDisplay-Bold.woff2') format('woff2');
                font-weight: bold;
                font-style: normal;
                font-display: swap;
              }

              body {
                font-family: 'The year of handicraft', 'Thmanyah', 'Expo Sans', 'Cairo', 'Inter', sans-serif;
                margin: 0;
                padding: 0;
                background: #fff;
                color: #0f172a;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                font-size: 11px;
                line-height: 1.3;
              }
              
              .report-container {
                padding: 10px;
                max-width: 800px;
                margin: 0 auto;
                box-sizing: border-box;
              }
              
              .header {
                text-align: center;
                border-bottom: 2px solid #2563eb;
                padding-bottom: 8px;
                margin-bottom: 12px;
              }
              
              .header h1 {
                font-size: 16px;
                font-weight: 800;
                margin: 4px 0 2px 0;
                color: #0f172a;
              }
              
              .header p {
                font-size: 10px;
                color: #64748b;
                margin: 0;
              }
              
              .grid-layout {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-bottom: 10px;
              }
              
              .section-card {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                padding: 8px 10px;
                border-radius: 8px;
                box-sizing: border-box;
              }
              
              .section-title {
                font-size: 10.5px;
                text-transform: uppercase;
                font-weight: 800;
                color: #1e3a8a;
                margin-top: 0;
                margin-bottom: 6px;
                border-bottom: 1.5px solid #e2e8f0;
                padding-bottom: 3px;
                display: flex;
                justify-content: space-between;
              }
              
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 10px;
              }
              
              td {
                padding: 2.5px 0;
              }
              
              .font-mono {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              }
              
              .text-right {
                text-align: ${language === 'ar' ? 'left' : 'right'};
              }
              
              .text-left {
                text-align: ${language === 'ar' ? 'right' : 'left'};
              }
              
              .text-center {
                text-align: center;
              }
              
              .status-banner {
                margin-top: 6px;
                padding: 5px;
                border-radius: 5px;
                text-align: center;
                font-weight: 700;
                font-size: 10px;
              }
              
              .balanced {
                background-color: #ecfdf5 !important;
                color: #065f46 !important;
                border: 1px solid #a7f3d0;
              }
              
              .over {
                background-color: #fffbeb !important;
                color: #92400e !important;
                border: 1px solid #fde68a;
              }
              
              .short {
                background-color: #fff1f2 !important;
                color: #991b1b !important;
                border: 1px solid #fecdd3;
              }
              
              @page {
                size: auto;
                margin: 0 !important; /* Hides default browser header and footer URL completely */
              }

              a[href]:after {
                content: none !important;
              }

              .footer {
                text-align: center;
                font-size: 8.5px;
                color: #94a3b8;
                border-top: 1px solid #e2e8f0;
                padding-top: 6px;
                margin-top: 10px;
              }
              
              @media print {
                html, body {
                  overflow: visible !important;
                }
                body {
                  padding: 12mm 15mm !important; /* Sets secure printable margin on body instead */
                  background: #fff;
                  font-size: 8px !important;
                  zoom: 82%;
                  box-sizing: border-box;
                }
                .no-print {
                  display: none !important;
                }
                .report-container {
                  padding: 0;
                  width: 100%;
                  max-width: 100%;
                  margin: 0;
                }
                .section-card {
                  padding: 4px 6px !important;
                  margin-bottom: 4px !important;
                  border-radius: 6px !important;
                }
                .section-title {
                  font-size: 9.5px !important;
                  margin-bottom: 3px !important;
                  padding-bottom: 1.5px !important;
                }
                table {
                  font-size: 8px !important;
                }
                td {
                  padding: 1.2px 0 !important;
                }
                .grid-layout {
                  gap: 8px !important;
                  margin-bottom: 4px !important;
                }
                .header {
                  padding-bottom: 2px !important;
                  margin-bottom: 5px !important;
                }
                .header h1 {
                  font-size: 12px !important;
                  margin: 1px 0 !important;
                }
                .status-banner {
                  margin-top: 3px !important;
                  padding: 2.5px !important;
                  font-size: 8.5px !important;
                }
                .footer {
                  margin-top: 4px !important;
                  padding-top: 2px !important;
                  font-size: 7.5px !important;
                }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
            <script>
              window.addEventListener('load', () => {
                if (document.fonts && document.fonts.ready) {
                  document.fonts.ready.then(() => {
                    setTimeout(() => {
                      window.focus();
                      window.print();
                      window.onafterprint = () => window.close();
                    }, 500);
                  });
                } else {
                  setTimeout(() => {
                    window.focus();
                    window.print();
                    window.onafterprint = () => window.close();
                  }, 800);
                }
              });
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  return (
    <>
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 transform scale-100 transition duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-xl ${
                modalConfig.type === 'danger' 
                  ? 'bg-rose-50 text-rose-600' 
                  : 'bg-blue-50 text-blue-600'
              }`}>
                {modalConfig.type === 'danger' ? (
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
              </div>
              <h3 className={`text-sm font-black ${
                modalConfig.type === 'danger' ? 'text-rose-600' : 'text-slate-900'
              }`}>
                {modalConfig.title}
              </h3>
            </div>
            
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {modalConfig.desc}
            </p>
            
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/60 transition cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  modalConfig.onConfirm();
                  setModalConfig(prev => ({ ...prev, isOpen: false }));
                }}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition cursor-pointer shadow-xs ${
                  modalConfig.type === 'danger' 
                    ? 'bg-rose-600 hover:bg-rose-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {language === 'ar' ? 'تأكيد الإجراء' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

    <form onSubmit={handleFormSubmit} id="daily-closing-form" className="space-y-4">
      {/* Header Panel with Quick Sync status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">
              <Coins className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Foodics POS <span className="text-blue-600 uppercase text-[10px] tracking-widest ml-2 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{translations[language].cashReconciliation}</span>
            </h1>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {translations[language].compareExpectedDesc}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5 no-print">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors cursor-pointer no-print"
          >
            <RefreshCw className="w-3 h-3" />
            {translations[language].resetForm}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 border border-blue-500 hover:bg-blue-700 rounded transition-colors cursor-pointer no-print shadow-xs"
          >
            <FileDown className="w-3.5 h-3.5" />
            {translations[language].printReport}
          </button>
        </div>
      </div>

      {/* 12-Column Responsive Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ==========================================
            COLUMN 1: SHIFT & DRAWERS (col-span-4)
            ========================================== */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Shift Information Section */}
          <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">{translations[language].shiftInformation}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">{translations[language].businessDate}</label>
                <input
                  type="date"
                  required
                  value={shiftInfo.businessDate}
                  onChange={e => setShiftInfo(prev => ({ ...prev, businessDate: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden transition-all text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">{translations[language].branch}</label>
                  <select
                    value={shiftInfo.branch}
                    onChange={e => setShiftInfo(prev => ({ ...prev, branch: e.target.value }))}
                    className="w-full px-1 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden text-slate-800"
                  >
                    {settings.branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">{translations[language].registerNumber}</label>
                  <input
                    type="text"
                    value={shiftInfo.registerNumber}
                    onChange={e => setShiftInfo(prev => ({ ...prev, registerNumber: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden text-slate-800 text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1">{translations[language].cashierName}</label>
                <select
                  value={shiftInfo.cashier}
                  onChange={e => setShiftInfo(prev => ({ ...prev, cashier: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-blue-200 ring-1 ring-blue-50/50 rounded text-xs font-semibold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                >
                  {settings.cashiers.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1">{translations[language].shift}</label>
                <select
                  value={shiftInfo.shift}
                  onChange={e => setShiftInfo(prev => ({ ...prev, shift: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden text-slate-800"
                >
                  {(settings.shifts || []).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between text-[10px] border-t border-slate-100 pt-3 mt-1 text-slate-500">
                <span className="italic">{language === 'ar' ? 'الافتتاح:' : 'Opening:'} {shiftInfo.openingTime}</span>
                <span className="italic">{language === 'ar' ? 'الإغلاق:' : 'Closing:'} {shiftInfo.closingTime}</span>
              </div>
            </div>
          </section>

          {/* Drawer Operations Section */}
          <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex-1 flex flex-col justify-between gap-4">
            <div>
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">{translations[language].drawerOperations}</h2>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-600">{translations[language].openingFloat}</span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={openingFloat || ''}
                      onChange={e => setOpeningFloat(parseFloat(e.target.value) || 0)}
                      className="w-full text-right py-0.5 px-1.5 border border-slate-200 rounded text-xs font-mono font-bold text-slate-600 bg-slate-50 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-600">{translations[language].payInTotal}</span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={drawer.payIn || ''}
                      onChange={e => handleDrawerChange('payIn', e.target.value)}
                      className="w-full text-right py-0.5 px-1.5 border border-slate-200 rounded text-xs font-mono text-green-600 bg-slate-50 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-600">{translations[language].payOut}</span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={drawer.payOut || ''}
                      onChange={e => handleDrawerChange('payOut', e.target.value)}
                      className="w-full text-right py-0.5 px-1.5 border border-slate-200 rounded text-xs font-mono text-red-500 bg-slate-50 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-600">{translations[language].cashDrops}</span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={drawer.cashDrops || ''}
                      onChange={e => handleDrawerChange('cashDrops', e.target.value)}
                      className="w-full text-right py-0.5 px-1.5 border border-slate-200 rounded text-xs font-mono text-red-500 bg-slate-50 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-600">{translations[language].returnOps}</span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={drawer.returnOperations || ''}
                      onChange={e => handleDrawerChange('returnOperations', e.target.value)}
                      className="w-full text-right py-0.5 px-1.5 border border-slate-200 rounded text-xs font-mono text-slate-600 bg-slate-50 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-600">{translations[language].replacementReturn}</span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={drawer.replacementReturn || ''}
                      onChange={e => handleDrawerChange('replacementReturn', e.target.value)}
                      className="w-full text-right py-0.5 px-1.5 border border-slate-200 rounded text-xs font-mono text-slate-600 bg-slate-50 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-red-600 font-semibold">{translations[language].cashExpenses}</span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={drawer.cashExpenses || ''}
                      onChange={e => handleDrawerChange('cashExpenses', e.target.value)}
                      className="w-full text-right py-0.5 px-1.5 border border-red-200 rounded text-xs font-mono text-red-600 font-bold bg-red-50/20 outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-[9px] text-blue-500 font-bold uppercase mb-0.5">{translations[language].expectedDrawerCash}</div>
              <div className="text-lg font-mono font-black text-blue-950 leading-none">{formatCurrency(expectedCash)}</div>
            </div>
          </section>
        </div>

        {/* ==========================================
            COLUMN 2: PAYMENTS WORKSPACE (col-span-4)
            ========================================== */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{translations[language].paymentBreakdown}</h2>
                <span className="text-[10px] text-slate-400 font-mono italic">{translations[language].refRealtimeLedger}</span>
              </div>
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-400">
                    <tr>
                      <th className="px-4 py-2 border-b font-medium">{translations[language].paymentMethod}</th>
                      <th className="px-4 py-2 border-b font-medium text-right">{translations[language].reportedAmount} ({translations[language].sar})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {/* Cash */}
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-sans font-medium text-slate-700">{translations[language].cashSales}</td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payments.cash || ''}
                          onChange={e => handlePaymentsChange('cash', e.target.value)}
                          className="w-28 text-right py-1 px-2.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden transition"
                        />
                      </td>
                    </tr>

                    {/* Span */}
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-sans font-medium text-slate-700">{translations[language].spanExpected}</td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payments.spanMada || ''}
                          onChange={e => handlePaymentsChange('spanMada', e.target.value)}
                          className="w-28 text-right py-1 px-2.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden transition"
                        />
                      </td>
                    </tr>

                    {/* Keeta */}
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-sans font-medium text-slate-600">{translations[language].keeta}</td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payments.keeta || ''}
                          onChange={e => handlePaymentsChange('keeta', e.target.value)}
                          className="w-28 text-right py-1 px-2.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden transition"
                        />
                      </td>
                    </tr>

                    {/* Hungerstation */}
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-sans font-medium text-slate-600">{translations[language].hungerstation}</td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payments.hungerstation || ''}
                          onChange={e => handlePaymentsChange('hungerstation', e.target.value)}
                          className="w-28 text-right py-1 px-2.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden transition"
                        />
                      </td>
                    </tr>

                    {/* Marsol (Mrsool) */}
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-sans font-medium text-slate-600">{translations[language].mrsool}</td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payments.mrsool || ''}
                          onChange={e => handlePaymentsChange('mrsool', e.target.value)}
                          className="w-28 text-right py-1 px-2.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden transition"
                        />
                      </td>
                    </tr>

                    {/* Jahez */}
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-sans font-medium text-slate-600">{translations[language].jahez}</td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payments.jahez || ''}
                          onChange={e => handlePaymentsChange('jahez', e.target.value)}
                          className="w-28 text-right py-1 px-2.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden transition"
                        />
                      </td>
                    </tr>

                    {/* Total return */}
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-sans font-semibold text-red-600">{translations[language].totalReturns}</td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payments.totalReturns || ''}
                          onChange={e => handlePaymentsChange('totalReturns', e.target.value)}
                          className="w-28 text-right py-1 px-2.5 border border-red-200 rounded-lg text-xs font-mono text-red-600 font-bold bg-red-50/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-3xs outline-hidden transition"
                        />
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase">{translations[language].netPayments} ({translations[language].sar})</th>
                      <th className="px-4 py-3 text-right font-mono text-sm">{formatCurrency(netPaymentsSum)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3 h-16">
               <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col justify-center items-center text-center shadow-2xs">
                  <div className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">{translations[language].netPayments}</div>
                  <div className="text-base font-mono font-bold text-slate-900 leading-none">{formatCurrency(netPaymentsSum)}</div>
               </div>
               <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col justify-center items-center text-center shadow-2xs">
                  <div className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">{translations[language].totalReturns}</div>
                  <div className="text-base font-mono font-bold text-red-600 leading-none">{formatCurrency(payments.totalReturns)}</div>
               </div>
            </div>
          </section>

          {/* Physical Card Count Section */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
            <div>
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h2 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  {language === 'ar' ? 'العد الفعلي للشبكة' : 'Physical Card Count (Terminal)'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setActualCardBreakdown({
                      mada: 0,
                      visa: 0,
                      mastercard: 0,
                      amex: 0,
                      gccNet: 0,
                    });
                  }}
                  className="text-[10px] text-blue-600 hover:underline cursor-pointer font-bold"
                >
                  {translations[language].clearAll}
                </button>
              </div>
              <div className="p-0 overflow-auto max-h-[290px]">
                <table className="w-full text-xs font-mono">
                  <thead className="bg-slate-50/50 text-[9px] text-slate-400 text-left">
                    <tr>
                      <th className="px-4 py-1.5 font-medium">{language === 'ar' ? 'نوع الشبكة' : 'Card Type'}</th>
                      <th className="px-4 py-1.5 font-medium text-right">{translations[language].total} ({translations[language].sar})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* mada */}
                    <tr className="bg-blue-50/10">
                      <td className="px-4 py-2 font-sans text-slate-600 font-bold">
                        {language === 'ar' ? 'مدى' : 'mada'}
                      </td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={actualCardBreakdown.mada || ''}
                          onChange={e => handleActualCardBreakdownChange('mada', e.target.value)}
                          className="w-24 text-right border border-slate-200 rounded-lg py-1 px-2 font-mono text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden"
                        />
                      </td>
                    </tr>
                    {/* Visa */}
                    <tr>
                      <td className="px-4 py-2 font-sans text-slate-600 font-bold">
                        {language === 'ar' ? 'فيزا' : 'Visa'}
                      </td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={actualCardBreakdown.visa || ''}
                          onChange={e => handleActualCardBreakdownChange('visa', e.target.value)}
                          className="w-24 text-right border border-slate-200 rounded-lg py-1 px-2 font-mono text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden"
                        />
                      </td>
                    </tr>
                    {/* MasterCard */}
                    <tr className="bg-blue-50/10">
                      <td className="px-4 py-2 font-sans text-slate-600 font-bold">
                        {language === 'ar' ? 'ماستركارد' : 'MasterCard'}
                      </td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={actualCardBreakdown.mastercard || ''}
                          onChange={e => handleActualCardBreakdownChange('mastercard', e.target.value)}
                          className="w-24 text-right border border-slate-200 rounded-lg py-1 px-2 font-mono text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden"
                        />
                      </td>
                    </tr>
                    {/* AMEX */}
                    <tr>
                      <td className="px-4 py-2 font-sans text-slate-600 font-bold">
                        {language === 'ar' ? 'أمريكان إكسبريس' : 'AMEX'}
                      </td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={actualCardBreakdown.amex || ''}
                          onChange={e => handleActualCardBreakdownChange('amex', e.target.value)}
                          className="w-24 text-right border border-slate-200 rounded-lg py-1 px-2 font-mono text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden"
                        />
                      </td>
                    </tr>
                    {/* GCC Net */}
                    <tr className="bg-blue-50/10">
                      <td className="px-4 py-2 font-sans text-slate-600 font-bold">
                        {language === 'ar' ? 'الشبكة الخليجية' : 'GCC Net'}
                      </td>
                      <td className="px-4 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={actualCardBreakdown.gccNet || ''}
                          onChange={e => handleActualCardBreakdownChange('gccNet', e.target.value)}
                          className="w-24 text-right border border-slate-200 rounded-lg py-1 px-2 font-mono text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase">{language === 'ar' ? 'إجمالي الشبكة الفعلي' : 'Actual Card Total'}</span>
                <span className="text-sm font-mono font-black text-slate-900">{formatCurrency(actualCard)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">{language === 'ar' ? 'المبيعات المتوقعة (مدى فودكس)' : 'Expected Span (Foodics)'}</span>
                <span className="font-mono font-semibold text-slate-700">{formatCurrency(expectedCard)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] border-t border-slate-200/60 pt-1 mt-1">
                <span className="font-bold text-slate-600">{translations[language].cardDifference}</span>
                <span className={`font-mono font-bold ${
                  cardDifference === 0 
                    ? 'text-emerald-600' 
                    : cardDifference > 0 
                    ? 'text-amber-600' 
                    : 'text-rose-600'
                }`}>
                  {cardDifference > 0 ? '+' : ''}{formatCurrency(cardDifference)}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* ==========================================
            COLUMN 3: PHYSICAL COUNT & DEPOSIT (col-span-4)
            ========================================== */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Physical Cash Count Section */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
            <div>
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h2 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{translations[language].physicalCashCount}</h2>
                <button
                  type="button"
                  onClick={() => {
                    setCashCount({
                      sar500: 0,
                      sar200: 0,
                      sar100: 0,
                      sar50: 0,
                      sar20: 0,
                      sar10: 0,
                      sar5: 0,
                      sar1: 0,
                      sar0_50: 0,
                      sar0_25: 0,
                    });
                  }}
                  className="text-[10px] text-blue-600 hover:underline cursor-pointer font-bold"
                >
                  {translations[language].clearAll}
                </button>
              </div>
              <div className="p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  {DENOMINATIONS.map((denom) => {
                    const key = getDenominationKey(denom.value);
                    const qty = cashCount[key] || 0;
                    const lineTotal = qty * denom.value;

                    return (
                      <div key={denom.label} className="bg-slate-50/40 border border-slate-200/55 rounded-xl p-2 flex flex-col justify-between hover:border-slate-300/80 transition-all duration-150">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10.5px] font-extrabold text-slate-700">{denom.label}</span>
                          <span className="text-[9.5px] font-mono text-slate-400 font-bold">{lineTotal > 0 ? formatCurrency(lineTotal) : ''}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => adjustDenomination(key, -1)}
                            className="w-7 h-7 bg-white hover:bg-slate-100 active:scale-95 rounded-lg border border-slate-200 text-slate-600 font-black flex items-center justify-center cursor-pointer transition shadow-3xs text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={qty === 0 ? '' : qty}
                            onChange={e => handleDenominationChange(key, parseInt(e.target.value) || 0)}
                            className="w-10 text-center border border-slate-200 rounded-lg py-1 font-mono text-xs font-black text-slate-800 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-3xs outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => adjustDenomination(key, 1)}
                            className="w-7 h-7 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black flex items-center justify-center cursor-pointer transition shadow-3xs text-xs rounded-lg"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200">
               <div className="flex justify-between items-center">
                 <span className="text-[10px] text-slate-500 font-bold uppercase">{language === 'ar' ? 'النقد الفعلي الإجمالي' : 'Actual Cash Count'}</span>
                 <span className="text-base font-mono font-black text-slate-900">{formatCurrency(actualCashCount)}</span>
               </div>
            </div>
          </section>

          {/* Notes & Verification Section */}
          <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {language === 'ar' ? 'ملاحظات التحقق والاعتماد' : 'Verification & Notes'}
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">{translations[language].shiftNotes}</label>
                <textarea
                  placeholder={language === 'ar' ? 'اكتب ملاحظاتك عن الشفت مثل العجز أو الزيادة أو المصاريف...' : 'Note any reasons for shortage/overage, expenses, or events...'}
                  value={deposit.notes}
                  onChange={e => setDeposit(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none h-14 resize-none transition-all"
                />
              </div>

            </div>
          </section>

          {/* Geometric Reconciliation Status Banner (SOLID CARD, high impact) */}
          <section className={`rounded-2xl p-4 flex flex-col justify-center items-center relative overflow-hidden shadow-lg transition-all ${
            status === 'Balanced' 
              ? 'bg-emerald-500 shadow-emerald-200/50 text-white' 
              : status === 'Over' 
              ? 'bg-amber-500 shadow-amber-200/50 text-white' 
              : 'bg-red-500 shadow-red-200/50 text-white'
          }`}>
             <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
             <div className="text-white/80 uppercase text-[9px] font-bold tracking-[0.2em] mb-1">{translations[language].custodyStatus}</div>
             <div className="text-xl font-black text-white flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-slate-800 text-xs font-bold">
                  {status === 'Balanced' ? '✓' : status === 'Over' ? '↑' : '↓'}
                </span>
                {language === 'ar' 
                  ? (status === 'Balanced' ? 'متطابق' : status === 'Over' ? 'زيادة' : 'عجز/نقص')
                  : status.toUpperCase()}
             </div>
             
             <div className="w-full border-t border-white/20 pt-2 mt-1 space-y-1 text-center font-mono text-[11px] text-white/90">
               <div className="flex justify-between px-2">
                 <span>{translations[language].cashDifference}:</span>
                 <span className="font-bold">{cashDifference > 0 ? '+' : ''}{formatCurrency(cashDifference)}</span>
               </div>
               <div className="flex justify-between px-2">
                 <span>{translations[language].cardDifference}:</span>
                 <span className="font-bold">{cardDifference > 0 ? '+' : ''}{formatCurrency(cardDifference)}</span>
               </div>
               <div className="flex justify-between px-2 border-t border-white/10 pt-1 font-bold text-xs">
                 <span>{translations[language].custodyDifference}:</span>
                 <span>{overallDifference > 0 ? '+' : ''}{formatCurrency(overallDifference)}</span>
               </div>
             </div>
          </section>
        </div>

      </div>

      {/* Modern footer section with signatures and save buttons matching the Geometric Balance footer style */}
      <footer className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
        <div className="flex flex-wrap gap-6">
           <div className="flex items-center gap-2">
             <span className="w-3.5 h-3.5 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-[10px] font-black">✓</span>
             <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{language === 'ar' ? 'تم فحص ومطابقة العهدة' : 'Custody Reconciled'}</span>
           </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto no-print">
          <button
            type="button"
            onClick={resetForm}
            className="flex-1 sm:flex-initial px-5 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            {translations[language].clearForm}
          </button>
          <button
            type="submit"
            disabled={isSyncing}
            className="flex-1 sm:flex-initial px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-200/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {translations[language].saving}
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {translations[language].submitCloseShift}
              </>
            )}
          </button>
        </div>
      </footer>
    </form>
    </>
  );
}
