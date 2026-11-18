import { useEffect, useMemo, useRef, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { AlertTriangle, CreditCard, FlaskConical, Loader2, RotateCw } from 'lucide-react';
import {
  getGetStripeTestStatusQueryKey,
  useCreateTestPaymentIntent,
  useGetStripeTestStatus,
  type PaymentIntentConfig,
} from '@workspace/api-client-react';
import type { PlanId } from '@/data/plans';
import { formatFils } from '@/lib/money';
import { apiErrorMessage, newRequestId } from '@/lib/checkout';
import { StripePaymentForm } from '@/components/stripe-payment-form';
import { getLanguage, t } from '@/lib/i18n';

type Props = { open: boolean; ids: PlanId[]; onBusyChange: (busy: boolean) => void };

export function TestCheckoutPanel({ open, ids, onBusyChange }: Props) {
  const status = useGetStripeTestStatus({
    query: {
      queryKey: getGetStripeTestStatusQueryKey(),
      enabled: open,
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
    },
  });
  const createIntent = useCreateTestPaymentIntent();
  const [intent, setIntent] = useState<PaymentIntentConfig | null>(null);
  const [error, setError] = useState('');
  const request = useRef<{ key: string; id: string } | null>(null);
  const cartKey = ids.join(',');
  const busy = createIntent.isPending;
  const busyRef = useRef(onBusyChange);
  busyRef.current = onBusyChange;
  useEffect(() => { busyRef.current(busy); }, [busy]);

  useEffect(() => {
    setIntent(null);
    setError('');
    request.current = null;
  }, [cartKey]);

  const stripePromise = useMemo(
    () => status.data?.publishableKey ? loadStripe(status.data.publishableKey) : null,
    [status.data?.publishableKey],
  );

  const ready = status.data?.ready === true && Boolean(status.data.publishableKey);
  const start = () => {
    if (!ready || !ids.length || busy) return;
    setError('');
    if (!request.current || request.current.key !== cartKey) {
      request.current = { key: cartKey, id: newRequestId() };
    }
    createIntent.mutate(
      { data: { planIds: ids, requestId: request.current.id } },
      {
        onSuccess: (result) => setIntent(result),
        onError: (mutationError) => {
          setError(t(apiErrorMessage(mutationError, 'تعذّر تجهيز نموذج الدفع التجريبي.')));
        },
      },
    );
  };

  return (
    <div className="space-y-3" data-testid="panel-test-checkout">
      <div role="note" className="flex gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm leading-relaxed" data-testid="text-checkout-test-notice">
        <FlaskConical className="h-5 w-5 shrink-0 text-[hsl(30_80%_38%)] dark:text-accent" aria-hidden />
        <p>{t('وضع اختبار فقط: لا تُخصم أي مبالغ حقيقية ولا يُفعّل أي حساب مدفوع.')}</p>
      </div>
      <p className="rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground" data-testid="text-test-card">
        Test mode: use card 4242 4242 4242 4242
      </p>

      <div aria-live="polite" data-testid="status-stripe-readiness">
        {status.isLoading || status.isFetching ? (
          <div className="h-10 animate-pulse rounded-xl bg-muted" aria-label={t('جارٍ التحقق من جاهزية الدفع التجريبي')} />
        ) : !ready ? (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.06] p-3 text-sm leading-relaxed">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <div className="flex-1">
              <p>{t(status.data?.message || (status.isError ? apiErrorMessage(status.error, 'الدفع التجريبي غير متاح حاليًا لأن إعداداته غير مكتملة.') : 'الدفع التجريبي غير متاح حاليًا.'))}</p>
              <button
                type="button"
                onClick={() => status.refetch()}
                disabled={status.isFetching || busy}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                data-testid="button-recheck-stripe"
              >
                <RotateCw className={`h-4 w-4 ${status.isFetching ? 'animate-spin' : ''}`} aria-hidden />
                {t('إعادة التحقق')}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t(status.data?.message || 'الدفع التجريبي جاهز.')}</p>
        )}
      </div>

      {ready && status.data?.checkoutCurrency === 'usd' && (
        <p className="text-xs leading-relaxed text-muted-foreground" data-testid="text-demo-exchange-rate">
          {t('يظهر المبلغ بالدينار الكويتي، ويُحسب سعر التحويل عند بدء التجربة.')}
          {status.data.exchangeRateUpdatedAt && (
            <> {t('آخر تحديث:')} <time dateTime={status.data.exchangeRateUpdatedAt}>{new Date(status.data.exchangeRateUpdatedAt).toLocaleString(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW', { dateStyle: 'medium', timeStyle: 'short' })}</time>.</>
          )}{' '}
          {t('المصدر:')} <a className="underline underline-offset-2 hover:text-primary" href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">ExchangeRate-API</a>.
        </p>
      )}

      {intent ? (
        <>
          <div className="rounded-xl border border-card-border bg-card p-3 text-sm" data-testid="text-payment-amount">
            {t('المبلغ التجريبي:')} <strong className="tabular-nums">{formatFils(intent.amountKwdFils)}</strong>
          </div>
          {stripePromise && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: intent.clientSecret,
                appearance: { theme: 'stripe', variables: { colorPrimary: '#155e63', borderRadius: '12px' } },
              }}
            >
              <StripePaymentForm intent={intent} onBusyChange={(next) => busyRef.current(next)} />
            </Elements>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={!ready || ids.length === 0 || busy || status.isFetching}
          aria-busy={busy}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-[0_10px_24px_-12px_hsl(186_62%_20%/0.8)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="button-open-payment-element"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <CreditCard className="h-5 w-5" aria-hidden />}
          {busy ? t('جارٍ تجهيز الدفع التجريبي…') : error ? t('إعادة المحاولة') : t('إظهار نموذج الدفع')}
        </button>
      )}

      {error && <p role="alert" className="text-sm text-destructive" data-testid="status-checkout-error">{t(error)}</p>}
    </div>
  );
}
