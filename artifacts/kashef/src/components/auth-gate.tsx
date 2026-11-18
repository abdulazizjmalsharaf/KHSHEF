import type { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/components/auth-provider';
import { t } from '@/lib/i18n';

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main
        className="grid min-h-[100dvh] place-items-center bg-background px-5 text-foreground"
        aria-live="polite"
        data-testid="status-auth-loading"
      >
        <p className="text-sm text-muted-foreground">{t('جارٍ التحقق من حسابك…')}</p>
      </main>
    );
  }

  if (!user) return <Redirect to="/login" />;
  return children;
}
