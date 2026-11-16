import { useEffect } from 'react';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { homeHref } from '@/lib/checkout';

/** Safe destination for old checkout links. No payment requests or verification. */
export default function PaymentDeferred() {
  useTheme();
  useEffect(() => {
    const previous = document.title;
    document.title = 'الدفع مؤجّل | كاشف';
    return () => { document.title = previous; };
  }, []);
  return (
    <main dir="rtl" lang="ar" className="grain flex min-h-[100dvh] items-center justify-center bg-background px-5 py-16 text-foreground">
      <section className="w-full max-w-lg rounded-3xl border border-card-border bg-card p-7 shadow-sm sm:p-10" aria-labelledby="payment-deferred-title" data-testid="page-payment-deferred">
        <a href={homeHref()} className="font-display text-2xl text-primary">كاشف</a>
        <ShoppingBag className="mt-8 h-9 w-9 text-primary" aria-hidden />
        <h1 id="payment-deferred-title" className="mt-4 font-display text-3xl text-primary">الدفع مؤجّل حاليًا</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">يمكنك متابعة استخدام كاشف وتصفّح الباقات وحفظ اختياراتك في السلة. هذا الرابط لا ينفّذ دفعًا ولا يؤكّد أي عملية سابقة.</p>
        <a href={homeHref('#plans')} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <ArrowRight className="h-4 w-4" aria-hidden /> العودة إلى الباقات
        </a>
      </section>
    </main>
  );
}
