import React from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getApp } from 'firebase/app';
import { translations, Language } from '../lib/translations';
import { Store, LogIn, ShieldAlert } from 'lucide-react';

export function Login({ language }: { language: Language }) {
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      const auth = getAuth(getApp());
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Failed to login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex items-center justify-center p-4 ${language === 'ar' ? 'font-arabic' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 flex flex-col items-center text-center animate-fade-in">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md shadow-blue-600/20">
          <Store className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-black text-slate-900 mb-2">
          {language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
        </h1>
        <p className="text-sm text-slate-500 mb-8 font-medium">
          {language === 'ar' 
            ? 'نظام تسوية العهد والمبيعات 8oz' 
            : '8oz Custody & Sales Reconciliation System'}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 w-full text-left">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-rose-800">{error}</p>
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-blue-600 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold py-3.5 px-6 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          <span>
            {language === 'ar' ? 'المتابعة بحساب جوجل' : 'Continue with Google'}
          </span>
        </button>
      </div>
    </div>
  );
}
