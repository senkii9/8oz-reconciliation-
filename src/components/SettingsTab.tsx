/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppSettings, AccessRequest, EmployeeStatus, AuditLogEntry } from '../types';
import { 
  Plus, 
  Trash, 
  Database, 
  Save, 
  Sparkles, 
  RefreshCw, 
  Check, 
  CheckCircle, 
  AlertTriangle, 
  CreditCard, 
  Users, 
  MapPin, 
  ShieldCheck, 
  Truck, 
  DollarSign,
  Info,
  Clock,
  UserCheck,
  Pause,
  Play,
  X,
  ShieldQuestion
} from 'lucide-react';
import { translations, Language } from '../lib/translations';

interface SettingsTabProps {
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onLoadMockData: () => void;
  onClearAllData: () => void;
  language: Language;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  accessRequests?: AccessRequest[];
  onApproveAccessRequest?: (req: AccessRequest, role: 'owner' | 'supervisor' | 'cashier') => void;
  onDismissAccessRequest?: (req: AccessRequest) => void;
  currentUserEmail?: string;
  auditLog?: AuditLogEntry[];
}

export default function SettingsTab({
  settings,
  onSaveSettings,
  onLoadMockData,
  onClearAllData,
  language,
  showToast,
  accessRequests = [],
  onApproveAccessRequest,
  onDismissAccessRequest,
  currentUserEmail = '',
  auditLog = [],
}: SettingsTabProps) {
  const [requestRoles, setRequestRoles] = useState<Record<string, 'owner' | 'supervisor' | 'cashier'>>({});
  
  const [inputs, setInputs] = useState({
    branch: '',
    cashier: '',
    supervisor: '',
    payment: '',
    delivery: '',
    shift: '',
    employeeEmail: '',
    employeeName: '',
    employeeRole: 'cashier',
  });
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
    type: 'info'
  });

  // Show a beautiful in-app toast message (replaces window.alert)
  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (showToast) {
      showToast(message, type);
    } else {
      // Fallback
      console.log(`[Toast ${type}]: ${message}`);
    }
  };

  
  const addItem = (key: keyof AppSettings, inputKey: keyof typeof inputs, friendlySectionName: string) => {
    const val = inputs[inputKey].trim();
    if (!val) return;

    const rawList = settings[key];
    const list = (Array.isArray(rawList) ? rawList : []) as string[];
    if (list.includes(val)) {
      triggerToast(translations[language].itemExists, 'error');
      return;
    }

    const updatedSettings = {
      ...settings,
      [key]: [...list, val],
    };
    
    // Auto-save to parent state and localStorage instantly
    onSaveSettings(updatedSettings);
    
    // Clear the input
    setInputs(prev => ({ ...prev, [inputKey]: '' }));

    // Show smooth, elegant visual confirmation
    triggerToast(
      language === 'ar' 
        ? `تم إضافة "${val}" إلى ${friendlySectionName} وحفظ التعديل تلقائياً!` 
        : `Added "${val}" to ${friendlySectionName} and saved automatically!`, 
      'success'
    );
  };

  const removeItem = (key: keyof AppSettings, item: string, friendlySectionName: string) => {
    const list = (settings[key] || []) as string[];
    const updatedSettings = {
      ...settings,
      [key]: list.filter(i => i !== item),
    };
    
    // Auto-save to parent state and localStorage instantly
    onSaveSettings(updatedSettings);

    // Show smooth, elegant visual confirmation
    triggerToast(
      language === 'ar' 
        ? `تم حذف "${item}" من ${friendlySectionName} بنجاح!` 
        : `Deleted "${item}" from ${friendlySectionName} successfully!`, 
      'info'
    );
  };

  const addEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputs.employeeEmail.trim()) return;

    const currentEmployees = settings.employees || [];
    if (currentEmployees.some(emp => emp.email.toLowerCase() === inputs.employeeEmail.toLowerCase().trim())) {
      triggerToast(language === 'ar' ? 'هذا البريد الإلكتروني مسجل مسبقاً' : 'This email is already registered', 'error');
      return;
    }

    const newEmp = {
      id: Date.now().toString(),
      email: inputs.employeeEmail.trim(),
      name: inputs.employeeName.trim() || inputs.employeeEmail.split('@')[0],
      role: inputs.employeeRole as 'owner' | 'supervisor' | 'cashier',
      status: 'active' as EmployeeStatus,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: currentUserEmail,
    };

    const updatedSettings = {
      ...settings,
      employees: [...currentEmployees, newEmp],
    };

    onSaveSettings(updatedSettings);
    setInputs(prev => ({ ...prev, employeeEmail: '', employeeName: '', employeeRole: 'cashier' }));
    
    triggerToast(
      language === 'ar' 
        ? `تم إضافة الموظف "${newEmp.name}" بصلاحية ${newEmp.role}` 
        : `Added employee "${newEmp.name}" with role ${newEmp.role}`, 
      'success'
    );
  };

  const removeEmployee = (id: string, name: string) => {
    const currentEmployees = settings.employees || [];
    const updatedSettings = {
      ...settings,
      employees: currentEmployees.filter(emp => emp.id !== id),
    };
    onSaveSettings(updatedSettings);
    triggerToast(
      language === 'ar' ? `تم حذف الموظف "${name}"` : `Deleted employee "${name}"`,
      'info'
    );
  };

  const changeEmployeeRole = (id: string, newRole: 'owner' | 'supervisor' | 'cashier') => {
    const currentEmployees = settings.employees || [];
    const updatedSettings = {
      ...settings,
      employees: currentEmployees.map(emp => 
        emp.id === id ? { ...emp, role: newRole } : emp
      ),
    };
    onSaveSettings(updatedSettings);
    triggerToast(
      language === 'ar' ? 'تم تحديث الصلاحية بنجاح' : 'Role updated successfully',
      'success'
    );
  };

  const toggleEmployeeStatus = (id: string, name: string, currentStatus: EmployeeStatus) => {
    const nextStatus: EmployeeStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    const currentEmployees = settings.employees || [];
    const updatedSettings = {
      ...settings,
      employees: currentEmployees.map(emp =>
        emp.id === id ? { ...emp, status: nextStatus } : emp
      ),
    };
    onSaveSettings(updatedSettings);
    triggerToast(
      nextStatus === 'suspended'
        ? (language === 'ar' ? `تم إيقاف صلاحية دخول "${name}"` : `Suspended access for "${name}"`)
        : (language === 'ar' ? `تم إعادة تفعيل "${name}"` : `Reactivated "${name}"`),
      nextStatus === 'suspended' ? 'info' : 'success'
    );
  };

  const handleFloatChange = (val: number) => {
    const updatedSettings = {
      ...settings,
      defaultOpeningFloat: val,
    };
    onSaveSettings(updatedSettings);
  };

  return (
    <div className="space-y-6">
      
      {/* Custom Confirmation Modal Overlay */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 transform scale-100 transition duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-xl ${
                modalConfig.type === 'danger' 
                  ? 'bg-rose-50 text-rose-600' 
                  : modalConfig.type === 'warning'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-blue-50 text-blue-600'
              }`}>
                {modalConfig.type === 'danger' ? (
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                ) : (
                  <Info className="w-5 h-5" />
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
                onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/60 transition cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
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



      {/* Bento Grid layout for settings blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Float Setting (General Settings Block) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              {translations[language].defaultPosFloat}
            </h3>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                {translations[language].standardOpeningFloat}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.defaultOpeningFloat}
                  onChange={e => handleFloatChange(parseInt(e.target.value) || 0)}
                  className="w-full text-right text-sm bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl p-2.5 font-extrabold font-mono outline-hidden focus:ring-1 focus:ring-blue-500/20 text-slate-800 transition"
                />
                <div className={`absolute top-3 text-[10px] text-slate-400 font-extrabold ${language === 'ar' ? 'right-3' : 'left-3'}`}>
                  {translations[language].sar}
                </div>
              </div>
            </div>
            
            <div className="flex-1 text-xs text-slate-400 leading-relaxed bg-slate-50/40 p-3 rounded-xl border border-slate-100">
              {translations[language].floatSettingDesc}
            </div>
          </div>
        </div>

        {/* 1. Branches list (فروع) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {translations[language].branchesList}
                </h3>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                {(Array.isArray(settings.branches) ? settings.branches : []).length} {language === 'ar' ? 'فروع' : 'branches'}
              </span>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); addItem('branches', 'branch', language === 'ar' ? 'قائمة الفروع' : 'Branches'); }} className="flex gap-2">
              <input
                type="text"
                placeholder={language === 'ar' ? "مثال: فرع العليا، فرع المعذر..." : "E.g. Olaya, Corniche..."}
                value={inputs.branch}
                onChange={e => setInputs(prev => ({ ...prev, branch: e.target.value }))}
                className="w-full text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl p-2.5 outline-hidden text-slate-700 transition"
              />
              <button
                type="submit"
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-3xs active:scale-95 cursor-pointer"
                title={translations[language].add}
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
              {(!Array.isArray(settings.branches) || settings.branches.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-400 font-bold bg-slate-50/20">
                  {language === 'ar' ? 'لا توجد فروع مضافة حالياً' : 'No branches added yet.'}
                </div>
              ) : (
                settings.branches.map(b => (
                  <div key={b} className="flex justify-between items-center p-3 text-xs text-slate-700 hover:bg-slate-50/50 transition">
                    <span className="font-bold">{b}</span>
                    <button
                      type="button"
                      onClick={() => removeItem('branches', b, language === 'ar' ? 'قائمة الفروع' : 'Branches')}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150 cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 2. Cashiers list (موظفي الصندوق - كاشير) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {translations[language].cashiersList}
                </h3>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                {(Array.isArray(settings.cashiers) ? settings.cashiers : []).length} {language === 'ar' ? 'موظفين' : 'cashiers'}
              </span>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); addItem('cashiers', 'cashier', language === 'ar' ? 'قائمة الكاشيرز' : 'Cashiers'); }} className="flex gap-2">
              <input
                type="text"
                placeholder={language === 'ar' ? "إضافة اسم كاشير جديد..." : "Add new cashier name..."}
                value={inputs.cashier}
                onChange={e => setInputs(prev => ({ ...prev, cashier: e.target.value }))}
                className="w-full text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl p-2.5 outline-hidden text-slate-700 transition"
              />
              <button
                type="submit"
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-3xs active:scale-95 cursor-pointer"
                title={translations[language].add}
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
              {(!Array.isArray(settings.cashiers) || settings.cashiers.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-400 font-bold bg-slate-50/20">
                  {language === 'ar' ? 'لا يوجد كاشيرز مضافين حالياً' : 'No cashiers added yet.'}
                </div>
              ) : (
                settings.cashiers.map(c => (
                  <div key={c} className="flex justify-between items-center p-3 text-xs text-slate-700 hover:bg-slate-50/50 transition">
                    <span className="font-bold">{c}</span>
                    <button
                      type="button"
                      onClick={() => removeItem('cashiers', c, language === 'ar' ? 'قائمة الكاشيرز' : 'Cashiers')}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150 cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 3. Supervisors list (مشرفين) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {translations[language].supervisorsList}
                </h3>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                {(Array.isArray(settings.supervisors) ? settings.supervisors : []).length} {language === 'ar' ? 'مشرفين' : 'supervisors'}
              </span>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); addItem('supervisors', 'supervisor', language === 'ar' ? 'قائمة المشرفين' : 'Supervisors'); }} className="flex gap-2">
              <input
                type="text"
                placeholder={language === 'ar' ? "إضافة اسم مشرف جديد..." : "Add supervisor name..."}
                value={inputs.supervisor}
                onChange={e => setInputs(prev => ({ ...prev, supervisor: e.target.value }))}
                className="w-full text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl p-2.5 outline-hidden text-slate-700 transition"
              />
              <button
                type="submit"
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-3xs active:scale-95 cursor-pointer"
                title={translations[language].add}
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
              {(!Array.isArray(settings.supervisors) || settings.supervisors.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-400 font-bold bg-slate-50/20">
                  {language === 'ar' ? 'لا يوجد مشرفين مضافين حالياً' : 'No supervisors added yet.'}
                </div>
              ) : (
                settings.supervisors.map(s => (
                  <div key={s} className="flex justify-between items-center p-3 text-xs text-slate-700 hover:bg-slate-50/50 transition">
                    <span className="font-bold">{s}</span>
                    <button
                      type="button"
                      onClick={() => removeItem('supervisors', s, language === 'ar' ? 'قائمة المشرفين' : 'Supervisors')}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150 cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 4. Payment Methods list (طرق الدفع - NEW / COMPLETE ADDITION!) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {translations[language].paymentMethodsList}
                </h3>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                {(Array.isArray(settings.paymentMethods) ? settings.paymentMethods : []).length} {language === 'ar' ? 'طرق' : 'methods'}
              </span>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); addItem('paymentMethods', 'payment', language === 'ar' ? 'طرق الدفع' : 'Payment Methods'); }} className="flex gap-2">
              <input
                type="text"
                placeholder={language === 'ar' ? "إضافة طريقة دفع جديدة..." : "Add payment method..."}
                value={inputs.payment}
                onChange={e => setInputs(prev => ({ ...prev, payment: e.target.value }))}
                className="w-full text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl p-2.5 outline-hidden text-slate-700 transition"
              />
              <button
                type="submit"
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-3xs active:scale-95 cursor-pointer"
                title={translations[language].add}
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
              {(!Array.isArray(settings.paymentMethods) || settings.paymentMethods.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-400 font-bold bg-slate-50/20">
                  {language === 'ar' ? 'لا توجد طرق دفع مضافة حالياً' : 'No payment methods added yet.'}
                </div>
              ) : (
                settings.paymentMethods.map(p => (
                  <div key={p} className="flex justify-between items-center p-3 text-xs text-slate-700 hover:bg-slate-50/50 transition">
                    <span className="font-bold">{p}</span>
                    <button
                      type="button"
                      onClick={() => removeItem('paymentMethods', p, language === 'ar' ? 'طرق الدفع' : 'Payment Methods')}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150 cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 5. Delivery Platforms list (منصات التوصيل) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {translations[language].deliveryPlatformsList}
                </h3>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                {(Array.isArray(settings.deliveryPlatforms) ? settings.deliveryPlatforms : []).length} {language === 'ar' ? 'منصات' : 'platforms'}
              </span>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); addItem('deliveryPlatforms', 'delivery', language === 'ar' ? 'منصات التوصيل' : 'Delivery Platforms'); }} className="flex gap-2">
              <input
                type="text"
                placeholder={language === 'ar' ? "إضافة منصة توصيل مثل: هنقرستيشن..." : "E.g. HungerStation, Jahez..."}
                value={inputs.delivery}
                onChange={e => setInputs(prev => ({ ...prev, delivery: e.target.value }))}
                className="w-full text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl p-2.5 outline-hidden text-slate-700 transition"
              />
              <button
                type="submit"
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-3xs active:scale-95 cursor-pointer"
                title={translations[language].add}
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
              {(!Array.isArray(settings.deliveryPlatforms) || settings.deliveryPlatforms.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-400 font-bold bg-slate-50/20">
                  {language === 'ar' ? 'لا توجد منصات توصيل مضافة حالياً' : 'No platforms added yet.'}
                </div>
              ) : (
                settings.deliveryPlatforms.map(d => (
                  <div key={d} className="flex justify-between items-center p-3 text-xs text-slate-700 hover:bg-slate-50/50 transition">
                    <span className="font-bold">{d}</span>
                    <button
                      type="button"
                      onClick={() => removeItem('deliveryPlatforms', d, language === 'ar' ? 'منصات التوصيل' : 'Delivery Platforms')}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150 cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 6. Shifts list (الورديات - عدد وإدارة الورديات) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {translations[language].shiftsList}
                </h3>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                {(Array.isArray(settings.shifts) ? settings.shifts : []).length} {language === 'ar' ? 'ورديات' : 'shifts'}
              </span>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); addItem('shifts', 'shift', language === 'ar' ? 'قائمة الورديات' : 'Shifts List'); }} className="flex gap-2">
              <input
                type="text"
                placeholder={language === 'ar' ? "إضافة وردية جديدة مثل: الوردية الثالثة..." : "E.g. Night Shift, Middle Shift..."}
                value={inputs.shift}
                onChange={e => setInputs(prev => ({ ...prev, shift: e.target.value }))}
                className="w-full text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl p-2.5 outline-hidden text-slate-700 transition"
              />
              <button
                type="submit"
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-3xs active:scale-95 cursor-pointer"
                title={translations[language].add}
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
              {(!Array.isArray(settings.shifts) || settings.shifts.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-400 font-bold bg-slate-50/20">
                  {language === 'ar' ? 'لا توجد ورديات مضافة حالياً' : 'No shifts added yet.'}
                </div>
              ) : (
                settings.shifts.map(s => (
                  <div key={s} className="flex justify-between items-center p-3 text-xs text-slate-700 hover:bg-slate-50/50 transition">
                    <span className="font-bold">{s}</span>
                    <button
                      type="button"
                      onClick={() => removeItem('shifts', s, language === 'ar' ? 'قائمة الورديات' : 'Shifts List')}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150 cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Pending Access Requests Section */}
      {accessRequests.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-3xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                <ShieldQuestion className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                {language === 'ar' ? 'طلبات دخول بانتظار الموافقة' : 'Pending Access Requests'}
              </h3>
            </div>
            <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md">
              {accessRequests.length} {language === 'ar' ? 'طلب' : 'request(s)'}
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
            {accessRequests.map(req => (
              <div key={req.uid} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 hover:bg-slate-50/50 transition">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">{req.name || req.email.split('@')[0]}</span>
                  <span className="text-[10px] text-slate-500">{req.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={requestRoles[req.uid] || 'cashier'}
                    onChange={(e) => setRequestRoles(prev => ({ ...prev, [req.uid]: e.target.value as any }))}
                    className="text-[10px] font-extrabold px-2 py-1.5 rounded-md outline-hidden cursor-pointer border border-slate-200 bg-slate-50 text-slate-600"
                  >
                    <option value="cashier">{language === 'ar' ? 'كاشير' : 'Cashier'}</option>
                    <option value="supervisor">{language === 'ar' ? 'مشرف' : 'Supervisor'}</option>
                    <option value="owner">{language === 'ar' ? 'مدير' : 'Owner'}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onApproveAccessRequest?.(req, requestRoles[req.uid] || 'cashier')}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'موافقة' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissAccessRequest?.(req)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150 cursor-pointer"
                    title={language === 'ar' ? 'تجاهل' : 'Dismiss'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employees Management Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              {language === 'ar' ? 'إدارة الموظفين والصلاحيات' : 'Employees & Permissions'}
            </h3>
          </div>
          <span className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
            {(settings.employees || []).length} {language === 'ar' ? 'موظفين' : 'employees'}
          </span>
        </div>
        
        <form onSubmit={addEmployee} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder={language === 'ar' ? "الاسم..." : "Name..."}
            value={inputs.employeeName}
            onChange={e => setInputs(prev => ({ ...prev, employeeName: e.target.value }))}
            className="w-full sm:w-1/4 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl p-2.5 outline-hidden text-slate-700 transition"
          />
          <input
            type="email"
            required
            placeholder={language === 'ar' ? "البريد الإلكتروني..." : "Email address..."}
            value={inputs.employeeEmail}
            onChange={e => setInputs(prev => ({ ...prev, employeeEmail: e.target.value }))}
            className="w-full sm:w-2/4 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl p-2.5 outline-hidden text-slate-700 transition"
          />
          <select
            value={inputs.employeeRole}
            onChange={e => setInputs(prev => ({ ...prev, employeeRole: e.target.value }))}
            className="w-full sm:w-1/4 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl p-2.5 outline-hidden text-slate-700 transition cursor-pointer"
          >
            <option value="cashier">{language === 'ar' ? 'كاشير' : 'Cashier'}</option>
            <option value="supervisor">{language === 'ar' ? 'مشرف' : 'Supervisor'}</option>
            <option value="owner">{language === 'ar' ? 'مدير' : 'Owner'}</option>
          </select>
          <button
            type="submit"
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-3xs active:scale-95 cursor-pointer shrink-0 flex items-center justify-center"
            title={translations[language].add}
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
          {(!settings.employees || settings.employees.length === 0) ? (
            <div className="p-6 text-center text-xs text-slate-400 font-bold bg-slate-50/20">
              {language === 'ar' ? 'لا يوجد موظفين مضافين حالياً' : 'No employees added yet.'}
            </div>
          ) : (
            settings.employees.map(emp => {
              const status: EmployeeStatus = emp.status || 'active';
              const isSuspended = status === 'suspended';
              return (
                <div key={emp.id} className={`flex justify-between items-center p-3 hover:bg-slate-50/50 transition ${isSuspended ? 'opacity-60' : ''}`}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-700">{emp.name || emp.email.split('@')[0]}</span>
                      {isSuspended && (
                        <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md">
                          {language === 'ar' ? 'موقوف' : 'Suspended'}
                        </span>
                      )}
                      {emp.mfaEnrolled === false && !isSuspended && (
                        <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md">
                          {language === 'ar' ? 'بدون 2FA' : 'No 2FA'}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={emp.role}
                      onChange={(e) => changeEmployeeRole(emp.id, e.target.value as 'owner' | 'supervisor' | 'cashier')}
                      className={`text-[10px] font-extrabold px-2 py-1 rounded-md outline-hidden cursor-pointer border-0 ${
                        emp.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                        emp.role === 'supervisor' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <option value="owner">{language === 'ar' ? 'مدير' : 'Owner'}</option>
                      <option value="supervisor">{language === 'ar' ? 'مشرف' : 'Supervisor'}</option>
                      <option value="cashier">{language === 'ar' ? 'كاشير' : 'Cashier'}</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => toggleEmployeeStatus(emp.id, emp.name || emp.email, status)}
                      title={isSuspended ? (language === 'ar' ? 'إعادة تفعيل' : 'Reactivate') : (language === 'ar' ? 'إيقاف مؤقت' : 'Suspend')}
                      className={`p-1.5 rounded-lg transition duration-150 cursor-pointer ${
                        isSuspended
                          ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                      }`}
                    >
                      {isSuspended ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEmployee(emp.id, emp.name || emp.email)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150 cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Login Audit Trail */}
      {auditLog.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                {language === 'ar' ? 'سجل تسجيلات الدخول' : 'Login Audit Trail'}
              </h3>
            </div>
            <span className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
              {language === 'ar' ? 'آخر 50 عملية' : 'Last 50 events'}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
            {auditLog.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-700">{entry.email}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(entry.at).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                  </span>
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                  entry.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                  entry.role === 'supervisor' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {entry.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
