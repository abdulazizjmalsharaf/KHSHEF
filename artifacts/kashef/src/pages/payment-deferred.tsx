import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { homeHref } from '@/lib/checkout';
import { t, useLanguage } from '@/lib/i18n';

/** Safe destination for old checkout links. No payment requests or verification. */
export default function PaymentDeferred() {
  useTheme();
  const { language } = useLanguage();
  const BackArrow = language === 'ar' ? ArrowRight : ArrowLeft;
  useEffect(() => {
    const previous = document.title;
    document.title = `${t('الدفع مؤجّل حاليًا')} | ${t('كاشف')}`;
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-background px-5 py-16 text-foreground">
      <section className="w-full max-w-lg rounded-3xl border border-card-border bg-card p-7 shadow-sm sm:p-10" aria-labelledby="payment-deferred-title" data-testid="page-payment-deferred">
        <a href={homeHref()} className="font-display text-2xl text-primary">{t('كاشف')}</a>
        <ShoppingBag className="mt-8 h-9 w-9 text-primary" aria-hidden />
        <h1 id="payment-deferred-title" className="mt-4 font-display text-3xl text-primary">{t('الدفع مؤجّل حاليًا')}</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">{t('يمكنك متابعة استخدام كاشف وتصفّح الباقات وحفظ اختياراتك في السلة. هذا الرابط لا ينفّذ دفعًا ولا يؤكّد أي عملية سابقة.')}</p>
        <a href={homeHref('#plans')} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <BackArrow className="h-4 w-4" aria-hidden /> {t('العودة إلى الباقات')}
        </a>
      </section>
    </main>
  );
}
