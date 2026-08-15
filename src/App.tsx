/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, User, signOut, multiFactor } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  limit,
  deleteDoc,
  writeBatch,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

import { DailyClosingRecord, AppSettings, AccessRequest, AuditLogEntry } from './types';
import { DEFAULT_SETTINGS } from './data/defaultSettings';
import { translations, Language } from './lib/translations';
import firebaseAppletConfig from '../firebase-applet-config.json';

// Import Tabs
import DailyClosingTab from './components/DailyClosingTab';
import DailyLogTab from './components/DailyLogTab';
import SettingsTab from './components/SettingsTab';
import { Login } from './components/Login';
import DashboardTab from './components/DashboardTab';
import { MfaEnrollGate } from './components/MfaEnrollGate';

// Icons
import { 
  Coffee, 
  FileText, 
  Layers, 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  CloudCheck, 
  CloudLightning,
  AlertCircle,
  CheckCircle,
  XCircle,
  ShieldCheck,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';

export default function App() {
  // 1. Navigation & Tab State
  const [activeTab, setActiveTab] = useState<'closing' | 'logs' | 'dashboard' | 'settings'>('closing');
  const [language, setLanguage] = useState<Language>('en');

  // 1b. Theme (light / dark) state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'dark';
    }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    if (saved === 'light' || saved === 'dark') return saved;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  // 2. Local Database State
  const [logs, setLogs] = useState<DailyClosingRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // 3. Google OAuth & Firebase state
  const [firebaseConfig, setFirebaseConfig] = useState<any>(null);
  const [dbInstance, setDbInstance] = useState<any>(null);
  const [authInstance, setAuthInstance] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  // 4. Toast alerts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 5. Role based access control
  const [activeRole, setActiveRole] = useState<'owner' | 'supervisor' | 'cashier' | null>(null);
  const [activeEmployeeName, setActiveEmployeeName] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // 5b. Access approval state: null while resolving, 'pending' (not yet an
  // approved employee), 'suspended' (was approved, access revoked), or
  // 'active' once the employee record is found with status === 'active'.
  const [accessState, setAccessState] = useState<'pending' | 'suspended' | 'active' | null>(null);
  const [mfaChecked, setMfaChecked] = useState(false);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedLogs = localStorage.getItem('foodics_closing_logs');
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error('Failed to parse logs:', e);
        setLogs([]);
      }
    } else {
      setLogs([]);
    }

    const savedLanguage = localStorage.getItem('foodics_language');
    if (savedLanguage === 'en' || savedLanguage === 'ar') {
      setLanguage(savedLanguage);
    }

    const savedSettings = localStorage.getItem('foodics_closing_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed
        });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }, []);

  // Initialize Firebase Applet config
  useEffect(() => {
    try {
      if (firebaseAppletConfig && Object.keys(firebaseAppletConfig).length > 0) {
        setFirebaseConfig(firebaseAppletConfig);
        // Initialize Firebase safely
        const app = getApps().length === 0 ? initializeApp(firebaseAppletConfig) : getApp();
        const db = getFirestore(app, firebaseAppletConfig.firestoreDatabaseId || "(default)");
        const auth = getAuth(app);
        setDbInstance(db);
        setAuthInstance(auth);

        const unsubscribe = onAuthStateChanged(auth, (u) => {
          if (u) {
            setUser(u);
            setMfaEnrolled(multiFactor(u).enrolledFactors.length > 0);
            setMfaChecked(true);
          } else {
            setUser(null);
            setActiveRole(null);
            setActiveEmployeeName(null);
            setAccessState(null);
            setMfaChecked(false);
            setMfaEnrolled(false);
          }
        });
        return () => unsubscribe();
      }
    } catch (err) {
      console.warn('Firebase applet config not loaded or unavailable:', err);
    }
  }, []);

  // Role assignment based on Firebase User and Settings.
  // STRICT ALLOWLIST: only emails the owner has manually added to
  // settings.employees with status "active" are granted a role. No account
  // is ever auto-provisioned. Unknown or non-active accounts are logged as
  // an access request the owner can review and approve from Settings.
  useEffect(() => {
    if (!user || !settings || !isSettingsLoaded) return;

    // Defensive normalization: manual Firestore console edits are error-prone
    // (stray spaces, mixed case), so trim/lowercase before comparing.
    const employee = settings.employees?.find(
      e => e.email?.trim().toLowerCase() === user.email?.trim().toLowerCase()
    );
    const empStatus = employee?.status?.trim().toLowerCase();
    const empRole = employee?.role?.trim().toLowerCase() as 'owner' | 'supervisor' | 'cashier' | undefined;

    if (employee && empStatus === 'active' && empRole) {
      setActiveRole(empRole);
      setActiveEmployeeName((employee.name || '').trim() || user.displayName || employee.email);
      sessionStorage.setItem('foodics_active_role', empRole);
      setAccessState('active');

      // Audit trail: record this login (best-effort, non-blocking)
      if (dbInstance) {
        addDoc(collection(dbInstance, 'store', '8oz_main', 'auditLog'), {
          type: 'login',
          uid: user.uid,
          email: user.email,
          role: empRole,
          at: new Date().toISOString(),
        }).catch(() => {});
      }
      return;
    }

    setActiveRole(null);
    setActiveEmployeeName(null);
    sessionStorage.removeItem('foodics_active_role');

    if (employee && empStatus === 'suspended') {
      setAccessState('suspended');
      return;
    }

    // Not an approved employee: file/refresh an access request so the owner
    // can see and approve it from Settings. This never grants any role.
    setAccessState('pending');
    if (dbInstance && user.uid && user.email) {
      setDoc(
        doc(dbInstance, 'store', '8oz_main', 'accessRequests', user.uid),
        {
          uid: user.uid,
          email: user.email,
          name: user.displayName || '',
          requestedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {});
    }
  }, [user, settings.employees, dbInstance, isSettingsLoaded]);

  // Pending account access requests, visible to owners/supervisors only
  // (Firestore rules also enforce this server-side).
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  useEffect(() => {
    if (!dbInstance || !(activeRole === 'owner' || activeRole === 'supervisor')) {
      setAccessRequests([]);
      return;
    }
    const reqCollectionRef = collection(dbInstance, 'store', '8oz_main', 'accessRequests');
    const unsubscribe = onSnapshot(
      reqCollectionRef,
      (snap) => {
        const reqs: AccessRequest[] = [];
        snap.forEach((d) => reqs.push(d.data() as AccessRequest));
        reqs.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        setAccessRequests(reqs);
      },
      () => setAccessRequests([])
    );
    return () => unsubscribe();
  }, [dbInstance, activeRole]);

  const approveAccessRequest = (req: AccessRequest, role: 'owner' | 'supervisor' | 'cashier') => {
    if (!dbInstance) return;
    const currentEmployees = settings.employees || [];
    const newEmployee = {
      id: Date.now().toString(),
      name: req.name || req.email.split('@')[0],
      email: req.email,
      role,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: user?.email || '',
    };
    const updatedSettings = { ...settings, employees: [...currentEmployees, newEmployee] };
    handleSaveSettings(updatedSettings);
    deleteDoc(doc(dbInstance, 'store', '8oz_main', 'accessRequests', req.uid)).catch(() => {});
    showToast(
      language === 'ar' ? `تمت الموافقة على ${req.email}` : `Approved ${req.email}`,
      'success'
    );
  };

  const dismissAccessRequest = (req: AccessRequest) => {
    if (!dbInstance) return;
    deleteDoc(doc(dbInstance, 'store', '8oz_main', 'accessRequests', req.uid)).catch(() => {});
    showToast(
      language === 'ar' ? `تم تجاهل طلب ${req.email}` : `Dismissed request from ${req.email}`,
      'info'
    );
  };

  // Recent login audit trail, visible to owners/supervisors only.
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  useEffect(() => {
    if (!dbInstance || !(activeRole === 'owner' || activeRole === 'supervisor')) {
      setAuditLog([]);
      return;
    }
    const auditCollectionRef = collection(dbInstance, 'store', '8oz_main', 'auditLog');
    const q = query(auditCollectionRef, orderBy('at', 'desc'), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const entries: AuditLogEntry[] = [];
        snap.forEach((d) => entries.push(d.data() as AuditLogEntry));
        setAuditLog(entries);
      },
      () => setAuditLog([])
    );
    return () => unsubscribe();
  }, [dbInstance, activeRole]);

  // Real-time Firestore Sync
  useEffect(() => {
    if (!dbInstance) return;

    // Listen to store settings and language globally
    const userDocRef = doc(dbInstance, 'store', '8oz_main');
    const unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
      setIsSettingsLoaded(true);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.settings) {
          setSettings(data.settings);
          localStorage.setItem('foodics_closing_settings', JSON.stringify(data.settings));
        }
        if (data.language) {
          setLanguage(data.language);
          localStorage.setItem('foodics_language', data.language);
        }
      } else {
        // Doc doesn't exist, seed it with current local settings so they don't lose local customizations!
        const initialSettings = {
          settings: settings,
          language: language,
          updatedAt: new Date().toISOString()
        };
        setDoc(userDocRef, initialSettings, { merge: true }).catch(err => {
          console.error("Error seeding initial settings to Firestore:", err);
        });
      }
    }, (error) => {
      console.error("Firestore user doc subscription error:", error);
      setIsSettingsLoaded(true);
    });

    // Listen to user logs
    const logsCollectionRef = collection(dbInstance, 'store', '8oz_main', 'logs');
    const q = query(logsCollectionRef);
    const unsubscribeLogs = onSnapshot(q, async (querySnapshot) => {
      const fetchedLogs: DailyClosingRecord[] = [];
      querySnapshot.forEach((doc) => {
        fetchedLogs.push(doc.data() as DailyClosingRecord);
      });

      // Sort fetchedLogs descending by timestamp to keep chronological order
      fetchedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (fetchedLogs.length === 0) {
        // If Firestore has NO logs, but we have local logs, let's migrate the local logs to Firestore!
        const savedLocalLogs = localStorage.getItem('foodics_closing_logs');
        if (savedLocalLogs) {
          try {
            const parsedLocalLogs: DailyClosingRecord[] = JSON.parse(savedLocalLogs);
            if (parsedLocalLogs.length > 0) {
              console.log("Migrating local logs to Firestore...", parsedLocalLogs);
              const batch = writeBatch(dbInstance);
              parsedLocalLogs.forEach((l) => {
                const docRef = doc(dbInstance, 'store', '8oz_main', 'logs', l.id);
                batch.set(docRef, l);
              });
              await batch.commit();
              showToast(
                language === 'ar' 
                  ? 'تمت مزامنة جميع بياناتك وسجلاتك المحلية مع السحابة بنجاح!' 
                  : 'Successfully synced all your local logs to the cloud!', 
                'success'
              );
              return;
            }
          } catch (e) {
            console.error('Error migrating local logs to Firestore:', e);
          }
        }
      }

      setLogs(fetchedLogs);
      localStorage.setItem('foodics_closing_logs', JSON.stringify(fetchedLogs));
    }, (error) => {
      console.error("Firestore logs subscription error:", error);
    });

    return () => {
      unsubscribeUserDoc();
      unsubscribeLogs();
    };
  }, [dbInstance]);

  // Helper for triggering temporary visual toast notifications
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Save new closing log (Offline-first, and sync online if sheets linked)
  const handleSaveClosing = (recordData: Omit<DailyClosingRecord, 'id' | 'timestamp'>) => {
    const newRecord: DailyClosingRecord = {
      id: `CLS-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      ...recordData,
    };

    const updatedLogs = [newRecord, ...logs];
    setLogs(updatedLogs);
    localStorage.setItem('foodics_closing_logs', JSON.stringify(updatedLogs));

    if (dbInstance) {
      const docRef = doc(dbInstance, 'store', '8oz_main', 'logs', newRecord.id);
      setDoc(docRef, { ...newRecord, userId: user?.uid || 'anonymous' }).catch(err => {
        console.error("Failed to write to Firestore:", err);
      });
    }

    // Go to Daily Logs list automatically and instantly!
    setActiveTab('logs');

    showToast(
      language === 'ar' 
        ? (dbInstance && user ? 'تم إقفال الوردية ومزامنتها سحابياً بنجاح!' : 'تم إقفال الوردية وحفظ البيانات محلياً بنجاح!') 
        : (dbInstance && user ? 'Shift closed and synced to cloud successfully!' : 'Shift closed and saved locally!'), 
      'success'
    );
  };

  // Delete Log Row
  const handleDeleteLog = (id: string, permanent: boolean = false) => {
    if (dbInstance) {
      const docRef = doc(dbInstance, 'store', '8oz_main', 'logs', id);
      if (permanent) {
        deleteDoc(docRef)
          .then(() => {
            showToast(
              language === 'ar' 
                ? 'تم حذف السجل نهائياً من السحابة.' 
                : 'Log record permanently deleted from cloud.', 
              'info'
            );
          })
          .catch(err => {
            console.error("Failed to delete from Firestore:", err);
          });
      } else {
        setDoc(docRef, { isDeletedFromLog: true }, { merge: true })
          .then(() => {
            showToast(
              language === 'ar' 
                ? 'تم إخفاء السجل من القائمة.' 
                : 'Record hidden from list.', 
              'success'
            );
          })
          .catch(err => {
            console.error("Failed to hide in Firestore:", err);
          });
      }
    } else {
      let updated: DailyClosingRecord[];
      if (permanent) {
        updated = logs.filter(l => l.id !== id);
        showToast(
          language === 'ar' 
            ? 'تم حذف السجل نهائياً بالكامل.' 
            : 'Log record permanently deleted.', 
          'info'
        );
      } else {
        updated = logs.map(l => l.id === id ? { ...l, isDeletedFromLog: true } : l);
        showToast(
          language === 'ar' 
            ? 'تم إخفاء السجل من القائمة مع الحفاظ على البيانات في لوحة التحكم.' 
            : 'Record hidden from list. Data preserved in dashboard.', 
          'success'
        );
      }
      setLogs(updated);
      localStorage.setItem('foodics_closing_logs', JSON.stringify(updated));
    }
  };

  // Export full client log as CSV
  const handleExportCSV = () => {
    if (logs.length === 0) {
      showToast('No logs to export.', 'info');
      return;
    }

    const headers = [
      'Date / التاريخ',
      'Branch / الفرع',
      'Cashier / الكاشير',
      'Shift / الوردية',
      'Register # / رقم الصندوق',
      'Opening Float / العهدة الافتتاحية',
      'Cash Sales / المبيعات النقدية',
      'Mada / مدى',
      'Visa / فيزا',
      'Mastercard / ماستركارد',
      'GCC Network / شبكة الخليج',
      'Total Card Sales (Expected) / إجمالي الشبكة المتوقع',
      'Actual Card Counted / إجمالي الشبكة الفعلي',
      'Card Difference / فرق الشبكة',
      'Keeta / كيتا',
      'Hungerstation / هنجرستيشن',
      'Jahez / جاهز',
      'Mrsool / مرسول',
      'Other Payments / مدفوعات أخرى',
      'Total Delivery / إجمالي التوصيل',
      'Total Returns / إجمالي المرتجعات',
      'Net Sales / صافي المبيعات',
      'Pay In / المقبوضات',
      'Pay Out / المدفوعات الصادرة',
      'Cash Drops / الإنزال النقدي',
      'Return Operations / مرتجع الصندوق',
      'Cash Expenses (Box Expenses) / مصروفات الصندوق',
      'Expected Cash / النقد المتوقع بالصندوق',
      'Actual Cash / النقد الفعلي المحسوب',
      'Cash Difference / عجز أو زيادة الكاش',
      'Overall Difference / الفرق الإجمالي',
      'Status / الحالة',
      'Amount to Deposit / المبلغ المودع',
      'Remaining Float / العهدة المتبقية',
      'Notes / ملاحظات الوردية',
      'Cashier Signature / توقيع الكاشير',
      'Timestamp / وقت التسجيل'
    ];

    const rows = logs.map(log => {
      const cardSales =
        (log.payments.spanMada || 0) +
        (log.payments.visa || 0) +
        (log.payments.mastercard || 0) +
        (log.payments.gccNetwork || 0);

      const actualCard = 
        (log.cardBreakdown?.mada || 0) +
        (log.cardBreakdown?.visa || 0) +
        (log.cardBreakdown?.mastercard || 0) +
        (log.cardBreakdown?.amex || 0) +
        (log.cardBreakdown?.gccNet || 0);

      const cardDifference = actualCard - cardSales;

      const deliverySales =
        (log.payments.keeta || 0) +
        (log.payments.hungerstation || 0) +
        (log.payments.jahez || 0) +
        (log.payments.mrsool || 0);

      const totalSales = (log.payments.cash || 0) + cardSales + deliverySales + (log.payments.otherPayments || 0);
      const netSales = totalSales - (log.payments.totalReturns || 0);

      const expectedCash = log.reconciliation.expectedCash;
      const actualCash = log.reconciliation.actualCash;
      const cashDifference = log.reconciliation.difference;
      const overallDifference = log.reconciliation.overallDifference ?? cashDifference;

      return [
        log.shiftInfo.businessDate,
        `"${(log.shiftInfo.branch || '').replace(/"/g, '""')}"`,
        `"${(log.shiftInfo.cashier || '').replace(/"/g, '""')}"`,
        log.shiftInfo.shift === 'Morning' || log.shiftInfo.shift === 'Morning Shift'
          ? (language === 'ar' ? 'صباحي / Morning' : 'Morning')
          : log.shiftInfo.shift === 'Evening' || log.shiftInfo.shift === 'Evening Shift'
          ? (language === 'ar' ? 'مسائي / Evening' : 'Evening')
          : log.shiftInfo.shift,
        log.shiftInfo.registerNumber || '1',
        log.openingFloat || 0,
        log.payments.cash || 0,
        log.payments.spanMada || 0,
        log.payments.visa || 0,
        log.payments.mastercard || 0,
        log.payments.gccNetwork || 0,
        cardSales,
        actualCard,
        cardDifference,
        log.payments.keeta || 0,
        log.payments.hungerstation || 0,
        log.payments.jahez || 0,
        log.payments.mrsool || 0,
        log.payments.otherPayments || 0,
        deliverySales,
        log.payments.totalReturns || 0,
        netSales,
        log.drawerOperations?.payIn ?? 0,
        log.drawerOperations?.payOut ?? 0,
        log.drawerOperations?.cashDrops ?? 0,
        log.drawerOperations?.returnOperations ?? 0,
        log.drawerOperations?.cashExpenses ?? 0,
        expectedCash,
        actualCash,
        cashDifference,
        overallDifference,
        log.reconciliation.status === 'Balanced' ? (language === 'ar' ? 'متطابق / Balanced' : 'Balanced') : log.reconciliation.status === 'Over' ? (language === 'ar' ? 'زيادة / Over' : 'Over') : (language === 'ar' ? 'عجز / Short' : 'Short'),
        log.deposit?.amountToDeposit ?? 0,
        log.deposit?.remainingFloat ?? 0,
        `"${(log.deposit?.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(log.deposit?.cashierSignature || '').replace(/"/g, '""')}"`,
        log.timestamp || ''
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    // Create a blob with UTF-8 BOM to ensure perfect Arabic character display in Excel
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `8oz_POS_Reconciliations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(language === 'ar' ? 'تم تصدير سجل البيانات بنجاح!' : 'CSV exported successfully!', 'success');
  };

  // Save Settings from settings tab
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('foodics_closing_settings', JSON.stringify(newSettings));

    if (dbInstance) {
      const userDocRef = doc(dbInstance, 'store', '8oz_main');
      setDoc(userDocRef, { settings: newSettings, updatedAt: new Date().toISOString() }, { merge: true })
        .then(() => {
          showToast(language === 'ar' ? 'تم حفظ الإعدادات ومزامنتها سحابياً بنجاح!' : 'Settings updated and synced to cloud!', 'success');
        })
        .catch(err => {
          console.error("Failed to sync settings to Firestore:", err);
          showToast('Settings updated locally (failed cloud sync)', 'info');
        });
    } else {
      showToast('Settings and custom dropdown lists updated!', 'success');
    }
  };

  // Pre-fill 15 days of perfect mock closing data for visual testing
  const handleLoadMockData = () => {
    const mockList: DailyClosingRecord[] = [];
    const baseTime = Date.now();

    for (let i = 0; i < 15; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const cashSales = Math.floor(1500 + Math.random() * 2500);
      const madaSales = Math.floor(1000 + Math.random() * 2000);
      const visaSales = Math.floor(200 + Math.random() * 800);
      const mastercardSales = Math.floor(100 + Math.random() * 400);
      const gccSales = Math.floor(50 + Math.random() * 200);

      const keetaSales = Math.floor(200 + Math.random() * 500);
      const hungerSales = Math.floor(300 + Math.random() * 700);
      const jahezSales = Math.floor(400 + Math.random() * 800);
      const mrsoolSales = Math.floor(100 + Math.random() * 300);

      const expenses = Math.random() > 0.7 ? Math.floor(30 + Math.random() * 100) : 0;
      
      const expectedCashValue = settings.defaultOpeningFloat + cashSales - expenses;
      // Introduce subtle random overage or shortage to demonstrate conditional highlights
      let differenceValue = 0;
      if (Math.random() > 0.85) {
        differenceValue = Math.random() > 0.5 ? Math.floor(10 + Math.random() * 50) : -Math.floor(10 + Math.random() * 50);
      }
      const actualCashValue = expectedCashValue + differenceValue;

      let stat: 'Balanced' | 'Over' | 'Short' = 'Balanced';
      if (differenceValue > 0) stat = 'Over';
      if (differenceValue < 0) stat = 'Short';

      // Build mock denominations to match actual cash
      let rem = actualCashValue;
      const d500 = Math.floor(rem / 500); rem %= 500;
      const d200 = Math.floor(rem / 200); rem %= 200;
      const d100 = Math.floor(rem / 100); rem %= 100;
      const d50 = Math.floor(rem / 50); rem %= 50;
      const d20 = Math.floor(rem / 20); rem %= 20;
      const d10 = Math.floor(rem / 10); rem %= 10;
      const d5 = Math.floor(rem / 5); rem %= 5;
      const d1 = Math.floor(rem); rem %= 1;
      const d0_50 = rem >= 0.5 ? 1 : 0;

      mockList.push({
        id: `CLS-${baseTime.toString().slice(-6)}-${i}`,
        timestamp: new Date(date.getTime() - i * 60 * 1000).toISOString(),
        shiftInfo: {
          businessDate: dateStr,
          branch: settings.branches[i % settings.branches.length] || 'Riyadh Olaya Branch',
          cashier: settings.cashiers[i % settings.cashiers.length] || 'Ahmed Al-Harbi',
          shift: (settings.shifts && settings.shifts.length > 0) 
            ? settings.shifts[i % settings.shifts.length] 
            : (i % 2 === 0 ? 'Evening' : 'Morning'),
          registerNumber: '1',
          openingTime: '08:00 AM',
          closingTime: '11:45 PM',
        },
        payments: {
          cash: cashSales,
          spanMada: madaSales,
          visa: visaSales,
          mastercard: mastercardSales,
          gccNetwork: gccSales,
          keeta: keetaSales,
          hungerstation: hungerSales,
          jahez: jahezSales,
          mrsool: mrsoolSales,
          otherPayments: 0,
          totalReturns: Math.random() > 0.8 ? 50 : 0,
        },
        drawerOperations: {
          payIn: 0,
          payOut: 0,
          cashDrops: 0,
          returnOperations: 0,
          cashExpenses: expenses,
        },
        openingFloat: settings.defaultOpeningFloat,
        cashCount: {
          sar500: d500,
          sar200: d200,
          sar100: d100,
          sar50: d50,
          sar20: d20,
          sar10: d10,
          sar5: d5,
          sar1: d1,
          sar0_50: d0_50,
        },
        reconciliation: {
          expectedCash: expectedCashValue,
          actualCash: actualCashValue,
          difference: differenceValue,
          status: stat,
        },
        deposit: {
          amountToDeposit: Math.max(0, actualCashValue - settings.defaultOpeningFloat),
          remainingFloat: settings.defaultOpeningFloat,
          notes: differenceValue !== 0 ? `Subtle ${stat.toLowerCase()} observed during cash counting.` : 'Perfect match.',
          cashierSignature: 'Mock Clerk Signature',
        },
      });
    }

    setLogs(mockList);
    localStorage.setItem('foodics_closing_logs', JSON.stringify(mockList));
    showToast('Successfully pre-filled 15 days of coffee shop history!', 'success');
  };

  const handleClearAllData = async () => {
    if (window.confirm(translations[language].confirmDeleteAllLogs)) {
      if (dbInstance) {
        try {
          const batch = writeBatch(dbInstance);
          logs.forEach((l) => {
            const docRef = doc(dbInstance, 'store', '8oz_main', 'logs', l.id);
            batch.delete(docRef);
          });
          await batch.commit();
          showToast(language === 'ar' ? 'تم مسح جميع سجلات الإقفال من السحابة بنجاح.' : 'All closing logs wiped from cloud successfully.', 'info');
        } catch (e) {
          console.error("Failed to wipe Firestore logs:", e);
          showToast('Failed to wipe logs from cloud', 'error');
        }
      } else {
        setLogs([]);
        localStorage.removeItem('foodics_closing_logs');
        showToast(language === 'ar' ? 'تم مسح جميع سجلات الإقفال بنجاح.' : 'All closing logs wiped successfully.', 'info');
      }
    }
  };

  const toggleLanguage = () => {
    const nextLang = language === 'en' ? 'ar' : 'en';
    setLanguage(nextLang);
    localStorage.setItem('foodics_language', nextLang);

    if (dbInstance) {
      const userDocRef = doc(dbInstance, 'store', '8oz_main');
      setDoc(userDocRef, { language: nextLang, updatedAt: new Date().toISOString() }, { merge: true })
        .catch(err => {
          console.error("Failed to sync language to Firestore:", err);
        });
    }
  };

  if (firebaseConfig && !user) {
    return <Login language={language} />;
  }

  // Pending / suspended accounts: never see any app data or role.
  if (user && isSettingsLoaded && (accessState === 'pending' || accessState === 'suspended')) {
    const isSuspended = accessState === 'suspended';
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center p-4 ${language === 'ar' ? 'font-arabic' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {isSuspended
              ? (language === 'ar' ? 'تم إيقاف حسابك' : 'Account Suspended')
              : (language === 'ar' ? 'بانتظار الموافقة' : 'Pending Approval')}
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            {isSuspended
              ? (language === 'ar'
                  ? 'تم إيقاف صلاحية الدخول لهذا الحساب. تواصل مع المدير لمزيد من التفاصيل.'
                  : 'Access for this account has been suspended. Contact the owner for details.')
              : (language === 'ar'
                  ? 'حسابك غير مضاف بعد. لا يمكنك رؤية أي بيانات حتى يوافق عليك المدير من صفحة الإعدادات.'
                  : 'Your account isn\'t added yet. You can\'t see any data until the owner approves you from Settings.')}
          </p>
          <button
            onClick={() => signOut(authInstance)}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
          >
            {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
          </button>
        </div>
      </div>
    );
  }

  // Mandatory 2FA: every active account must have an authenticator app
  // enrolled before it can see any app data. No skip option.
  if (user && accessState === 'active' && mfaChecked && !mfaEnrolled && authInstance) {
    return (
      <MfaEnrollGate
        auth={authInstance}
        user={user}
        language={language}
        onEnrolled={() => setMfaEnrolled(true)}
        onSignOut={() => signOut(authInstance)}
      />
    );
  }

  if (firebaseConfig && !isSettingsLoaded) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center p-4 ${language === 'ar' ? 'font-arabic' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-bold">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-100 selection:text-blue-900 pb-12">
      
      {/* Toast Alert Banner */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold ${
            toast.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : toast.type === 'error' 
              ? 'bg-rose-50 border-rose-100 text-rose-800' 
              : 'bg-blue-50 border-blue-100 text-blue-800'
          }`}>
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4 text-rose-600" />}
            {toast.type === 'info' && <AlertCircle className="w-4 h-4 text-blue-600" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Modern High-End Executive Navigation Rail */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-100 shadow-3xs no-print">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          {/* Logo Brand */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-xs select-none tracking-tight">
              8oz
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-extrabold text-slate-400 block leading-none">Foodics POS</span>
              <span className="text-sm font-black text-slate-900 tracking-tight block">
                {language === 'ar' ? 'تسوية عهد ومبيعات 8oz' : '8oz Custody & Sales Reconciliation'}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/50">
            <button
              onClick={() => setActiveTab('closing')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition duration-150 cursor-pointer ${
                activeTab === 'closing' 
                  ? 'bg-white text-blue-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              {translations[language].dailyClosing}
            </button>
            {(activeRole === 'owner' || activeRole === 'supervisor') && (
              <button
                onClick={() => setActiveTab('logs')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition duration-150 cursor-pointer ${
                  activeTab === 'logs' 
                    ? 'bg-white text-blue-600 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {translations[language].dailyLog}
              </button>
            )}
            {activeRole === 'owner' && (
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition duration-150 cursor-pointer ${
                    activeTab === 'dashboard' 
                      ? 'bg-white text-blue-600 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  {translations[language].dashboard}
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition duration-150 cursor-pointer ${
                    activeTab === 'settings' 
                      ? 'bg-white text-blue-600 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                  }`}
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  {translations[language].settings}
                </button>
              </>
            )}
          </nav>

          {/* Google Sheets integration widget */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title={language === 'ar' ? (theme === 'dark' ? 'الوضع العادي' : 'الوضع الليلي') : (theme === 'dark' ? 'Light mode' : 'Dark mode')}
              className="inline-flex items-center justify-center w-8 h-8 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg transition cursor-pointer"
            >
              {language === 'en' ? 'العربية' : 'English'}
            </button>

            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg py-1 px-2">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  {activeRole === 'owner' ? (language === 'ar' ? 'المدير' : 'Manager') : 
                   activeRole === 'supervisor' ? (language === 'ar' ? 'المشرف' : 'Supervisor') : 
                   (language === 'ar' ? 'الكاشير' : 'Cashier')}
                </span>
                {activeEmployeeName && (
                  <span className="text-xs font-bold text-slate-700">
                    {activeEmployeeName}
                  </span>
                )}
              </div>
            </div>
            
            {user && (
              <button
                onClick={() => signOut(authInstance)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                title={language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main workspace viewport wrapper */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 w-full flex-grow">
        
        {/* Mobile Navigation fallback */}
        <div className="md:hidden flex items-center justify-between bg-white border border-slate-200/60 rounded-xl p-1 mb-6 shadow-3xs overflow-x-auto gap-1 no-print">
          <button
            onClick={() => setActiveTab('closing')}
            className={`flex-1 text-center py-2.5 text-xs font-extrabold rounded-lg transition-all duration-150 active:scale-95 cursor-pointer ${
              activeTab === 'closing' 
                ? 'bg-blue-50 text-blue-700 shadow-xs' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {translations[language].dailyClosing}
          </button>
          {(activeRole === 'owner' || activeRole === 'supervisor') && (
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 text-center py-2.5 text-xs font-extrabold rounded-lg transition-all duration-150 active:scale-95 cursor-pointer ${
                activeTab === 'logs' 
                  ? 'bg-blue-50 text-blue-700 shadow-xs' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {translations[language].dailyLog}
            </button>
          )}
          {activeRole === 'owner' && (
            <>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 text-center py-2.5 text-xs font-extrabold rounded-lg transition-all duration-150 active:scale-95 cursor-pointer ${
                  activeTab === 'dashboard' 
                    ? 'bg-blue-50 text-blue-700 shadow-xs' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {translations[language].dashboard}
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 text-center py-2.5 text-xs font-extrabold rounded-lg transition-all duration-150 active:scale-95 cursor-pointer ${
                  activeTab === 'settings' 
                    ? 'bg-blue-50 text-blue-700 shadow-xs' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {translations[language].settings}
              </button>
            </>
          )}
        </div>






        {/* Viewport content router */}
        <div className="animate-fade-in">
          {activeTab === 'closing' && (
            <DailyClosingTab
              settings={settings}
              onSave={handleSaveClosing}
              isSyncing={isSyncing}
              language={language}
              dbInstance={dbInstance}
            />
          )}

          {activeTab === 'logs' && (
            <DailyLogTab
              logs={logs}
              onDeleteLog={handleDeleteLog}
              onExportCSV={handleExportCSV}
              isSyncing={isSyncing}
              language={language}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardTab logs={logs} language={language} />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onLoadMockData={handleLoadMockData}
              onClearAllData={handleClearAllData}
              language={language}
              showToast={showToast}
              accessRequests={accessRequests}
              onApproveAccessRequest={approveAccessRequest}
              onDismissAccessRequest={dismissAccessRequest}
              currentUserEmail={user?.email || ''}
              auditLog={auditLog}
            />
          )}
        </div>

      </main>

    </div>
  );
}
