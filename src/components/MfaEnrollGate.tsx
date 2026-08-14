/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Auth, User, multiFactor, TotpMultiFactorGenerator, TotpSecret } from 'firebase/auth';
import QRCode from 'qrcode';
import { ShieldCheck, ShieldAlert, Copy, Check, LogOut } from 'lucide-react';
import { Language } from '../lib/translations';

interface Props {
  auth: Auth;
  user: User;
  language: Language;
  onEnrolled: () => void;
  onSignOut: () => void;
}

/**
 * Mandatory TOTP (authenticator app) second-factor enrollment screen.
 * Rendered whenever a signed-in, approved employee has zero enrolled
 * multi-factor auth methods. There is no "skip" option — everyone must
 * enroll before reaching the app.
 */
export function MfaEnrollGate({ auth, user, language, onEnrolled, onSignOut }: Props) {
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAr = language === 'ar';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const session = await multiFactor(user).getSession();
        const generatedSecret = await TotpMultiFactorGenerator.generateSecret(session);
        if (cancelled) return;
        setSecret(generatedSecret);
        const otpauthUrl = generatedSecret.generateQrCodeUrl(
          user.email || 'user',
          '8Oz Coffee Reconciliation'
        );
        const dataUrl = await QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch (err: any) {
        console.error('MFA enrollment init error:', err);
        if (!cancelled) {
          setError(
            err?.code === 'auth/operation-not-allowed'
              ? (isAr
                  ? 'التحقق بخطوتين غير مفعّل على هذا المشروع بعد. تواصل مع المدير.'
                  : 'Multi-factor authentication is not enabled for this project yet. Contact your administrator.')
              : (err?.message || 'Failed to start enrollment')
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret || code.trim().length !== 6) return;
    setVerifying(true);
    setError('');
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
      await multiFactor(user).enroll(assertion, isAr ? 'تطبيق المصادقة' : 'Authenticator app');
      onEnrolled();
    } catch (err: any) {
      console.error('MFA enrollment verify error:', err);
      setError(
        err?.code === 'auth/invalid-verification-code'
          ? (isAr ? 'الرمز غير صحيح. حاول مرة أخرى.' : 'Incorrect code. Please try again.')
          : (err?.message || 'Verification failed')
      );
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret.secretKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex items-center justify-center p-4 ${isAr ? 'font-arabic' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 flex flex-col items-center text-center animate-fade-in">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md shadow-blue-600/20">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-black text-slate-900 mb-2">
          {isAr ? 'تفعيل التحقق بخطوتين (إلزامي)' : 'Set Up Two-Factor Authentication (Required)'}
        </h1>
        <p className="text-sm text-slate-500 mb-6 font-medium">
          {isAr
            ? 'كل حساب في النظام يجب أن يفعّل تطبيق مصادقة (مثل Google Authenticator) قبل الدخول.'
            : 'Every account on this system must enroll an authenticator app before continuing.'}
        </p>

        {loading && (
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
        )}

        {!loading && error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 w-full text-left">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-rose-800">{error}</p>
          </div>
        )}

        {!loading && secret && qrDataUrl && (
          <>
            <div className="p-3 bg-white border border-slate-200 rounded-2xl mb-4">
              <img src={qrDataUrl} alt="TOTP QR code" width={200} height={200} />
            </div>

            <p className="text-xs text-slate-500 mb-2 font-bold">
              {isAr ? 'أو أدخل هذا الرمز يدويًا في التطبيق:' : 'Or enter this key manually in your app:'}
            </p>
            <button
              type="button"
              onClick={copySecret}
              className="flex items-center gap-2 mb-6 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <span className="tracking-widest">{secret.secretKey}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            <form onSubmit={verify} className="w-full space-y-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder={isAr ? 'أدخل الرمز المكون من 6 أرقام' : 'Enter 6-digit code'}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full text-center tracking-[0.5em] text-lg font-black bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-blue-500 rounded-xl p-3 outline-hidden text-slate-800 transition"
              />
              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifying
                  ? (isAr ? 'جاري التحقق...' : 'Verifying...')
                  : (isAr ? 'تفعيل وإكمال الدخول' : 'Enable & Continue')}
              </button>
            </form>
          </>
        )}

        <button
          onClick={onSignOut}
          className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-rose-600 transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          {isAr ? 'تسجيل الخروج' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
}
