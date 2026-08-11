/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DailyClosingRecord, AppSettings } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { Search, Filter, ArrowUpDown, ChevronDown, Download, Eye, FileSpreadsheet, Trash2, Printer, TrendingUp, Wallet, CreditCard, Calendar, DollarSign, CheckCircle2, AlertCircle, XCircle, FileText, Layers, Info, Coins, Receipt, FileDown } from 'lucide-react';
import { translations, Language } from '../lib/translations';

interface DailyLogTabProps {
  logs: DailyClosingRecord[];
  onDeleteLog: (id: string, permanent?: boolean) => void;
  onExportCSV: () => void;
  isSyncing: boolean;
  language: Language;
}

export default function DailyLogTab({
  logs,
  onDeleteLog,
  onExportCSV,
  isSyncing,
  language,
}: DailyLogTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [cashierFilter, setCashierFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState<keyof DailyClosingRecord | 'date'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DailyClosingRecord | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const printViaWindow = (title: string, htmlContent: string, customStyles: string = '') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(language === 'ar' ? 'الرجاء السماح بالنوافذ المنبثقة للطباعة' : 'Please allow popups to print');
      return;
    }

    // Capture existing stylesheets from parent page to ensure everything matches
    const parentStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          ${parentStyles}
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700;800&family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@400;500;700&family=Almarai:wght@400;700&family=Noto+Sans+Arabic:wght@400;500;700&display=swap');
            
            @font-face {
              font-family: 'Thmanyah Display Bold';
              src: url('/fonts/ThmanyahDisplay-Bold.woff2') format('woff2'),
                   local('Thmanyah Display Bold'),
                   local('ThmanyahDisplay-Bold'),
                   local('Cairo-Bold'),
                   local('Cairo');
              font-weight: bold;
              font-style: normal;
              font-display: swap;
            }
            @font-face {
              font-family: 'Thmanyah';
              src: url('/fonts/ThmanyahDisplay-Regular.woff2') format('woff2'),
                   local('Thmanyah Display'),
                   local('ThmanyahDisplay'),
                   local('Cairo');
              font-weight: normal;
              font-style: normal;
              font-display: swap;
            }
            @font-face {
              font-family: 'Thmaniyah';
              src: url('/fonts/ThmanyahDisplay-Regular.woff2') format('woff2'),
                   local('Thmanyah Display'),
                   local('ThmanyahDisplay'),
                   local('Cairo');
              font-weight: normal;
              font-style: normal;
              font-display: swap;
            }
            @font-face {
              font-family: 'Thmaniyah';
              src: url('/fonts/ThmanyahDisplay-Bold.woff2') format('woff2'),
                   local('Thmanyah Display Bold'),
                   local('ThmanyahDisplay-Bold'),
                   local('Cairo-Bold');
              font-weight: bold;
              font-style: normal;
              font-display: swap;
            }

            body, button, input, select, textarea, span, p, h1, h2, h3, h4, h5, h6, div, td, th {
              font-family: "Thmaniyah", "Thmanyah", "IBM Plex Sans Arabic", "Inter", "Cairo", sans-serif !important;
            }

            html, body {
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            @media print {
              html, body {
                overflow: visible !important;
                height: auto !important;
                background: #ffffff !important;
              }
              .no-print {
                display: none !important;
              }
              .print-wrapper {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                width: 100% !important;
                max-width: 100% !important;
              }
            }
            ${customStyles}
          </style>
        </head>
        <body>
          ${htmlContent}
          <script>
            window.addEventListener('load', () => {
              const doPrint = () => {
                window.focus();
                window.print();
              };

              if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(() => {
                  setTimeout(doPrint, 500);
                });
              } else {
                setTimeout(doPrint, 800);
              }
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print helper for list of logs
  const handlePrintLogsList = () => {
    const title = language === 'ar' ? 'سجل تسويات النقدية اليومية' : 'Daily Cash Reconciliation Logs';
    const rowsHtml = filteredLogs.map(log => {
      const cardSales =
        (log.payments.spanMada || 0) +
        (log.payments.visa || 0) +
        (log.payments.mastercard || 0) +
        (log.payments.gccNetwork || 0);

      const deliverySales =
        (log.payments.keeta || 0) +
        (log.payments.hungerstation || 0) +
        (log.payments.jahez || 0) +
        (log.payments.mrsool || 0);

      const totalSales = (log.payments.cash || 0) + cardSales + deliverySales + (log.payments.otherPayments || 0);
      const diffColor = log.reconciliation.difference === 0 ? 'color: #16a34a; font-weight: bold;' : log.reconciliation.difference > 0 ? 'color: #d97706; font-weight: bold;' : 'color: #dc2626; font-weight: bold;';
      const statusText = language === 'ar' 
        ? (log.reconciliation.status === 'Balanced' ? 'متطابق' : log.reconciliation.status === 'Over' ? 'زيادة' : 'عجز')
        : log.reconciliation.status;

      const statusBg = log.reconciliation.status === 'Balanced' ? '#dcfce7' : log.reconciliation.status === 'Over' ? '#fef3c7' : '#fee2e2';
      const statusColor = log.reconciliation.status === 'Balanced' ? '#166534' : log.reconciliation.status === 'Over' ? '#92400e' : '#991b1b';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px;">
          <td style="padding: 10px 8px; font-weight: bold; color: #0f172a; white-space: nowrap;">${formatDate(log.shiftInfo.businessDate)}</td>
          <td style="padding: 10px 8px; color: #334155; font-weight: 600;">${log.shiftInfo.branch}</td>
          <td style="padding: 10px 8px; color: #475569;">${log.shiftInfo.cashier}</td>
          <td style="padding: 10px 8px; color: #475569;">${
            log.shiftInfo.shift === 'Morning' || log.shiftInfo.shift === 'Morning Shift'
              ? (language === 'ar' ? 'صباحي' : 'Morning')
              : log.shiftInfo.shift === 'Evening' || log.shiftInfo.shift === 'Evening Shift'
              ? (language === 'ar' ? 'مسائي' : 'Evening')
              : log.shiftInfo.shift
          }</td>
          <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: 500; color: #334155;">${formatCurrency(log.payments.cash)}</td>
          <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: bold; color: #2563eb;">${formatCurrency(totalSales)}</td>
          <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: 500; color: #dc2626;">-${formatCurrency(log.drawerOperations.cashExpenses)}</td>
          <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: 500; color: #334155;">${formatCurrency(log.reconciliation.expectedCash)}</td>
          <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: 500; color: #334155;">${formatCurrency(log.reconciliation.actualCash)}</td>
          <td style="padding: 10px 8px; text-align: right; font-family: monospace; ${diffColor}">
            ${log.reconciliation.difference > 0 ? '+' : ''}${formatCurrency(log.reconciliation.difference)}
          </td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="display: inline-block; padding: 2.5px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; background: ${statusBg}; color: ${statusColor}; text-transform: uppercase;">
              ${statusText}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <div class="print-wrapper" style="direction: ${language === 'ar' ? 'rtl' : 'ltr'}; font-family: 'Thmaniyah', 'Thmanyah', 'Cairo', 'Inter', system-ui, sans-serif;">
        <!-- Corporate Header Block -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 48px; height: 48px; background: #0f172a; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 16px; font-family: 'Thmaniyah', 'Thmanyah', 'Cairo', sans-serif;">8oz</div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 9px; text-transform: uppercase; font-weight: 800; color: #2563eb; display: inline-block; letter-spacing: 0.1em;">
                  ${language === 'ar' ? 'سجل الإغلاقات والمطابقة' : 'CLOSING LOGS & RECONCILIATION'}
                </span>
                <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 800; color: #16a34a; background: #f0fdf4; border: 1.5px solid #16a34a; padding: 3px 10px; border-radius: 6px; font-family: 'Cairo', sans-serif; text-transform: uppercase;">
                  <span style="font-size: 13px; line-height: 1; font-weight: 900;">✓</span> ${language === 'ar' ? 'اعتماد 8oz' : '8oz Certified'}
                </span>
              </div>
              <h1 style="font-size: 18px; font-weight: 900; margin: 2px 0 0 0; color: #0f172a; line-height: 1.2;">
                ${title}
              </h1>
            </div>
          </div>
          <div style="text-align: ${language === 'ar' ? 'left' : 'right'}; font-family: 'Thmaniyah', 'Thmanyah', 'Cairo', sans-serif; font-size: 10.5px; color: #475569; line-height: 1.45;">
            <div style="font-weight: 700;">${language === 'ar' ? 'تاريخ التصدير:' : 'Export Date:'} ${new Date().toLocaleDateString('ar-SA')}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: ${language === 'ar' ? 'right' : 'left'};">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2.5px solid #0f172a; font-size: 10px; font-weight: bold; color: #0f172a; text-transform: uppercase;">
              <th style="padding: 12px 8px;">${translations[language].date}</th>
              <th style="padding: 12px 8px;">${translations[language].branch}</th>
              <th style="padding: 12px 8px;">${translations[language].cashierName}</th>
              <th style="padding: 12px 8px;">${translations[language].shift}</th>
              <th style="padding: 12px 8px; text-align: right;">${translations[language].cashSales}</th>
              <th style="padding: 12px 8px; text-align: right;">${translations[language].netRevenueSum}</th>
              <th style="padding: 12px 8px; text-align: right;">${translations[language].cashExpenses}</th>
              <th style="padding: 12px 8px; text-align: right;">${translations[language].expectedDrawerCash}</th>
              <th style="padding: 12px 8px; text-align: right;">${translations[language].actualCashCounted}</th>
              <th style="padding: 12px 8px; text-align: right;">${translations[language].difference}</th>
              <th style="padding: 12px 8px; text-align: center;">${translations[language].status}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    printViaWindow(title, htmlContent, `
      @page {
        size: A4 landscape !important;
        margin: 10mm !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        width: 277mm !important; /* A4 Landscape width (297 - 2*10 margins) */
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-wrapper {
        width: 100% !important;
        max-width: 100% !important;
        overflow: hidden !important;
      }
      table {
        font-size: 11px !important;
        table-layout: fixed !important;
        width: 100% !important;
        word-wrap: break-word !important;
      }
      th, td {
        padding: 6px 4px !important;
        overflow: hidden !important;
      }
    `);
  };

  // Print helper for individual shift log
  const handlePrintSingleRecord = (record: DailyClosingRecord) => {
    const title = language === 'ar' ? `تقرير تسوية - ${record.shiftInfo.businessDate}` : `Reconciliation Report - ${record.shiftInfo.businessDate}`;
    const cardSales =
      (record.payments.spanMada || 0) +
      (record.payments.visa || 0) +
      (record.payments.mastercard || 0) +
      (record.payments.gccNetwork || 0);

    const deliverySales =
      (record.payments.keeta || 0) +
      (record.payments.hungerstation || 0) +
      (record.payments.jahez || 0) +
      (record.payments.mrsool || 0);

    const totalSales = (record.payments.cash || 0) + cardSales + deliverySales + (record.payments.otherPayments || 0);
    
    const cashDiff = record.reconciliation.difference;
    const cardDiff = record.reconciliation.cardDifference ?? 0;
    const overallDiff = record.reconciliation.overallDifference ?? cashDiff;

    const cardBreakdownData = record.cardBreakdown || {
      mada: record.reconciliation.actualCard ?? 0,
      visa: 0,
      mastercard: 0,
      amex: 0,
      gccNet: 0,
    };

    const statusText = language === 'ar' 
      ? (record.reconciliation.status === 'Balanced' ? 'متطابق' : record.reconciliation.status === 'Over' ? 'زيادة' : 'عجز')
      : record.reconciliation.status;

    let shiftText = record.shiftInfo.shift;
    if (record.shiftInfo.shift === 'Morning' || record.shiftInfo.shift === 'Morning Shift') {
      shiftText = translations[language].morningShift;
    } else if (record.shiftInfo.shift === 'Evening' || record.shiftInfo.shift === 'Evening Shift') {
      shiftText = translations[language].eveningShift;
    }

    const htmlContent = `
      <div class="print-wrapper" style="direction: ${language === 'ar' ? 'rtl' : 'ltr'}; font-family: 'Thmaniyah', 'Thmanyah', 'Cairo', 'Inter', sans-serif; color: #0f172a; max-width: 820px; margin: 0 auto; padding: 2px; box-sizing: border-box;">
        
        <!-- Corporate Header Block -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 48px; height: 48px; background: #0f172a; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 16px; font-family: 'Thmaniyah', 'Thmanyah', 'Cairo', sans-serif;">8oz</div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 9px; text-transform: uppercase; font-weight: 800; color: #2563eb; display: inline-block; letter-spacing: 0.1em;">
                  ${translations[language].reconciliationReceipt}
                </span>
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 8px; font-weight: 900; color: #16a34a; background: #dcfce7; border: 1px solid #bbf7d0; padding: 1px 6px; border-radius: 9999px; font-family: 'Cairo', sans-serif;">
                  <span style="font-size: 10px; line-height: 1;">✓</span> ${language === 'ar' ? 'معتمد 8oz' : '8oz Certified'}
                </span>
              </div>
              <h2 style="font-size: 18px; font-weight: 900; margin: 2px 0 0 0; color: #0f172a; line-height: 1.2;">
                ${language === 'ar' ? 'تقرير مطابقة وإغلاق الوردية 8oz' : '8oz Shift Closing & Reconciliation Report'}
              </h2>
            </div>
          </div>
          <div style="text-align: ${language === 'ar' ? 'left' : 'right'}; font-family: 'Thmaniyah', 'Thmanyah', 'Cairo', sans-serif; font-size: 10.5px; color: #475569; line-height: 1.45;">
            <div>ID: <span style="font-weight: 900; color: #0f172a; font-family: monospace;">${record.id}</span></div>
            <div style="font-weight: 700;">${formatDate(record.shiftInfo.businessDate)}</div>
          </div>
        </div>

        <!-- 3 KPI Dashboard Badges -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <!-- KPI 1: Net Revenue -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">
              ${language === 'ar' ? 'صافي المبيعات والإيرادات' : 'Net Sales & Revenue'}
            </div>
            <div style="font-size: 16px; font-weight: 900; color: #0f172a;">
              ${formatCurrency(totalSales)}
            </div>
            <div style="font-size: 9px; color: #64748b; margin-top: 4px; display: flex; justify-content: space-between;">
              <span>Csh: ${formatCurrency(record.payments.cash)}</span>
              <span>Crd: ${formatCurrency(cardSales)}</span>
            </div>
          </div>

          <!-- KPI 2: Cash Variance -->
          <div style="background: ${cashDiff === 0 ? '#f0fdf4' : cashDiff > 0 ? '#fffbeb' : '#fef2f2'}; border: 1px solid ${cashDiff === 0 ? '#bbf7d0' : cashDiff > 0 ? '#fef08a' : '#fecaca'}; border-radius: 12px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 4px;">
              ${translations[language].cashDifference}
            </div>
            <div style="font-size: 16px; font-weight: 900; color: ${cashDiff === 0 ? '#15803d' : cashDiff > 0 ? '#b45309' : '#b91c1c'};">
              ${cashDiff > 0 ? '+' : ''}${formatCurrency(cashDiff)}
            </div>
            <div style="font-size: 9px; color: #64748b; margin-top: 4px; display: flex; justify-content: space-between;">
              <span>Exp: ${formatCurrency(record.reconciliation.expectedCash)}</span>
              <span>Act: ${formatCurrency(record.reconciliation.actualCash)}</span>
            </div>
          </div>

          <!-- KPI 3: Card Variance -->
          <div style="background: ${cardDiff === 0 ? '#f0fdf4' : cardDiff > 0 ? '#fffbeb' : '#fef2f2'}; border: 1px solid ${cardDiff === 0 ? '#bbf7d0' : cardDiff > 0 ? '#fef08a' : '#fecaca'}; border-radius: 12px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 4px;">
              ${translations[language].cardDifference}
            </div>
            <div style="font-size: 16px; font-weight: 900; color: ${cardDiff === 0 ? '#15803d' : cardDiff > 0 ? '#b45309' : '#b91c1c'};">
              ${cardDiff > 0 ? '+' : ''}${formatCurrency(cardDiff)}
            </div>
            <div style="font-size: 9px; color: #64748b; margin-top: 4px; display: flex; justify-content: space-between;">
              <span>Exp: ${formatCurrency(record.reconciliation.expectedCard ?? 0)}</span>
              <span>Act: ${formatCurrency(record.reconciliation.actualCard ?? 0)}</span>
            </div>
          </div>
        </div>

        <!-- Main Grid Layout -->
        <div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 12px; margin-bottom: 12px; align-items: start;">
          
          <!-- LEFT SIDE: Shift Info, Drawer calculations & Payments Breakdown -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            
            <!-- Panel: Shift Metadata -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #0f172a; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                ${translations[language].shiftInformation}
              </div>
              <table style="width: 100%; font-size: 11px; border-collapse: collapse; line-height: 1.6;">
                <tr>
                  <td style="padding: 2.5px 0; color: #475569;">${translations[language].businessDate}</td>
                  <td style="padding: 2.5px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #0f172a;">${formatDate(record.shiftInfo.businessDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 2.5px 0; color: #475569;">${translations[language].branch}</td>
                  <td style="padding: 2.5px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #0f172a;">${record.shiftInfo.branch}</td>
                </tr>
                <tr>
                  <td style="padding: 2.5px 0; color: #475569;">${translations[language].cashierName}</td>
                  <td style="padding: 2.5px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #0f172a;">${record.shiftInfo.cashier}</td>
                </tr>
                <tr>
                  <td style="padding: 2.5px 0; color: #475569;">${translations[language].shift}</td>
                  <td style="padding: 2.5px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #0f172a;">${shiftText}</td>
                </tr>
                <tr>
                  <td style="padding: 2.5px 0; color: #475569;">${translations[language].registerNumber}</td>
                  <td style="padding: 2.5px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #0f172a;">${record.shiftInfo.registerNumber}</td>
                </tr>
              </table>
            </div>

            <!-- Panel: Drawer Operations Calculations -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #0f172a; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                <span>${translations[language].drawerOperations}</span>
                <span style="font-size: 8px; color: #94a3b8; text-transform: uppercase; font-weight: bold;">CASH FLOW</span>
              </div>
              <table style="width: 100%; font-size: 11px; border-collapse: collapse; line-height: 1.6;">
                <tr>
                  <td style="padding: 2px 0; color: #475569;">${translations[language].openingFloat}</td>
                  <td style="padding: 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #334155;">${formatCurrency(record.openingFloat || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; color: #475569;">${translations[language].payInTotal}</td>
                  <td style="padding: 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #16a34a;">+${formatCurrency(record.drawerOperations?.payIn || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; color: #475569;">${translations[language].payOut}</td>
                  <td style="padding: 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #dc2626;">-${formatCurrency(record.drawerOperations?.payOut || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; color: #475569;">${translations[language].cashDrops}</td>
                  <td style="padding: 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #dc2626;">-${formatCurrency(record.drawerOperations?.cashDrops || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; color: #475569;">${translations[language].returnOps}</td>
                  <td style="padding: 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #dc2626;">-${formatCurrency(record.drawerOperations?.returnOperations || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; color: #475569;">${translations[language].replacementReturn}</td>
                  <td style="padding: 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #475569;">${formatCurrency(record.drawerOperations?.replacementReturn || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; color: #475569;">${translations[language].cashExpenses}</td>
                  <td style="padding: 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #dc2626;">-${formatCurrency(record.drawerOperations?.cashExpenses || 0)}</td>
                </tr>
                <tr style="border-top: 1.5px solid #e2e8f0; font-weight: bold;">
                  <td style="padding: 4px 0 0 0; color: #0f172a;">${translations[language].expectedDrawerCash}</td>
                  <td style="padding: 4px 0 0 0; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #0f172a; font-size: 12px;">${formatCurrency(record.reconciliation?.expectedCash || 0)}</td>
                </tr>
              </table>
            </div>

            <!-- Panel: Payments Channel Breakdown -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #0f172a; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                ${translations[language].paymentBreakdown}
              </div>
              <table style="width: 100%; font-size: 11px; border-collapse: collapse; line-height: 1.5;">
                <tr>
                  <td style="padding: 2px 0; color: #334155; font-weight: bold;">${translations[language].cashSales}</td>
                  <td style="padding: 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #0f172a;">${formatCurrency(record.payments.cash)}</td>
                </tr>
                <tr>
                  <td style="padding: 1.5px 0 1.5px 8px; color: #64748b;">&bull; ${translations[language].spanExpected}</td>
                  <td style="padding: 1.5px 0; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #475569;">${formatCurrency(record.payments.spanMada)}</td>
                </tr>
                <tr>
                  <td style="padding: 1.5px 0 1.5px 8px; color: #64748b;">&bull; ${translations[language].keeta}</td>
                  <td style="padding: 1.5px 0; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #475569;">${formatCurrency(record.payments.keeta)}</td>
                </tr>
                <tr>
                  <td style="padding: 1.5px 0 1.5px 8px; color: #64748b;">&bull; ${translations[language].hungerstation}</td>
                  <td style="padding: 1.5px 0; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #475569;">${formatCurrency(record.payments.hungerstation)}</td>
                </tr>
                <tr>
                  <td style="padding: 1.5px 0 1.5px 8px; color: #64748b;">&bull; ${translations[language].jahez}</td>
                  <td style="padding: 1.5px 0; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #475569;">${formatCurrency(record.payments.jahez)}</td>
                </tr>
                <tr>
                  <td style="padding: 1.5px 0 1.5px 8px; color: #64748b;">&bull; ${translations[language].mrsool}</td>
                  <td style="padding: 1.5px 0; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #475569;">${formatCurrency(record.payments.mrsool)}</td>
                </tr>
                <tr style="border-top: 1px dashed #cbd5e1;">
                  <td style="padding: 2.5px 0; color: #334155; font-weight: bold;">${translations[language].otherPayments}</td>
                  <td style="padding: 2.5px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #0f172a;">${formatCurrency(record.payments.otherPayments)}</td>
                </tr>
                <tr style="border-top: 1px solid #e2e8f0; font-weight: bold; color: #b91c1c;">
                  <td style="padding: 3px 0 0 0;">${translations[language].totalReturns}</td>
                  <td style="padding: 3px 0 0 0; text-align: ${language === 'ar' ? 'left' : 'right'}; font-weight: bold;">${formatCurrency(record.payments.totalReturns)}</td>
                </tr>
              </table>
            </div>

          </div>

          <!-- RIGHT SIDE: Physical Count table & Reconciliation details -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            
            <!-- Panel: Physical Cash Count with ALL Denominations -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #0f172a; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                ${translations[language].physicalCashCount}
              </div>
              <table style="width: 100%; font-size: 10.5px; border-collapse: collapse; line-height: 1.45;">
                <thead>
                  <tr style="border-bottom: 1px solid #cbd5e1; color: #64748b; font-weight: bold;">
                    <th style="text-align: ${language === 'ar' ? 'right' : 'left'}; padding-bottom: 3px;">${translations[language].denomination}</th>
                    <th style="text-align: center; padding-bottom: 3px;">${translations[language].qty}</th>
                    <th style="text-align: right; padding-bottom: 3px;">${translations[language].total}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td style="padding: 1.5px 0; color: #475569;">500 ${translations[language].sar}</td><td style="text-align: center; font-weight: bold; color: #0f172a;">${record.cashCount.sar500}</td><td style="text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(record.cashCount.sar500 * 500)}</td></tr>
                  <tr><td style="padding: 1.5px 0; color: #475569;">200 ${translations[language].sar}</td><td style="text-align: center; font-weight: bold; color: #0f172a;">${record.cashCount.sar200}</td><td style="text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(record.cashCount.sar200 * 200)}</td></tr>
                  <tr><td style="padding: 1.5px 0; color: #475569;">100 ${translations[language].sar}</td><td style="text-align: center; font-weight: bold; color: #0f172a;">${record.cashCount.sar100}</td><td style="text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(record.cashCount.sar100 * 100)}</td></tr>
                  <tr><td style="padding: 1.5px 0; color: #475569;">50 ${translations[language].sar}</td><td style="text-align: center; font-weight: bold; color: #0f172a;">${record.cashCount.sar5}</td><td style="text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(record.cashCount.sar50 * 50)}</td></tr>
                  <tr><td style="padding: 1.5px 0; color: #475569;">20 ${translations[language].sar}</td><td style="text-align: center; font-weight: bold; color: #0f172a;">${record.cashCount.sar20}</td><td style="text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(record.cashCount.sar20 * 20)}</td></tr>
                  <tr><td style="padding: 1.5px 0; color: #475569;">10 ${translations[language].sar}</td><td style="text-align: center; font-weight: bold; color: #0f172a;">${record.cashCount.sar10}</td><td style="text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(record.cashCount.sar10 * 10)}</td></tr>
                  <tr><td style="padding: 1.5px 0; color: #475569;">5 ${translations[language].sar}</td><td style="text-align: center; font-weight: bold; color: #0f172a;">${record.cashCount.sar5}</td><td style="text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(record.cashCount.sar5 * 5)}</td></tr>
                  <tr><td style="padding: 1.5px 0; color: #475569;">1 ${translations[language].sar}</td><td style="text-align: center; font-weight: bold; color: #0f172a;">${record.cashCount.sar1}</td><td style="text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(record.cashCount.sar1 * 1)}</td></tr>
                  <tr><td style="padding: 1.5px 0; color: #475569;">0.50 ${translations[language].sar}</td><td style="text-align: center; font-weight: bold; color: #0f172a;">${record.cashCount.sar0_50}</td><td style="text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(record.cashCount.sar0_50 * 0.5)}</td></tr>
                  <tr><td style="padding: 1.5px 0; color: #475569;">0.25 ${translations[language].sar}</td><td style="text-align: center; font-weight: bold; color: #0f172a;">${record.cashCount.sar0_25 || 0}</td><td style="text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency((record.cashCount.sar0_25 || 0) * 0.25)}</td></tr>
                  <tr style="border-top: 2px solid #cbd5e1; font-weight: bold; font-size: 11px;">
                    <td style="padding-top: 5px; color: #0f172a;">${language === 'ar' ? 'الإجمالي الفعلي الكلي' : 'Total Actual Cash'}</td>
                    <td></td>
                    <td style="padding-top: 5px; text-align: right; color: #2563eb; font-weight: 900;">${formatCurrency(record.reconciliation.actualCash)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Panel: Reconciliation Status Details -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #0f172a; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                ${translations[language].custodyStatus}
              </div>
              <table style="width: 100%; font-size: 11px; border-collapse: collapse; line-height: 1.6;">
                <tr>
                  <td style="padding: 2px 0; color: #64748b;">${translations[language].expectedDrawerCash}</td>
                  <td style="padding: 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #0f172a;">${formatCurrency(record.reconciliation.expectedCash)}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; color: #64748b;">${translations[language].actualCashCounted}</td>
                  <td style="padding: 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #2563eb;">${formatCurrency(record.reconciliation.actualCash)}</td>
                </tr>
                <tr style="border-bottom: 1px dashed #cbd5e1;">
                  <td style="padding: 2px 0 4px 0; color: #475569;">${translations[language].cashDifference}</td>
                  <td style="padding: 2px 0 4px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: ${cashDiff === 0 ? '#15803d' : cashDiff > 0 ? '#b45309' : '#b91c1c'};">
                    ${cashDiff > 0 ? '+' : ''}${formatCurrency(cashDiff)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 3px 0 2px 0; color: #64748b;">${translations[language].expectedCard}</td>
                  <td style="padding: 3px 0 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #0f172a;">${formatCurrency(record.reconciliation.expectedCard ?? 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; color: #64748b;">${translations[language].actualCard}</td>
                  <td style="padding: 2px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #2563eb;">${formatCurrency(record.reconciliation.actualCard ?? 0)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 2px 0;">
                    <table style="width: 100%; font-size: 8.5px; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin: 2px 0; line-height: 1.25;">
                      <tr>
                        <td style="padding: 1px 6px; color: #64748b;">&bull; ${translations[language].actualCardMada}</td>
                        <td style="padding: 1px 6px; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #475569;">${formatCurrency(cardBreakdownData.mada ?? 0)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 1px 6px; color: #64748b;">&bull; ${translations[language].actualCardVisa}</td>
                        <td style="padding: 1px 6px; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #475569;">${formatCurrency(cardBreakdownData.visa ?? 0)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 1px 6px; color: #64748b;">&bull; ${translations[language].actualCardMastercard}</td>
                        <td style="padding: 1px 6px; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #475569;">${formatCurrency(cardBreakdownData.mastercard ?? 0)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 1px 6px; color: #64748b;">&bull; ${translations[language].actualCardAmex}</td>
                        <td style="padding: 1px 6px; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #475569;">${formatCurrency(cardBreakdownData.amex ?? 0)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 1px 6px; color: #64748b;">&bull; ${translations[language].actualCardGcc}</td>
                        <td style="padding: 1px 6px; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #475569;">${formatCurrency(cardBreakdownData.gccNet ?? 0)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr style="border-bottom: 1.5px solid #e2e8f0;">
                  <td style="padding: 2px 0 4px 0; color: #475569;">${translations[language].cardDifference}</td>
                  <td style="padding: 2px 0 4px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: ${cardDiff === 0 ? '#15803d' : cardDiff > 0 ? '#b45309' : '#b91c1c'}">
                    ${cardDiff > 0 ? '+' : ''}${formatCurrency(cardDiff)}
                  </td>
                </tr>
                <tr style="font-weight: bold; font-size: 11.5px;">
                  <td style="padding-top: 6px; color: #0f172a;">${translations[language].custodyDifference}</td>
                  <td style="padding-top: 6px; text-align: ${language === 'ar' ? 'left' : 'right'}; color: ${overallDiff === 0 ? '#15803d' : overallDiff > 0 ? '#b45309' : '#b91c1c'};">
                    ${overallDiff > 0 ? '+' : ''}${formatCurrency(overallDiff)}
                  </td>
                </tr>
              </table>
              <div style="margin-top: 8px; padding: 6px; border-radius: 8px; text-align: center; font-size: 11px; font-weight: bold; background-color: ${
                record.reconciliation.status === 'Balanced' ? '#f0fdf4; color: #166534;' : record.reconciliation.status === 'Over' ? '#fffbeb; color: #92400e;' : '#fef2f2; color: #991b1b;'
              }; border: 1px solid ${
                record.reconciliation.status === 'Balanced' ? '#bbf7d0' : record.reconciliation.status === 'Over' ? '#fef08a' : '#fecaca'
              };">
                ${language === 'ar' ? 'حالة المطابقة:' : 'Reconciliation Status:'} <span style="text-transform: uppercase;">${statusText}</span>
              </div>
            </div>

          </div>

        </div>

        <!-- BOTTOM BLOCK: Deposit Information & Signatures -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 2.5px solid #0f172a; padding-top: 10px; margin-top: 6px;">
          
          <!-- Deposit and Float info -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px;">
                ${translations[language].depositAndRetention}
              </div>
              <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 2.5px 0; color: #475569;">${translations[language].amountToDeposit}</td>
                  <td style="padding: 2.5px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #15803d; font-size: 11.5px;">${formatCurrency(record.deposit.amountToDeposit)}</td>
                </tr>
                <tr>
                  <td style="padding: 2.5px 0; color: #475569;">${translations[language].remainingFloat}</td>
                  <td style="padding: 2.5px 0; font-weight: bold; text-align: ${language === 'ar' ? 'left' : 'right'}; color: #0f172a;">${formatCurrency(record.deposit.remainingFloat)}</td>
                </tr>
              </table>
            </div>
            
            ${record.deposit.notes ? `
              <div style="margin-top: 8px; font-size: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px;">
                <strong style="color: #0f172a; display: block; margin-bottom: 2px;">${language === 'ar' ? 'ملاحظات الشفت:' : 'Shift Notes:'}</strong>
                <p style="margin: 0; color: #475569; font-family: sans-serif; white-space: pre-wrap; line-height: 1.3;">${record.deposit.notes}</p>
              </div>
            ` : ''}
          </div>

          <!-- Notes, Verifications and Signatures -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
            <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 4px;">
              ${language === 'ar' ? 'التواقيع والاعتمادات الرسمية' : 'Official Signatures & Approvals'}
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px;">
              <div>
                <strong style="color: #475569;">${translations[language].cashierSignature}:</strong> 
                <span style="font-family: serif; font-style: italic; font-weight: bold; color: #1e293b; font-size: 13px; display: block; margin-top: 1px; padding-left: 4px;">
                  &ldquo;${record.deposit.cashierSignature}&rdquo;
                </span>
              </div>
            </div>
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

    printViaWindow(title, htmlContent, `
      @page {
        size: A4 portrait !important;
        margin: 10mm !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        width: 190mm !important; /* A4 Portrait width (210 - 2*10 margins) */
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-wrapper {
        width: 100% !important;
        max-width: 100% !important;
        overflow: hidden !important;
      }
    `);
  };

  // 1. Extract unique list of branches/cashiers in log for filtering
  const branches = ['All', ...Array.from(new Set(logs.map(l => l.shiftInfo.branch)))];
  const cashiers = ['All', ...Array.from(new Set(logs.map(l => l.shiftInfo.cashier)))];

  // 2. Sorting & Filtering logic
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredLogs = logs
    .filter(log => {
      if (log.isDeletedFromLog) return false;

      const matchSearch =
        log.shiftInfo.cashier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.shiftInfo.branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.deposit.notes && log.deposit.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchBranch = branchFilter === 'All' || log.shiftInfo.branch === branchFilter;
      const matchCashier = cashierFilter === 'All' || log.shiftInfo.cashier === cashierFilter;
      const matchStatus = statusFilter === 'All' || log.reconciliation.status === statusFilter;

      return matchSearch && matchBranch && matchCashier && matchStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.shiftInfo.businessDate).getTime() - new Date(b.shiftInfo.businessDate).getTime();
      } else if (sortField === 'reconciliation') {
        comparison = a.reconciliation.difference - b.reconciliation.difference;
      }

      return sortAsc ? comparison : -comparison;
    });

  const getStatusBadge = (status: 'Balanced' | 'Over' | 'Short') => {
    switch (status) {
      case 'Balanced':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {language === 'ar' ? 'متطابق' : 'Balanced'}
          </span>
        );
      case 'Over':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            {language === 'ar' ? 'زيادة' : 'Over'}
          </span>
        );
      case 'Short':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            {language === 'ar' ? 'عجز' : 'Short'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper Control Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl border border-slate-100 shadow-xs gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{translations[language].dailyClosingLogs}</h2>
          <p className="text-xs text-slate-500">{translations[language].historicalLogsDesc}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition cursor-pointer no-print"
          >
            <Download className="w-4 h-4" />
            {translations[language].exportAllCsv}
          </button>

          <button
            onClick={handlePrintLogsList}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 border border-blue-500 hover:bg-blue-700 rounded-lg transition cursor-pointer no-print shadow-xs"
          >
            <FileDown className="w-4 h-4" />
            {translations[language].printLogsList}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={translations[language].searchLogs}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-700"
            />
          </div>

          {/* Branch filter */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="w-full text-xs bg-transparent outline-hidden text-slate-700"
            >
              <option value="All">{translations[language].allBranches}</option>
              {branches.filter(b => b !== 'All').map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Cashier filter */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <select
              value={cashierFilter}
              onChange={e => setCashierFilter(e.target.value)}
              className="w-full text-xs bg-transparent outline-hidden text-slate-700"
            >
              <option value="All">{translations[language].allCashiers}</option>
              {cashiers.filter(c => c !== 'All').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-transparent outline-hidden text-slate-700"
            >
              <option value="All">{translations[language].allStatus}</option>
              <option value="Balanced">{translations[language].balanced}</option>
              <option value="Over">{translations[language].over}</option>
              <option value="Short">{translations[language].short}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th onClick={() => handleSort('date')} className="px-5 py-4 cursor-pointer hover:bg-slate-100/50">
                  <div className="flex items-center gap-1">
                    {translations[language].date} <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-5 py-4">{translations[language].branch}</th>
                <th className="px-5 py-4">{translations[language].cashierName}</th>
                <th className="px-5 py-4">{translations[language].shift}</th>
                <th className="px-5 py-4 text-right">{translations[language].cashSales}</th>
                <th className="px-5 py-4 text-right">{translations[language].totalCardNet}</th>
                <th className="px-5 py-4 text-right">{translations[language].totalDeliveryNet}</th>
                <th className="px-5 py-4 text-right">{translations[language].netRevenueSum}</th>
                <th className="px-5 py-4 text-right">{translations[language].cashExpenses}</th>
                <th className="px-5 py-4 text-right">{translations[language].expectedDrawerCash}</th>
                <th className="px-5 py-4 text-right">{translations[language].actualCashCounted}</th>
                <th onClick={() => handleSort('reconciliation')} className="px-5 py-4 text-right cursor-pointer hover:bg-slate-100/50">
                  <div className="flex items-center justify-end gap-1">
                    {translations[language].difference} <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-5 py-4 text-center">{translations[language].status}</th>
                <th className="px-5 py-4 text-center">{translations[language].actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-5 py-12 text-center text-slate-400 font-medium">
                    {translations[language].noLogsYet}
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const cardSales =
                    (log.payments.spanMada || 0) +
                    (log.payments.visa || 0) +
                    (log.payments.mastercard || 0) +
                    (log.payments.gccNetwork || 0);

                  const deliverySales =
                    (log.payments.keeta || 0) +
                    (log.payments.hungerstation || 0) +
                    (log.payments.jahez || 0) +
                    (log.payments.mrsool || 0);

                  const totalSales = (log.payments.cash || 0) + cardSales + deliverySales + (log.payments.otherPayments || 0);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-4 font-semibold text-slate-900 whitespace-nowrap">
                        {formatDate(log.shiftInfo.businessDate)}
                      </td>
                      <td className="px-5 py-4 font-medium max-w-[120px] truncate">{log.shiftInfo.branch}</td>
                      <td className="px-5 py-4 font-medium max-w-[120px] truncate">{log.shiftInfo.cashier}</td>
                      <td className="px-5 py-4">{log.shiftInfo.shift}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-800">{formatCurrency(log.payments.cash)}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-800">{formatCurrency(cardSales)}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-800">{formatCurrency(deliverySales)}</td>
                      <td className="px-5 py-4 text-right font-semibold font-mono text-blue-600">{formatCurrency(totalSales)}</td>
                      <td className="px-5 py-4 text-right font-mono text-red-600">{formatCurrency(log.drawerOperations.cashExpenses)}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-800">{formatCurrency(log.reconciliation.expectedCash)}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-800">{formatCurrency(log.reconciliation.actualCash)}</td>
                      <td className={`px-5 py-4 text-right font-bold font-mono whitespace-nowrap ${
                        log.reconciliation.difference === 0 
                          ? 'text-emerald-600' 
                          : log.reconciliation.difference > 0 
                          ? 'text-amber-600' 
                          : 'text-rose-600'
                      }`}>
                        {log.reconciliation.difference > 0 ? '+' : ''}
                        {formatCurrency(log.reconciliation.difference)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {getStatusBadge(log.reconciliation.status)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedRecord(log)}
                            className="p-1 hover:bg-slate-100 rounded-sm text-slate-500 hover:text-blue-600 transition"
                            title={language === 'ar' ? 'عرض التقرير الكامل' : 'View Full Report'}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetId(log.id)}
                            className="p-1 hover:bg-slate-100 rounded-sm text-slate-500 hover:text-red-600 transition"
                            title={language === 'ar' ? 'حذف السجل' : 'Delete Record'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Modal view of single Log record */}
      {selectedRecord && (() => {
        const cardSales =
          (selectedRecord.payments.spanMada || 0) +
          (selectedRecord.payments.visa || 0) +
          (selectedRecord.payments.mastercard || 0) +
          (selectedRecord.payments.gccNetwork || 0);

        const deliverySales =
          (selectedRecord.payments.keeta || 0) +
          (selectedRecord.payments.hungerstation || 0) +
          (selectedRecord.payments.jahez || 0) +
          (selectedRecord.payments.mrsool || 0);

        const totalSales = (selectedRecord.payments.cash || 0) + cardSales + deliverySales + (selectedRecord.payments.otherPayments || 0);
        
        const cashDiff = selectedRecord.reconciliation.difference;
        const cardDiff = selectedRecord.reconciliation.cardDifference ?? 0;
        const overallDiff = selectedRecord.reconciliation.overallDifference ?? cashDiff;

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative">
              
              {/* Header block with 8oz styling */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-slate-950 rounded-xl flex items-center justify-center text-white font-black text-xs tracking-wider">8oz</div>
                  <div>
                    <span className={`text-[10px] uppercase ${language === 'ar' ? 'tracking-normal' : 'tracking-widest'} font-extrabold text-blue-600 block`}>
                      {translations[language].reconciliationReceipt}
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight mt-0.5">
                      {language === 'ar' ? 'تقرير مطابقة وإغلاق الوردية 8oz' : '8oz Shift Closing & Reconciliation Report'}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                    ID: {selectedRecord.id}
                  </span>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 border border-slate-100 transition cursor-pointer"
                  >
                    <span className="text-xl leading-none block w-4 h-4 flex items-center justify-center">&times;</span>
                  </button>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-8">
                
                {/* Upper Bento Bar: 3 KPI Highlight Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* KPI 1: Net Revenue */}
                  <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-wider">{translations[language].netRevenueSum || (language === 'ar' ? 'صافي الإيرادات' : 'Net Revenue')}</span>
                        <TrendingUp className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
                        {formatCurrency(totalSales)}
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/50 flex justify-between text-[11px] text-slate-500 font-mono">
                      <span>Cash: {formatCurrency(selectedRecord.payments.cash)}</span>
                      <span>Card: {formatCurrency(cardSales)}</span>
                    </div>
                  </div>

                  {/* KPI 2: Cash Variance */}
                  <div className={`p-5 rounded-2xl border shadow-xs flex flex-col justify-between ${
                    cashDiff === 0 
                      ? 'bg-emerald-50/50 border-emerald-200/80' 
                      : cashDiff > 0 
                      ? 'bg-amber-50/50 border-amber-200/80' 
                      : 'bg-rose-50/50 border-rose-200/80'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="text-xs font-bold uppercase tracking-wider">{translations[language].cashDifference}</span>
                        <Wallet className={`w-4 h-4 ${cashDiff === 0 ? 'text-emerald-500' : cashDiff > 0 ? 'text-amber-500' : 'text-rose-500'}`} />
                      </div>
                      <p className={`text-2xl font-black font-mono tracking-tight mt-2 ${
                        cashDiff === 0 ? 'text-emerald-700' : cashDiff > 0 ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        {cashDiff > 0 ? '+' : ''}{formatCurrency(cashDiff)}
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/30 flex justify-between text-[11px] text-slate-500 font-mono">
                      <span>Exp: {formatCurrency(selectedRecord.reconciliation.expectedCash)}</span>
                      <span>Act: {formatCurrency(selectedRecord.reconciliation.actualCash)}</span>
                    </div>
                  </div>

                  {/* KPI 3: Card Variance */}
                  <div className={`p-5 rounded-2xl border shadow-xs flex flex-col justify-between ${
                    cardDiff === 0 
                      ? 'bg-emerald-50/50 border-emerald-200/80' 
                      : cardDiff > 0 
                      ? 'bg-amber-50/50 border-amber-200/80' 
                      : 'bg-rose-50/50 border-rose-200/80'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="text-xs font-bold uppercase tracking-wider">{translations[language].cardDifference}</span>
                        <CreditCard className={`w-4 h-4 ${cardDiff === 0 ? 'text-emerald-500' : cardDiff > 0 ? 'text-amber-500' : 'text-rose-500'}`} />
                      </div>
                      <p className={`text-2xl font-black font-mono tracking-tight mt-2 ${
                        cardDiff === 0 ? 'text-emerald-700' : cardDiff > 0 ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        {cardDiff > 0 ? '+' : ''}{formatCurrency(cardDiff)}
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/30 flex justify-between text-[11px] text-slate-500 font-mono">
                      <span>Exp: {formatCurrency(selectedRecord.reconciliation.expectedCard ?? 0)}</span>
                      <span>Act: {formatCurrency(selectedRecord.reconciliation.actualCard ?? 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Main Content Layout Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Section - width 7/12 */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* Shift & Custody metadata */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-50 pb-2.5">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <h4 className="text-xs uppercase font-extrabold text-slate-700 tracking-wider">
                          {translations[language].shiftInformation}
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                        <span className="text-slate-500">{translations[language].businessDate}</span>
                        <span className="font-semibold text-slate-800 text-right">{formatDate(selectedRecord.shiftInfo.businessDate)}</span>
                        
                        <span className="text-slate-500">{translations[language].branch}</span>
                        <span className="font-semibold text-slate-800 text-right">{selectedRecord.shiftInfo.branch}</span>
                        
                        <span className="text-slate-500">{translations[language].cashierName}</span>
                        <span className="font-semibold text-slate-800 text-right">{selectedRecord.shiftInfo.cashier}</span>
                        
                        <span className="text-slate-500">{translations[language].shift}</span>
                        <span className="font-semibold text-slate-800 text-right">
                          {selectedRecord.shiftInfo.shift === 'Morning' || selectedRecord.shiftInfo.shift === 'Morning Shift'
                            ? translations[language].morningShift 
                            : selectedRecord.shiftInfo.shift === 'Evening' || selectedRecord.shiftInfo.shift === 'Evening Shift'
                            ? translations[language].eveningShift
                            : selectedRecord.shiftInfo.shift}
                        </span>
                        
                        <span className="text-slate-500">{translations[language].registerNumber}</span>
                        <span className="font-semibold text-slate-800 text-right font-mono">{selectedRecord.shiftInfo.registerNumber}</span>
                      </div>
                    </div>

                    {/* Drawer Operations Calculation Flow */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-slate-700" />
                          <h4 className="text-xs uppercase font-extrabold text-slate-700 tracking-wider">
                            {translations[language].drawerOperations}
                          </h4>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono tracking-widest">
                          {language === 'ar' ? 'تدفق عمليات الكاش' : 'Cash flow math'}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between py-1.5 border-b border-slate-100/50">
                          <span className="text-slate-500">{translations[language].openingFloat}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.openingFloat || 0)}</span>
                        </div>

                        <div className="flex justify-between py-1.5 border-b border-slate-100/50">
                          <span className="text-slate-500">{translations[language].payInTotal}</span>
                          <span className="font-semibold text-emerald-600">+{formatCurrency(selectedRecord.drawerOperations?.payIn || 0)}</span>
                        </div>

                        <div className="flex justify-between py-1.5 border-b border-slate-100/50">
                          <span className="text-slate-500">{translations[language].payOut}</span>
                          <span className="font-semibold text-rose-600">-{formatCurrency(selectedRecord.drawerOperations?.payOut || 0)}</span>
                        </div>

                        <div className="flex justify-between py-1.5 border-b border-slate-100/50">
                          <span className="text-slate-500">{translations[language].cashDrops}</span>
                          <span className="font-semibold text-rose-600">-{formatCurrency(selectedRecord.drawerOperations?.cashDrops || 0)}</span>
                        </div>

                        <div className="flex justify-between py-1.5 border-b border-slate-100/50">
                          <span className="text-slate-500">{translations[language].returnOps}</span>
                          <span className="font-semibold text-rose-600">-{formatCurrency(selectedRecord.drawerOperations?.returnOperations || 0)}</span>
                        </div>

                        <div className="flex justify-between py-1.5 border-b border-slate-100/50">
                          <span className="text-slate-500">{translations[language].replacementReturn}</span>
                          <span className="font-semibold text-slate-500">{formatCurrency(selectedRecord.drawerOperations?.replacementReturn || 0)}</span>
                        </div>

                        <div className="flex justify-between py-1.5 border-b border-slate-100/50">
                          <span className="text-slate-500">{translations[language].cashExpenses}</span>
                          <span className="font-semibold text-rose-600">-{formatCurrency(selectedRecord.drawerOperations?.cashExpenses || 0)}</span>
                        </div>

                        <div className="flex justify-between pt-3 pb-1 border-t border-slate-200">
                          <span className="font-bold text-slate-900">{translations[language].expectedDrawerCash}</span>
                          <span className="font-black text-sm text-slate-950">{formatCurrency(selectedRecord.reconciliation?.expectedCash || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Sales & Payment channels breakdown */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-50 pb-2.5">
                        <Receipt className="w-4 h-4 text-slate-500" />
                        <h4 className="text-xs uppercase font-extrabold text-slate-700 tracking-wider">
                          {translations[language].paymentBreakdown}
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono">
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].cashSales}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.payments.cash)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].spanMada}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.payments.spanMada)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].visa}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.payments.visa)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].mastercard}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.payments.mastercard)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].gccNetwork}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.payments.gccNetwork)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].keeta}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.payments.keeta)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].hungerstation}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.payments.hungerstation)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].jahez}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.payments.jahez)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].mrsool}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.payments.mrsool)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].otherPayments}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.payments.otherPayments)}</span>
                        </div>
                        <div className="col-span-2 flex justify-between pt-2.5 text-red-600 border-t border-slate-100 mt-2">
                          <span className="font-bold">{translations[language].totalReturns}</span>
                          <span className="font-extrabold">{formatCurrency(selectedRecord.payments.totalReturns)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Section - width 5/12 */}
                  <div className="lg:col-span-5 space-y-6">
                    
                    {/* Denominations block */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-50 pb-2.5">
                        <Coins className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs uppercase font-extrabold text-slate-700 tracking-wider">
                          {translations[language].physicalCashCount}
                        </h4>
                      </div>

                      <div className="space-y-1.5 text-xs font-mono text-slate-700">
                        <div className="grid grid-cols-3 font-semibold pb-1.5 border-b border-slate-100/50 text-[10px] text-slate-400 uppercase tracking-wider">
                          <span>{translations[language].denomination}</span>
                          <span className="text-center">{translations[language].qty}</span>
                          <span className="text-right">{translations[language].total}</span>
                        </div>
                        {[
                          { val: 500, count: selectedRecord.cashCount.sar500 },
                          { val: 200, count: selectedRecord.cashCount.sar200 },
                          { val: 100, count: selectedRecord.cashCount.sar100 },
                          { val: 50, count: selectedRecord.cashCount.sar50 },
                          { val: 20, count: selectedRecord.cashCount.sar20 },
                          { val: 10, count: selectedRecord.cashCount.sar10 },
                          { val: 5, count: selectedRecord.cashCount.sar5 },
                          { val: 1, count: selectedRecord.cashCount.sar1 },
                          { val: 0.5, label: '0.50', count: selectedRecord.cashCount.sar0_50 },
                          { val: 0.25, label: '0.25', count: selectedRecord.cashCount.sar0_25 || 0 },
                        ].map((item, idx) => (
                          <div key={idx} className="grid grid-cols-3 py-1 border-b border-slate-50/40 hover:bg-slate-50/20">
                            <span className="text-slate-500">{item.label || item.val} {translations[language].sar}</span>
                            <span className="text-center text-slate-800 font-medium">{item.count}</span>
                            <span className="text-right text-slate-900 font-semibold">{formatCurrency(item.count * item.val)}</span>
                          </div>
                        ))}
                        <div className="grid grid-cols-3 pt-3 border-t border-slate-200">
                          <span className="font-bold text-slate-950">{translations[language].totalActual || (language === 'ar' ? 'الإجمالي الفعلي' : 'Total Actual')}</span>
                          <span></span>
                          <span className="font-black text-right text-blue-600 text-sm">{formatCurrency(selectedRecord.reconciliation.actualCash)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Reconciliation Overall status card */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-50 pb-2.5">
                        <Info className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-xs uppercase font-extrabold text-slate-700 tracking-wider">
                          {translations[language].custodyStatus}
                        </h4>
                      </div>

                      <div className="space-y-3 text-xs">
                        {/* Cash */}
                        <div className="flex justify-between font-mono pb-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].expectedDrawerCash}</span>
                          <span className="font-bold text-slate-800">{formatCurrency(selectedRecord.reconciliation.expectedCash)}</span>
                        </div>
                        <div className="flex justify-between font-mono pb-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].actualCashCounted}</span>
                          <span className="font-bold text-blue-600">{formatCurrency(selectedRecord.reconciliation.actualCash)}</span>
                        </div>
                        <div className="flex justify-between font-mono pb-2">
                          <span className="font-semibold text-slate-600">{translations[language].cashDifference}</span>
                          <span className={`font-black ${selectedRecord.reconciliation.difference === 0 ? 'text-emerald-600' : selectedRecord.reconciliation.difference > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {selectedRecord.reconciliation.difference > 0 ? '+' : ''}
                            {formatCurrency(selectedRecord.reconciliation.difference)}
                          </span>
                        </div>

                        {/* Card */}
                        <div className="flex justify-between font-mono pt-2 border-t border-slate-100 pb-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].expectedCard}</span>
                          <span className="font-bold text-slate-800">{formatCurrency(selectedRecord.reconciliation.expectedCard ?? 0)}</span>
                        </div>
                        <div className="flex justify-between font-mono pb-1 border-b border-slate-50">
                          <span className="text-slate-500">{translations[language].actualCard}</span>
                          <span className="font-bold text-blue-600">{formatCurrency(selectedRecord.reconciliation.actualCard ?? 0)}</span>
                        </div>

                        {selectedRecord.cardBreakdown && (
                          <div className="px-3 py-2 bg-slate-50/50 rounded-xl space-y-1.5 text-[11px] font-mono border border-slate-100">
                            <div className="flex justify-between text-slate-500">
                              <span>{translations[language].actualCardMada}:</span>
                              <span className="font-medium text-slate-700">{formatCurrency(selectedRecord.cardBreakdown.mada ?? 0)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>{translations[language].actualCardVisa}:</span>
                              <span className="font-medium text-slate-700">{formatCurrency(selectedRecord.cardBreakdown.visa ?? 0)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>{translations[language].actualCardMastercard}:</span>
                              <span className="font-medium text-slate-700">{formatCurrency(selectedRecord.cardBreakdown.mastercard ?? 0)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>{translations[language].actualCardAmex}:</span>
                              <span className="font-medium text-slate-700">{formatCurrency(selectedRecord.cardBreakdown.amex ?? 0)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>{translations[language].actualCardGcc}:</span>
                              <span className="font-medium text-slate-700">{formatCurrency(selectedRecord.cardBreakdown.gccNet ?? 0)}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between font-mono pb-2">
                          <span className="font-semibold text-slate-600">{translations[language].cardDifference}</span>
                          <span className={`font-black ${(selectedRecord.reconciliation.cardDifference ?? 0) === 0 ? 'text-emerald-600' : (selectedRecord.reconciliation.cardDifference ?? 0) > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {(selectedRecord.reconciliation.cardDifference ?? 0) > 0 ? '+' : ''}
                            {formatCurrency(selectedRecord.reconciliation.cardDifference ?? 0)}
                          </span>
                        </div>

                        {/* Overall Variance Row */}
                        <div className="flex justify-between items-center font-mono pt-3 border-t border-slate-200">
                          <span className="font-bold text-slate-900">{translations[language].custodyDifference}</span>
                          <span className={`font-black text-sm ${overallDiff === 0 ? 'text-emerald-600' : overallDiff > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {overallDiff > 0 ? '+' : ''}
                            {formatCurrency(overallDiff)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                          <span className="text-slate-600 font-semibold">{translations[language].status}</span>
                          <span>{getStatusBadge(selectedRecord.reconciliation.status)}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Bottom Segment: Deposit summary & Signatures */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                  
                  {/* Deposit Card */}
                  <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                    <h4 className="text-xs uppercase font-extrabold text-slate-600 tracking-wider">
                      {translations[language].depositAndRetention}
                    </h4>
                    <div className="grid grid-cols-2 text-xs font-mono gap-y-1.5">
                      <span className="text-slate-500">{translations[language].amountToDeposit}</span>
                      <span className="font-extrabold text-emerald-700 text-right">{formatCurrency(selectedRecord.deposit.amountToDeposit)}</span>
                      
                      <span className="text-slate-500">{translations[language].remainingFloat}</span>
                      <span className="font-extrabold text-slate-700 text-right">{formatCurrency(selectedRecord.deposit.remainingFloat)}</span>
                    </div>

                    {selectedRecord.deposit.notes && (
                      <div className="mt-3 text-xs bg-white border border-slate-150 rounded-xl p-3 text-slate-600 shadow-2xs">
                        <span className="font-bold text-slate-800 block mb-1">
                          {language === 'ar' ? 'ملاحظات الشفت:' : 'Shift Notes:'}
                        </span>
                        <p className="leading-relaxed whitespace-pre-wrap">{selectedRecord.deposit.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Signatures & Verifications */}
                  <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs uppercase font-extrabold text-slate-600 tracking-wider mb-3">
                        {language === 'ar' ? 'التواقيع والاعتماد' : 'Signatures & Signoff'}
                      </h4>
                      <div className="grid grid-cols-1 gap-y-4 text-xs font-mono">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">{translations[language].cashierSignature}</span>
                          <span className="font-serif italic font-extrabold text-slate-900 text-base mt-1 block">
                            &ldquo;{selectedRecord.deposit.cashierSignature}&rdquo;
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3 mt-4 text-center">
                      {language === 'ar' 
                        ? 'تم الإصدار والاعتماد إلكترونياً بواسطة نظام تسوية مبيعات 8oz' 
                        : 'Electronically generated and verified via 8oz Cash Closing System'}
                    </p>
                  </div>

                </div>

                {/* Footer action buttons */}
                <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
                  <button
                    onClick={() => handlePrintSingleRecord(selectedRecord)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 border border-blue-500 hover:bg-blue-700 rounded-xl transition cursor-pointer shadow-xs"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    {translations[language].printReport}
                  </button>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="px-5 py-2.5 text-xs font-black text-white bg-slate-950 hover:bg-slate-900 rounded-xl transition cursor-pointer shadow-xs"
                  >
                    {language === 'ar' ? 'إغلاق التقرير' : 'Close Report'}
                  </button>
                </div>

              </div>

            </div>
          </div>
        );
      })()}

      {/* Gorgeous Custody Deletion/Hide Choice Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-in fade-in duration-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="p-1.5 bg-red-50 text-red-600 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </span>
              {translations[language].deleteChoiceTitle}
            </h3>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              {translations[language].deleteChoiceDesc}
            </p>

            <div className="flex flex-col gap-2 pt-2">
              {/* Soft Delete Option */}
              <button
                onClick={() => {
                  onDeleteLog(deleteTargetId, false);
                  setDeleteTargetId(null);
                }}
                className={`w-full text-${language === 'ar' ? 'right' : 'left'} justify-between py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 transition`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  {translations[language].hideFromListOnly}
                </span>
                <span className="text-[10px] opacity-75 font-normal">{language === 'ar' ? 'آمن ماليًا' : 'Financially Safe'}</span>
              </button>

              {/* Permanent Delete Option */}
              <button
                onClick={() => {
                  onDeleteLog(deleteTargetId, true);
                  setDeleteTargetId(null);
                }}
                className={`w-full text-${language === 'ar' ? 'right' : 'left'} justify-between py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2 transition`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                  {translations[language].deletePermanently}
                </span>
                <span className="text-[10px] opacity-75 font-normal">{language === 'ar' ? 'حذف كلي' : 'Hard Delete'}</span>
              </button>
            </div>

            {/* Cancel Button */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition"
              >
                {translations[language].cancel}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
