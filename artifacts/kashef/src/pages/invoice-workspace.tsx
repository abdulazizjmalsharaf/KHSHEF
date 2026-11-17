import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, FileCheck2, FilePlus2, Gauge, LockKeyhole, LogOut, Package, Settings2, Tags } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

export function WorkspaceFrame({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const navigation = [
    { href: '/app', label: 'الرئيسية', test: 'dashboard', Icon: Gauge },
    { href: '/invoices/new', label: 'فاتورة جديدة', test: 'new-invoice', Icon: FilePlus2 },
    { href: '/invoices', label: 'الفواتير', test: 'invoices', Icon: FileCheck2 },
    { href: '/suppliers', label: 'الموردون', test: 'suppliers', Icon: Package },
    { href: '/supplier-prices', label: 'أسعار الموردين', test: 'supplier-prices', Icon: Tags },
    { href: '/settings', label: 'الإعدادات', test: 'settings', Icon: Settings2 },
  ];
  const isActive = (href: string) =>
    location === href ||
    (href === '/invoices' && location.startsWith('/invoices/') && location !== '/invoices/new');

  const renderNavigation = (variant: 'desktop' | 'mobile') => (
    <nav
      aria-label={variant === 'desktop' ? 'التنقل الرئيسي في مساحة كاشف' : 'التنقل السفلي في مساحة كاشف'}
      className={variant === 'desktop'
        ? 'flex flex-col gap-1'
        : 'grid grid-cols-6 gap-0.5'}
    >
      {navigation.map(({ href, label, test, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            className={variant === 'desktop'
              ? `group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${active ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/70 hover:text-primary'}`
              : `flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-center text-[9px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/70 hover:text-primary'}`}
            data-testid={`link-workspace-${test}`}
          >
            <Icon className={variant === 'desktop' ? 'h-[18px] w-[18px] shrink-0' : 'h-[18px] w-[18px] shrink-0'} aria-hidden />
            <span className={variant === 'mobile' ? 'max-w-full' : undefined}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError('');
    try {
      await signOut();
      setLocation('/login');
    } catch {
      setSignOutError('تعذّر تسجيل الخروج. حاول مرة أخرى.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div dir="rtl" lang="ar" className="grain min-h-[100dvh] overflow-x-clip bg-background text-foreground">
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-64 flex-col border-l border-border/80 bg-card px-4 py-6 md:flex" aria-label="قائمة مساحة العمل">
        <Link href="/app" className="group inline-flex items-center gap-3 self-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-kashef-logo">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary font-display text-2xl text-accent shadow-sm" aria-hidden>ك</span>
          <span>
            <span className="block font-display text-xl leading-tight text-primary">كاشف</span>
            <span className="block text-[11px] text-muted-foreground">مكتب مراجعة الفواتير</span>
          </span>
        </Link>
        <div className="my-6 h-px bg-border/80" />
        {renderNavigation('desktop')}
        <div className="mt-auto space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/15 bg-background px-3 py-3 text-xs leading-5 text-muted-foreground" data-testid="text-private-workspace">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>بيانات خاصة بحسابك</span>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              aria-label={signingOut ? 'جارٍ تسجيل الخروج' : 'تسجيل الخروج'}
              className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
              data-testid="button-sign-out"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span>{signingOut ? 'جارٍ الخروج…' : 'تسجيل الخروج'}</span>
            </button>
          )}
          {signOutError && <p role="alert" className="text-xs leading-5 text-destructive" data-testid="status-sign-out-error">{signOutError}</p>}
        </div>
      </aside>

      <header className="border-b border-border/80 bg-card/75 px-3 py-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="group inline-flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-kashef-logo-mobile">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary font-display text-2xl text-accent shadow-sm" aria-hidden>ك</span>
            <span>
              <span className="block font-display text-xl leading-tight text-primary">كاشف</span>
              <span className="block text-[11px] text-muted-foreground">مكتب مراجعة الفواتير</span>
            </span>
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-primary/15 bg-background px-3 py-2 text-xs text-muted-foreground min-[360px]:flex" data-testid="text-private-workspace-mobile">
            <LockKeyhole className="h-3.5 w-3.5 text-primary" aria-hidden />
            بيانات خاصة بحسابك
          </div>
          {user && (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              aria-label={signingOut ? 'جارٍ تسجيل الخروج' : 'تسجيل الخروج'}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
              data-testid="button-sign-out-mobile"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden min-[420px]:inline">{signingOut ? 'جارٍ الخروج…' : 'تسجيل الخروج'}</span>
            </button>
          )}
        </div>
        {signOutError && <p role="alert" className="px-1 pt-2 text-xs text-destructive" data-testid="status-sign-out-error-mobile">{signOutError}</p>}
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-7 sm:px-7 sm:pt-10 md:mr-64 md:w-[calc(100%-16rem)] md:pb-10">
        {children}
      </main>
      <footer className="mx-auto flex max-w-7xl items-center justify-between gap-3 border-t border-border/70 px-4 py-5 text-xs text-muted-foreground md:mr-64 md:w-[calc(100%-16rem)] sm:px-7" data-testid="footer-workspace">
        <span className="inline-flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-primary" aria-hidden /> مراجعة واضحة قبل اعتماد الدفع</span>
        <span>كاشف · الكويت</span>
      </footer>
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/90 bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_-18px_hsl(var(--foreground)/.35)] backdrop-blur md:hidden">
        {renderNavigation('mobile')}
      </div>
    </div>
  );
}

export function PageIntro({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-end">
      <div className="rise">
        <p className="mb-2 text-xs font-semibold tracking-wide text-primary/75">{eyebrow}</p>
        <h1 className="font-display text-3xl leading-tight text-primary sm:text-4xl" data-testid="heading-page-title">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PrimaryLink({ href, children, testId }: { href: string; children: ReactNode; testId: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_-12px_hsl(var(--primary)/.65)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" data-testid={testId}>
      {children}<ArrowLeft className="h-4 w-4" aria-hidden />
    </Link>
  );
}

export function QueryProblem({ message, onRetry, testId = 'status-query-error' }: { message: string; onRetry: () => void; testId?: string }) {
  return (
    <section className="rounded-2xl border border-destructive/25 bg-destructive/[0.045] p-6 text-right" role="alert" data-testid={testId}>
      <h2 className="font-display text-xl text-destructive">تعذّر تحميل البيانات</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 min-h-10 rounded-lg border border-destructive/25 bg-card px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-retry-load">إعادة المحاولة</button>
    </section>
  );
}
