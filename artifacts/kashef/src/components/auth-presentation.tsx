import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, CheckCircle2, FileCheck2, ShieldCheck } from 'lucide-react';

export type AuthMethods = {
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (businessName: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
};

export function AuthFrame({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  children: ReactNode;
}) {
  return (
    <div dir="rtl" lang="ar" className="grain min-h-[100dvh] overflow-x-clip bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-7">
        <Link href="/" className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-auth-logo">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary font-display text-2xl text-accent">ك</span>
          <span><span className="block font-display text-xl leading-tight text-primary">كاشف</span><span className="block text-[11px] text-muted-foreground">مكتب مراجعة الفواتير</span></span>
        </Link>
        <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-auth-home">الصفحة الرئيسية <ArrowLeft className="h-4 w-4" aria-hidden /></Link>
      </header>
      <main className="mx-auto grid w-full max-w-6xl items-start gap-7 px-4 pb-8 pt-3 sm:px-7 md:grid-cols-[minmax(0,1fr)_minmax(300px,.82fr)] md:items-center md:gap-14 md:py-12">
        <section className="rise order-1 rounded-[2rem] border border-border/80 bg-card p-6 shadow-[0_22px_70px_-50px_hsl(var(--primary)/.45)] sm:p-9" data-testid="card-auth-form">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary"><FileCheck2 className="h-5 w-5" aria-hidden /></div>
          <p className="text-sm font-semibold text-primary">{eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-foreground sm:text-4xl" data-testid="heading-auth">{title}</h1>
          <p className="mb-7 mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
          {children}
        </section>
        <aside className="order-2" aria-label="مزايا كاشف">
          <div className="relative overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground sm:p-9">
            <div className="girih absolute inset-0 opacity-70" aria-hidden />
            <div className="relative">
              <div className="mb-7 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10"><ShieldCheck className="h-5 w-5 text-accent" aria-hidden /></span><span className="text-xs text-primary-foreground/75">دفتر مراجعة الموردين</span></div>
              <p className="font-display text-3xl leading-relaxed sm:text-4xl">الأرقام الواضحة<br />تمنحك قرارًا أهدأ.</p>
              <p className="mt-4 max-w-sm text-sm leading-7 text-primary-foreground/80">راجع تفاصيل الفاتورة قبل الدفع، واعرف ما يحتاج انتباهك دون أن تغادر مساحة عملك.</p>
              <div className="mt-7 space-y-3">
                {['استخراج بيانات الفاتورة دون إدخال يدوي', 'تنبيه عند انخفاض الثقة في قراءة حقل', 'فحص الحسابات قبل اعتماد الفاتورة'].map((line) => <p key={line} className="flex items-start gap-3 text-sm leading-6 text-primary-foreground/85"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden />{line}</p>)}
              </div>
              <div className="mt-8 border-t border-primary-foreground/15 pt-4 text-xs text-primary-foreground/70">الملفات تبقى ضمن مساحة حسابك الخاصة</div>
            </div>
          </div>
        </aside>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/70 px-4 py-5 text-xs text-muted-foreground sm:px-7"><span>مراجعة واضحة قبل اعتماد الدفع</span><span>كاشف · الكويت</span></footer>
    </div>
  );
}

export function AuthField({ id, label, type, value, onChange, autoComplete, placeholder, icon }: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder: string;
  icon?: ReactNode;
}) {
  return <div>
    <label htmlFor={id} className="mb-2 block text-sm font-semibold text-foreground">{label}</label>
    <div className="relative">
      <input id={id} data-testid={`input-${id}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} dir={type === 'email' || type === 'password' ? 'ltr' : 'auto'} className={`min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 ${icon ? 'pr-11' : ''} ${type === 'email' || type === 'password' ? 'text-left' : ''}`} />
      {icon && <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-muted-foreground">{icon}</span>}
    </div>
  </div>;
}

export function AuthMessage({ children, kind, testId }: { children: ReactNode; kind: 'error' | 'success' | 'info'; testId: string }) {
  const styles = kind === 'error' ? 'border-destructive/25 bg-destructive/[0.06] text-destructive' : kind === 'success' ? 'border-primary/20 bg-secondary/70 text-primary' : 'border-accent/30 bg-accent/10 text-foreground';
  return <p role={kind === 'error' ? 'alert' : 'status'} aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm leading-6 ${styles}`} data-testid={testId}>{children}</p>;
}

export function AuthSubmit({ pending, children, testId }: { pending: boolean; children: ReactNode; testId: string }) {
  return <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65" data-testid={testId}>{pending && <span className="h-4 w-4 animate-pulse rounded-full border-2 border-primary-foreground/70 border-t-transparent" aria-hidden />}{children}</button>;
}

export function GoogleMark() {
  return <span className="grid h-6 w-6 place-items-center rounded-full bg-card text-sm font-bold text-primary" aria-hidden>G</span>;
}
