import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CreditCard, FlaskConical, Loader2, RotateCw } from 'lucide-react';
import { getGetStripeTestStatusQueryKey, useCreateTestCheckout, useGetStripeTestStatus } from '@workspace/api-client-react';
import type { PlanId } from '@/data/plans';
import { apiErrorMessage, isSafeStripeUrl, newRequestId } from '@/lib/checkout';

type Props = { open: boolean; ids: PlanId[]; onBusyChange: (busy: boolean) => void };

export function TestCheckoutPanel({ open, ids, onBusyChange }: Props) {
  const status = useGetStripeTestStatus({
    query: { queryKey: getGetStripeTestStatusQueryKey(), enabled: open, retry: false, staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchInterval: false },
  });
  const create = useCreateTestCheckout();
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const req = useRef<{ key: string; id: string } | null>(null);
  const key = ids.join(',');

  useEffect(() => {
    if (req.current && req.current.key !== key) req.current = null;
    setError('');
  }, [key]);

  const busy = create.isPending || redirecting;
  const busyRef = useRef(onBusyChange);
  busyRef.current = onBusyChange;
  useEffect(() => { busyRef.current(busy); }, [busy]);

  const ready = status.data?.ready === true;
  const canPay = ready && ids.length > 0 && !busy && !status.isFetching;

  const start = () => {
    if (!canPay) return;
    setError('');
    if (!req.current || req.current.key !== key) req.current = { key, id: newRequestId() };
    create.mutate(
      { data: { planIds: ids, requestId: req.current.id } },
      {
        onSuccess: (res) => {
          if (!isSafeStripeUrl(res?.url)) {
            setError('رابط الدفع المستلم غير موثوق، لذلك لم يتم التحويل.');
            return;
          }
          setRedirecting(true);
          window.location.assign(res.url);
        },
        onError: (err) => setError(apiErrorMessage(err, 'تعذّر بدء الدفع التجريبي. تحقق من الاتصال ثم حاول مجددًا.')),
      },
    );
  };

  return (
    <div className="space-y-3" data-testid="panel-test-checkout">
      <div role="note" className="flex gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm leading-relaxed" data-testid="text-checkout-test-notice">
        <FlaskConical className="h-5 w-5 shrink-0 text-[hsl(30_80%_38%)] dark:text-accent" aria-hidden />
        <p>وضع اختبار فقط: لا تُخصم أي مبالغ حقيقية. هذه محاكاة اشتراك، ولا تُفعّل أي حساب مدفوع.</p>
      </div>

      <div aria-live="polite" data-testid="status-stripe-readiness">
        {status.isLoading || (status.isFetching && !status.data) ? (
          <div className="h-10 animate-pulse rounded-xl bg-muted" aria-label="جارٍ التحقق من جاهزية الدفع التجريبي" />
        ) : !ready ? (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.06] p-3 text-sm leading-relaxed">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <div className="flex-1">
              <p>{status.data?.message || (status.isError ? apiErrorMessage(status.error, 'الدفع التجريبي غير متاح حاليًا لأن إعداد Stripe غير مكتمل.') : 'الدفع التجريبي غير متاح حاليًا.')}</p>
              <button type="button" onClick={() => status.refetch()} disabled={status.isFetching || busy} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" data-testid="button-recheck-stripe">
                <RotateCw className={`h-4 w-4 ${status.isFetching ? 'animate-spin' : ''}`} aria-hidden /> إعادة التحقق
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{status.data?.message || 'الدفع التجريبي جاهز.'}</p>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-destructive" data-testid="status-checkout-error">{error}</p>}

      <button type="button" onClick={start} disabled={!canPay} aria-busy={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-[0_10px_24px_-12px_hsl(186_62%_20%/0.8)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-stripe-test-checkout">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <CreditCard className="h-5 w-5" aria-hidden />}
        {busy ? 'جارٍ تحويلك إلى Stripe…' : error ? 'إعادة المحاولة' : 'الدفع التجريبي عبر Stripe'}
      </button>
    </div>
  );
}
