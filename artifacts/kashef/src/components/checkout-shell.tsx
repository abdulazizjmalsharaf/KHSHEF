import type { ReactNode } from 'react';
import { homeHref } from '@/lib/checkout';
import { useTheme } from '@/hooks/use-theme';

export function CheckoutShell({ tone, icon, title, children, testId }: { tone: 'ok' | 'warn' | 'bad' | 'idle'; icon: ReactNode; title: string; children: ReactNode; testId: string }) {
  useTheme();
  const ring = { ok: 'bg-primary text-primary-foreground', warn: 'bg-accent/20 text-[hsl(30_80%_32%)] dark:text-accent', bad: 'bg-destructive/10 text-destructive', idle: 'bg-secondary text-primary' }[tone];
  return (
    <div dir="rtl" lang="ar" className="grain min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <a href={homeHref()} className="font-display text-2xl text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" data-testid="link-home-logo">كاشف</a>
          <span className="rounded-full border border-dashed border-accent/60 px-3 py-1 text-xs font-semibold text-[hsl(30_80%_32%)] dark:text-accent" data-testid="badge-test-mode">وضع الاختبار</span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-5 py-14 sm:py-20">
        <section className="rise rounded-3xl border border-card-border bg-card p-6 shadow-[0_30px_60px_-30px_hsl(186_62%_20%/0.35)] sm:p-9" aria-labelledby="checkout-title" data-testid={testId}>
          <span className={`pop grid h-14 w-14 place-items-center rounded-2xl ${ring}`} aria-hidden>{icon}</span>
          <h1 id="checkout-title" className="mt-5 font-display text-3xl leading-snug text-primary">{title}</h1>
          <div className="mt-4 space-y-4 leading-relaxed text-muted-foreground">{children}</div>
        </section>
        <p className="mt-6 text-center text-xs text-muted-foreground">بيئة اختبار Stripe: لا تُخصم مبالغ حقيقية ولا يُفعَّل أي اشتراك مدفوع.</p>
      </main>
    </div>
  );
}

export const btnPrimary = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 disabled:translate-y-0';
export const btnGhost = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-input px-5 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
