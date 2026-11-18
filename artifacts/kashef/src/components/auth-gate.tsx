import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/components/auth-provider';
import { t } from '@/lib/i18n';

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, ensureGuestSession } = useAuth();
  const [guestError, setGuestError] = useState('');

  useEffect(() => {
    if (loading || user) return;
    let active = true;
    setGuestError('');
    void ensureGuestSession().catch((cause) => {
      if (active) setGuestError(cause instanceof Error ? cause.message : 'تعذر بدء التجربة. حاول مرة أخرى.');
    });
    return () => { active = false; };
  }, [ensureGuestSession, loading, user]);

  if (loading || !user) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-background px-5 text-foreground" aria-live="polite" data-testid="status-auth-loading">
        <div className="max-w-md text-center">
          {guestError
            ? <><p role="alert" className="text-sm leading-6 text-destructive" data-testid="status-guest-sign-in-error">{t(guestError)}</p>
              {guestError.includes('Anonymous Sign-Ins') && <p className="mt-3 text-xs leading-5 text-muted-foreground" data-testid="text-enable-anonymous-sign-ins">{t('في Supabase: Authentication ← Sign In / Providers ← Anonymous Sign-Ins ← فعّل الخيار، ثم أعد المحاولة.')}</p>}
              <button type="button" onClick={() => { setGuestError(''); void ensureGuestSession().catch((cause) => setGuestError(cause instanceof Error ? cause.message : 'تعذر بدء التجربة. حاول مرة أخرى.')); }} className="mt-4 min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground" data-testid="button-retry-guest">{t('حاول مرة أخرى')}</button>
              <Link href="/login" className="ms-3 text-sm font-semibold text-primary underline underline-offset-4" data-testid="link-guest-login">{t('تسجيل الدخول')}</Link></>
            : <p className="text-sm text-muted-foreground">{t('جارٍ بدء مساحة التجربة…')}</p>}
        </div>
      </main>
    );
  }

  return children;
}
