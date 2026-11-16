import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, Check, FileCheck2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { WorkspaceFrame } from '@/pages/invoice-workspace';

export default function LoginPage() {
  const { user, loading, error: authError, signInWithGoogle } = useAuth();
  const [, setLocation] = useLocation();
  const [signInError, setSignInError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !loading) setLocation('/invoices');
  }, [user, loading, setLocation]);

  const signIn = async () => {
    setSignInError('');
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setSignInError(/provider.*(not enabled|disabled)|unsupported provider/i.test(message)
        ? 'تسجيل Google غير مفعّل في Supabase بعد. فعّل مزوّد Google وأضف بيانات OAuth ورابط إعادة التوجيه.'
        : message || 'تعذر بدء الدخول بحساب Google. حاول مرة أخرى.');
      setBusy(false);
    }
  };

  return (
    <WorkspaceFrame>
      <div className="mx-auto grid max-w-5xl items-center gap-8 py-4 md:grid-cols-[1fr_.88fr] md:gap-14 md:py-12">
        <section className="rise order-2 rounded-[2rem] border border-border/80 bg-card p-6 shadow-[0_22px_70px_-50px_hsl(var(--primary)/.45)] sm:p-9 md:order-1" data-testid="card-login">
          <div className="mb-7 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
            <LockKeyhole className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm font-semibold text-primary">مساحة عملك الخاصة</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-foreground sm:text-4xl" data-testid="heading-login">راجع فاتورتك،<br />قبل أن تعتمدها.</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">ادخل بحساب Google لرفع فواتير الموردين ومراجعة تفاصيلها بهدوء. ملفاتك ونتائجها لا يراها إلا حسابك.</p>

          {(authError || signInError) && <p role="alert" className="mt-5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-sm leading-6 text-destructive" data-testid="status-login-error">{signInError || authError}</p>}

          <button type="button" onClick={signIn} disabled={loading || busy} className="mt-7 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65" data-testid="button-sign-in-google">
            {busy || loading ? <span className="h-5 w-5 animate-pulse rounded-full border-2 border-primary-foreground/70 border-t-transparent" aria-hidden /> : <GoogleMark />}
            {busy ? 'جارٍ تحويلك إلى Google…' : loading ? 'جارٍ التحقق من الجلسة…' : 'المتابعة باستخدام Google'}
            {!busy && !loading && <ArrowLeft className="h-4 w-4" aria-hidden />}
          </button>

          <p className="mt-5 text-center text-xs leading-6 text-muted-foreground" data-testid="text-login-privacy">
            بالمتابعة، ستُحفظ الفواتير في مساحة خاصة بحسابك فقط.
          </p>
          <div className="mt-7 border-t border-border/70 pt-5">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-back-home">
              العودة إلى كاشف
            </Link>
          </div>
        </section>

        <aside className="order-1 md:order-2" aria-label="مزايا مكتب المراجعة">
          <div className="relative overflow-hidden rounded-[2rem] bg-primary p-7 text-primary-foreground sm:p-10">
            <div className="girih absolute inset-0 opacity-70" aria-hidden />
            <div className="relative">
              <div className="mb-8 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10"><FileCheck2 className="h-6 w-6 text-accent" aria-hidden /></span>
                <span className="text-xs text-primary-foreground/70">دفتر مراجعة الموردين</span>
              </div>
              <p className="font-display text-3xl leading-relaxed sm:text-4xl">الأرقام الواضحة<br />تمنحك قرارًا أهدأ.</p>
              <div className="mt-8 space-y-4">
                {[
                  'استخراج بيانات الفاتورة دون إدخال يدوي',
                  'تنبيه عند انخفاض الثقة في قراءة حقل',
                  'فحص الحسابات قبل اعتماد الفاتورة',
                ].map((line, index) => (
                  <p className="flex items-start gap-3 text-sm leading-6 text-primary-foreground/85" key={line} data-testid={`text-login-benefit-${index}`}>
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/20 text-accent"><Check className="h-3.5 w-3.5" aria-hidden /></span>{line}
                  </p>
                ))}
              </div>
              <div className="mt-9 flex items-center gap-2 border-t border-primary-foreground/15 pt-5 text-xs text-primary-foreground/70" data-testid="text-login-security-note">
                <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
                الملفات تبقى ضمن مساحة حسابك الخاصة
              </div>
            </div>
          </div>
        </aside>
      </div>
    </WorkspaceFrame>
  );
}

function GoogleMark() {
  return <span className="grid h-6 w-6 place-items-center rounded-full bg-card text-sm font-bold text-primary" aria-hidden>G</span>;
}
