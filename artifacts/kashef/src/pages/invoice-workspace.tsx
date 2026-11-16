import { type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, FileCheck2, LockKeyhole } from 'lucide-react';

export function WorkspaceFrame({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" lang="ar" className="grain min-h-[100dvh] overflow-x-clip bg-background text-foreground">
      <header className="border-b border-border/80 bg-card/75">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-7">
          <Link href="/invoices" className="group inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-kashef-logo">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary font-display text-2xl text-accent shadow-sm" aria-hidden>ك</span>
            <span>
              <span className="block font-display text-xl leading-tight text-primary">كاشف</span>
              <span className="block text-[11px] text-muted-foreground">مكتب مراجعة الفواتير</span>
            </span>
          </Link>
          <nav aria-label="التنقل في مساحة كاشف" className="flex items-center gap-1 sm:gap-2">
            <Link href="/invoices" className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm" data-testid="link-workspace-invoices">الفواتير</Link>
            <Link href="/supplier-prices" className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm" data-testid="link-workspace-supplier-prices">أسعار الموردين</Link>
          </nav>
          <div className="hidden items-center gap-2 rounded-full border border-primary/15 bg-background px-3 py-2 text-xs text-muted-foreground lg:flex" data-testid="text-private-workspace">
            <LockKeyhole className="h-3.5 w-3.5 text-primary" aria-hidden />
            بيانات خاصة بحسابك
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-7 sm:py-10">
        {children}
      </main>
      <footer className="mx-auto flex max-w-7xl items-center justify-between gap-3 border-t border-border/70 px-4 py-5 text-xs text-muted-foreground sm:px-7" data-testid="footer-workspace">
        <span className="inline-flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-primary" aria-hidden /> مراجعة واضحة قبل اعتماد الدفع</span>
        <span>كاشف · الكويت</span>
      </footer>
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
