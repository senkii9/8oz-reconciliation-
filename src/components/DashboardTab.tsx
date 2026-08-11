/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DailyClosingRecord } from '../types';
import { formatCurrency } from '../utils/calculations';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { DollarSign, Percent, AlertCircle, TrendingUp, Calendar, ShoppingCart, Award, CheckCircle, Printer, LayoutDashboard } from 'lucide-react';
import { translations, Language } from '../lib/translations';

interface DashboardTabProps {
  logs: DailyClosingRecord[];
  language: Language;
}

const COLORS = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function DashboardTab({ logs, language }: DashboardTabProps) {
  // If logs are empty, use empty or basic stats
  const hasData = logs.length > 0;

  // Calculate dynamic stats
  let todaySales = 0;
  let monthlySales = 0;
  let cashSalesAllTime = 0;
  let cardSalesAllTime = 0;
  let deliverySalesAllTime = 0;
  let cashExpensesAllTime = 0;
  let totalShortages = 0;
  let totalOverages = 0;
  let numShortages = 0;
  let numBalanced = 0;
  let avgDailySales = 0;
  let highestSalesDay = 0;
  let totalSalesAllTime = 0;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split('T')[0];

  logs.forEach(log => {
    const logDate = new Date(log.shiftInfo.businessDate);
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

    // Today's Sales
    if (log.shiftInfo.businessDate === todayStr) {
      todaySales += totalSales;
    }

    // Monthly Sales
    if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
      monthlySales += totalSales;
    }

    // Totals
    cashSalesAllTime += log.payments.cash || 0;
    cardSalesAllTime += cardSales;
    deliverySalesAllTime += deliverySales;
    cashExpensesAllTime += log.drawerOperations.cashExpenses || 0;
    totalSalesAllTime += totalSales;

    // Reconciliation status
    const diff = log.reconciliation.difference;
    if (diff < -0.01) {
      totalShortages += Math.abs(diff);
      numShortages++;
    } else if (diff > 0.01) {
      totalOverages += diff;
    } else {
      numBalanced++;
    }

    // Highest day
    if (totalSales > highestSalesDay) {
      highestSalesDay = totalSales;
    }
  });

  avgDailySales = logs.length > 0 ? totalSalesAllTime / logs.length : 0;

  // Percentage Calculations
  const cashPct = totalSalesAllTime > 0 ? (cashSalesAllTime / totalSalesAllTime) * 100 : 0;
  const cardPct = totalSalesAllTime > 0 ? (cardSalesAllTime / totalSalesAllTime) * 100 : 0;
  const deliveryPct = totalSalesAllTime > 0 ? (deliverySalesAllTime / totalSalesAllTime) * 100 : 0;

  // Setup data for Charts
  // 1. Sales by payment method
  const paymentMethodData = hasData ? [
    { name: 'Cash', value: cashSalesAllTime },
    { name: 'Card', value: cardSalesAllTime },
    { name: 'Delivery', value: deliverySalesAllTime },
  ] : [
    { name: 'Cash', value: 12000 },
    { name: 'Card', value: 18000 },
    { name: 'Delivery', value: 8500 },
  ];

  // 2. Daily Sales trend (last 10 records)
  const dailyTrendData = hasData 
    ? [...logs].reverse().slice(-10).map(log => {
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

        return {
          date: log.shiftInfo.businessDate.substring(5), // MM-DD
          Sales: totalSales,
          Cash: log.payments.cash,
          Card: cardSales,
          Delivery: deliverySales,
          Expenses: log.drawerOperations.cashExpenses,
        };
      })
    : [
        { date: '07-01', Sales: 2500, Cash: 800, Card: 1200, Delivery: 500, Expenses: 50 },
        { date: '07-02', Sales: 3100, Cash: 1100, Card: 1500, Delivery: 500, Expenses: 120 },
        { date: '07-03', Sales: 2900, Cash: 900, Card: 1300, Delivery: 700, Expenses: 80 },
        { date: '07-04', Sales: 3500, Cash: 1200, Card: 1600, Delivery: 700, Expenses: 0 },
        { date: '07-05', Sales: 4200, Cash: 1500, Card: 2000, Delivery: 700, Expenses: 150 },
        { date: '07-06', Sales: 3800, Cash: 1200, Card: 1800, Delivery: 800, Expenses: 60 },
        { date: '07-07', Sales: 3900, Cash: 1300, Card: 1900, Delivery: 700, Expenses: 40 },
      ];

  // 3. Detailed payment methods (Breakdown)
  const breakdownData = hasData ? [
    { name: 'Cash', Sales: cashSalesAllTime },
    { name: 'Mada', Sales: logs.reduce((acc, curr) => acc + (curr.payments.spanMada || 0), 0) },
    { name: 'Visa/MC', Sales: logs.reduce((acc, curr) => acc + (curr.payments.visa || 0) + (curr.payments.mastercard || 0), 0) },
    { name: 'GCC Net', Sales: logs.reduce((acc, curr) => acc + (curr.payments.gccNetwork || 0), 0) },
    { name: 'Keeta', Sales: logs.reduce((acc, curr) => acc + (curr.payments.keeta || 0), 0) },
    { name: 'HungerStn', Sales: logs.reduce((acc, curr) => acc + (curr.payments.hungerstation || 0), 0) },
    { name: 'Jahez', Sales: logs.reduce((acc, curr) => acc + (curr.payments.jahez || 0), 0) },
    { name: 'Mrsool', Sales: logs.reduce((acc, curr) => acc + (curr.payments.mrsool || 0), 0) },
  ] : [
    { name: 'Cash', Sales: 12000 },
    { name: 'Mada', Sales: 11000 },
    { name: 'Visa/MC', Sales: 5000 },
    { name: 'GCC Net', Sales: 2000 },
    { name: 'Keeta', Sales: 1500 },
    { name: 'HungerStn', Sales: 3500 },
    { name: 'Jahez', Sales: 2500 },
    { name: 'Mrsool', Sales: 1000 },
  ];

  const handlePrintDashboard = () => {
    const title = language === 'ar' ? 'تقرير لوحة تحليلات الأداء والإيرادات' : 'Performance & Revenue Analytics Report';
    
    const htmlContent = `
      <div style="direction: ${language === 'ar' ? 'rtl' : 'ltr'}; font-family: 'Inter', system-ui, sans-serif; color: #1e293b; max-width: 900px; margin: 0 auto; padding: 10px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 15px;">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #2563eb; letter-spacing: 0.12em;">
            ${language === 'ar' ? 'تحليلات الأداء المالي والتشغيلي' : 'Financial & Operational Analytics'}
          </span>
          <h1 style="font-size: 24px; font-weight: 900; margin: 5px 0 2px 0; color: #0f172a;">
            ${title}
          </h1>
          <p style="font-size: 12px; color: #64748b; margin: 0;">${language === 'ar' ? 'تاريخ الطباعة:' : 'Printed on:'} ${new Date().toLocaleString()}</p>
        </div>

        <!-- KPIs Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">
              ${language === 'ar' ? 'مبيعات اليوم' : "Today's Sales"}
            </div>
            <div style="font-size: 18px; font-weight: 900; color: #0f172a; font-family: monospace;">
              ${formatCurrency(hasData ? todaySales : 3850)}
            </div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">
              ${translations[language].monthlySales}
            </div>
            <div style="font-size: 18px; font-weight: 900; color: #0f172a; font-family: monospace;">
              ${formatCurrency(hasData ? monthlySales : 48500)}
            </div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">
              ${translations[language].avgDailySales}
            </div>
            <div style="font-size: 18px; font-weight: 900; color: #0f172a; font-family: monospace;">
              ${formatCurrency(hasData ? avgDailySales : 3464)}
            </div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">
              ${translations[language].highestSalesDay}
            </div>
            <div style="font-size: 18px; font-weight: 900; color: #0f172a; font-family: monospace;">
              ${formatCurrency(hasData ? highestSalesDay : 4200)}
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px;">
          <!-- Payment Channels -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px;">
            <h3 style="font-size: 13px; text-transform: uppercase; font-weight: 800; color: #475569; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
              ${translations[language].salesShare}
            </h3>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #475569;">${translations[language].cashSales}</td>
                <td style="padding: 10px 0; font-weight: bold; font-family: monospace; text-align: ${language === 'ar' ? 'left' : 'right'}; font-size: 13px;">
                  ${formatCurrency(hasData ? cashSalesAllTime : 12000)} (${(hasData ? cashPct : 31.2).toFixed(1)}%)
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #475569;">${translations[language].totalCardNet}</td>
                <td style="padding: 10px 0; font-weight: bold; font-family: monospace; text-align: ${language === 'ar' ? 'left' : 'right'}; font-size: 13px;">
                  ${formatCurrency(hasData ? cardSalesAllTime : 18000)} (${(hasData ? cardPct : 46.8).toFixed(1)}%)
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #475569;">${translations[language].totalDeliveryNet}</td>
                <td style="padding: 10px 0; font-weight: bold; font-family: monospace; text-align: ${language === 'ar' ? 'left' : 'right'}; font-size: 13px;">
                  ${formatCurrency(hasData ? deliverySalesAllTime : 8500)} (${(hasData ? deliveryPct : 22.0).toFixed(1)}%)
                </td>
              </tr>
            </table>
          </div>

          <!-- Reconciliation Summary -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px;">
            <h3 style="font-size: 13px; text-transform: uppercase; font-weight: 800; color: #475569; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
              ${language === 'ar' ? 'تسوية الفروقات ومقاييس الأمان والرقابة' : 'Discrepancy & Security Audits'}
            </h3>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #475569;">${translations[language].short}</td>
                <td style="padding: 10px 0; font-weight: bold; font-family: monospace; color: #dc2626; text-align: ${language === 'ar' ? 'left' : 'right'}; font-size: 13px;">
                  ${formatCurrency(hasData ? totalShortages : 45.50)}
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #475569;">${translations[language].over}</td>
                <td style="padding: 10px 0; font-weight: bold; font-family: monospace; color: #d97706; text-align: ${language === 'ar' ? 'left' : 'right'}; font-size: 13px;">
                  ${formatCurrency(hasData ? totalOverages : 12.00)}
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #475569;">${language === 'ar' ? 'مجموع المصاريف المدفوعة نقدياً' : 'Total Cash Expenses'}</td>
                <td style="padding: 10px 0; font-weight: bold; font-family: monospace; text-align: ${language === 'ar' ? 'left' : 'right'}; font-size: 13px;">
                  ${formatCurrency(hasData ? cashExpensesAllTime : 650.00)}
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Detailed breakdown tables -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 30px;">
          <h3 style="font-size: 13px; text-transform: uppercase; font-weight: 800; color: #475569; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            ${translations[language].paymentBreakdownChart}
          </h3>
          <table style="width: 100%; font-size: 12px; border-collapse: collapse; text-align: ${language === 'ar' ? 'right' : 'left'};">
            <thead>
              <tr style="border-bottom: 2px solid #cbd5e1; color: #475569; font-weight: bold;">
                <th style="padding: 8px 4px;">${language === 'ar' ? 'قناة الدفع' : 'Payment Channel'}</th>
                <th style="padding: 8px 4px; text-align: right;">${language === 'ar' ? 'إجمالي المبيعات المحققة' : 'Total Sales Realized'}</th>
              </tr>
            </thead>
            <tbody>
              ${breakdownData.map(b => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 4px; font-weight: bold; color: #334155;">${b.name}</td>
                  <td style="padding: 8px 4px; text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${formatCurrency(b.Sales)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px;">
          ${language === 'ar' ? 'تم الإصدار والاعتماد إلكترونياً بواسطة نظام تسوية مبيعات 8oz' : 'Electronically generated and verified via 8oz Cash Closing System'}
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
                font-family: 'Thmanyah Display Bold';
                src: url('https://db.onlinewebfonts.com/t/788c0a85fa0a7d762e6d5e16ec3cb65e.woff2') format('woff2'),
                     local('Thmanyah Display Bold'), local('ThmanyahDisplay-Bold'), local('Cairo-Bold'), local('Cairo');
                font-weight: bold;
              }

              @font-face {
                font-family: 'Expo Sans';
                src: url('https://db.onlinewebfonts.com/t/790beea44eb98b049d501db67ee784f1.woff2') format('woff2'),
                     local('Expo Sans'), local('ExpoSans'), local('Expo-Sans'), local('Inter');
              }

              body {
                font-family: ${language === 'ar' ? "'Thmanyah Display Bold', 'Cairo', sans-serif" : "'Expo Sans', 'Inter', sans-serif"};
                margin: 0;
                padding: 15px;
                background: #fff;
                color: #1e293b;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 4mm 6mm 4mm 6mm;
                }
                html, body {
                  height: 99%;
                  overflow: hidden;
                }
                body {
                  padding: 0 !important;
                  zoom: 82%; /* Ensures dashboard report fits on exactly 1 page */
                }
                .no-print {
                  display: none !important;
                }
                /* Shrink margins and paddings for print */
                div[style*="margin-bottom: 30px"] {
                  margin-bottom: 10px !important;
                  gap: 12px !important;
                }
                div[style*="padding: 20px"] {
                  padding: 10px 15px !important;
                  border-radius: 8px !important;
                }
                div[style*="padding: 15px"] {
                  padding: 8px 10px !important;
                  border-radius: 8px !important;
                }
                table {
                  font-size: 11px !important;
                }
                th, td {
                  padding: 4px 2px !important;
                }
                h3 {
                  margin-bottom: 8px !important;
                  padding-bottom: 3px !important;
                  font-size: 11px !important;
                }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
            <script>
              window.addEventListener('load', () => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                  window.onafterprint = () => window.close();
                }, 400);
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
    <div className="space-y-6">
      {/* Dashboard Top Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            {language === 'ar' ? 'لوحة تحليلات الأداء والإيرادات' : 'Performance & Revenue Analytics'}
          </h2>
          <p className="text-xs text-slate-500">
            {language === 'ar' ? 'مراقبة مبيعات الكاش، البطاقات والطلبات مع مقارنة الفروقات والتسويات' : 'Monitor cash, card, and delivery platform sales alongside compliance tracking'}
          </p>
        </div>

        <div>
          <button
            onClick={handlePrintDashboard}
            disabled={!hasData}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg shadow-3xs cursor-pointer transition no-print disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            {language === 'ar' ? 'طباعة تقرير لوحة التحكم (PDF)' : 'Print Dashboard Report (PDF)'}
          </button>
        </div>
      </div>
      
      {!hasData ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-3xs flex flex-col items-center justify-center max-w-2xl mx-auto space-y-5 animate-fade-in my-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-xs">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-base font-bold text-slate-900">
              {language === 'ar' ? 'لوحة التحليلات فارغة وجاهزة لأول إدخال' : 'Analytics Dashboard Ready for Data'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              {language === 'ar' 
                ? 'مرحباً بك! لم يتم العثور على أي سجلات تطابق تسويات الصندوق حتى الآن. ابدأ بإضافة وتوثيق أول عملية إقفال وردية في قسم "إقفال الوردية اليومي"، وسيتم على الفور هنا عرض الرسوم البيانية، ومؤشرات الأداء، والمقارنات بدقة متكاملة.'
                : 'Welcome! There are no daily closing records found in the system yet. Once you complete your first shift closing in the "Daily Closing" tab, this workspace will instantly populate with interactive charts, financial ratios, and operational insights.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">{language === 'ar' ? 'مبيعات اليوم' : "Today's Sales"}</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-lg md:text-xl font-extrabold text-slate-900 font-mono">
                  {formatCurrency(todaySales)}
                </h3>
                <span className="text-[10px] text-emerald-600 font-bold mt-1 block">{translations[language].activeBusinessDay}</span>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">{translations[language].monthlySales}</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-lg md:text-xl font-extrabold text-slate-900 font-mono">
                  {formatCurrency(monthlySales)}
                </h3>
                <span className="text-[10px] text-slate-500 mt-1 block">Jul 2026 Calendar Month</span>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">{translations[language].avgDailySales}</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-lg md:text-xl font-extrabold text-slate-900 font-mono">
                  {formatCurrency(avgDailySales)}
                </h3>
                <span className="text-[10px] text-slate-500 mt-1 block">{translations[language].basedOnLogged}</span>
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">{translations[language].highestSalesDay}</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-lg md:text-xl font-extrabold text-slate-900 font-mono">
                  {formatCurrency(highestSalesDay)}
                </h3>
                <span className="text-[10px] text-slate-500 mt-1 block">{translations[language].allTimeRecord}</span>
              </div>
            </div>
          </div>

          {/* Ratios & Reconciliations Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Channels Percentages */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4">{translations[language].salesShare}</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-50">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">{translations[language].cashSales} %</span>
                  <span className="text-lg font-black text-blue-700 font-mono">
                    {cashPct.toFixed(1)}%
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono block mt-1">
                    {formatCurrency(cashSalesAllTime)}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-50">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">{translations[language].totalCardNet} %</span>
                  <span className="text-lg font-black text-emerald-700 font-mono">
                    {cardPct.toFixed(1)}%
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono block mt-1">
                    {formatCurrency(cardSalesAllTime)}
                  </span>
                </div>

                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-50">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">{translations[language].totalDeliveryNet} %</span>
                  <span className="text-lg font-black text-indigo-700 font-mono">
                    {deliveryPct.toFixed(1)}%
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono block mt-1">
                    {formatCurrency(deliverySalesAllTime)}
                  </span>
                </div>
              </div>
            </div>

            {/* Shortages & Closings Metrics */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4">{language === 'ar' ? 'مقاييس تسوية الصندوق' : 'Reconciliation Metrics'}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl">
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">{translations[language].short}</span>
                  <span className="text-sm font-black text-rose-600 font-mono">{formatCurrency(totalShortages)}</span>
                </div>

                <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-xl">
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">{translations[language].over}</span>
                  <span className="text-sm font-black text-amber-600 font-mono">{formatCurrency(totalOverages)}</span>
                </div>

                <div className="p-2.5 bg-red-100/30 border border-red-100 rounded-xl">
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">{language === 'ar' ? 'ورديات عجز' : 'Short Shifts'}</span>
                  <span className="text-sm font-black text-red-700 font-mono">{numShortages}</span>
                </div>

                <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">{translations[language].balanced}</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">{numBalanced}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Daily Revenue Trends */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                {translations[language].salesTrend} ({translations[language].sar})
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrendData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => [`SAR ${Number(value).toFixed(2)}`, '']} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" name={language === 'ar' ? 'إجمالي المبيعات' : "Total Sales"} />
                    <Area type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={1} fillOpacity={0} name={translations[language].cashExpenses} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Sales by Channel */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs flex flex-col justify-between">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                {translations[language].salesShare}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-48 flex justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {paymentMethodData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `SAR ${Number(value).toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="space-y-2">
                  {paymentMethodData.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        <span className="text-xs font-semibold text-slate-700">
                          {item.name === 'Cash' ? translations[language].cashSales : item.name === 'Card' ? translations[language].totalCardNet : translations[language].totalDeliveryNet}
                        </span>
                      </div>
                      <span className="text-xs font-bold font-mono text-slate-800">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart 3: Detailed Foodics POS Payment Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs col-span-1 lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                {translations[language].paymentBreakdownChart}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdownData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => `SAR ${Number(value).toFixed(2)}`} />
                    <Bar dataKey="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      {breakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
