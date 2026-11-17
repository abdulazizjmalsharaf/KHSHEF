import { useState } from 'react';
import { useElements, useStripe, PaymentElement } from '@stripe/react-stripe-js';
import { AlertTriangle, BadgeCheck, Loader2 } from 'lucide-react';
import { useVerifyTestPayment, type PaymentIntentConfig } from '@workspace/api-client-react';
import { apiErrorMessage } from '@/lib/checkout';

type Props = { intent: PaymentIntentConfig; onBusyChange: (busy: boolean) => void };

export function StripePaymentForm({ intent, onBusyChange }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const verify = useVerifyTestPayment();
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements || submitting || complete) return;
    setSubmitting(true);
    onBusyChange(true);
    setError('');

    const validation = await elements.submit();
    if (validation.error) {
      setError(validation.error.message || 'تحقق من بيانات البطاقة ثم حاول مجددًا.');
      setSubmitting(false);
      onBusyChange(false);
      return;
    }

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message || 'تعذّر إكمال الدفع التجريبي.');
      setSubmitting(false);
      onBusyChange(false);
      return;
    }

    const paymentIntent = result.paymentIntent;
    if (!paymentIntent) {
      setError('لم تصلنا نتيجة الدفع. أعد المحاولة من فضلك.');
      setSubmitting(false);
      onBusyChange(false);
      return;
    }
    if (paymentIntent.id !== intent.paymentIntentId) {
      setError('رقم عملية الدفع لا يطابق الطلب الحالي.');
      setSubmitting(false);
      onBusyChange(false);
      return;
    }

    verify.mutate(
      { data: { paymentIntentId: paymentIntent.id } },
      {
        onSuccess: (verification) => {
          if (verification.status === 'paid') setComplete(true);
          else setError(verification.message || 'لم يكتمل الدفع التجريبي بعد.');
        },
        onError: (verifyError) => {
          setError(apiErrorMessage(verifyError, 'تعذّر التحقق من نتيجة الدفع التجريبي.'));
        },
        onSettled: () => {
          setSubmitting(false);
          onBusyChange(false);
        },
      },
    );
  };

  if (complete) {
    return (
      <div className="rounded-xl border border-emerald-600/25 bg-emerald-600/10 p-4 text-sm" role="status" data-testid="payment-success">
        <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
          <BadgeCheck className="h-5 w-5" aria-hidden />
          تم تأكيد الدفع التجريبي
        </div>
        <p className="mt-2 text-muted-foreground">لم يُخصم مبلغ حقيقي ولم يُفعّل اشتراك مدفوع.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="form-stripe-payment-element">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.06] p-3 text-sm text-destructive" data-testid="payment-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || !elements || submitting || verify.isPending}
        aria-busy={submitting || verify.isPending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-[0_10px_24px_-12px_hsl(186_62%_20%/0.8)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="button-confirm-test-payment"
      >
        {submitting || verify.isPending
          ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> جارٍ التحقق من الدفع التجريبي…</>
          : 'تأكيد الدفع التجريبي'}
      </button>
    </form>
  );
}
