import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Clock, Loader2, RotateCw, ShieldAlert, TimerOff } from 'lucide-react';
import { useVerifyTestCheckout, type CheckoutVerification } from '@workspace/api-client-react';
import { CheckoutShell, btnGhost, btnPrimary } from '@/components/checkout-shell';
import { useCart } from '@/hooks/use-cart';
import { getPlan, isPlanId } from '@/data/plans';
import { SESSION_RE, apiErrorMessage, homeHref } from '@/lib/checkout';

function readSessionId(): string | null {
  const raw = new URLSearchParams(window.location.search).get('session_id');
  return raw && raw.length <= 255 && SESSION_RE.test(raw) ? raw : null;
}

export default function CheckoutReturn() {
  const [sessionId] = useState(readSessionId);
  const verify = useVerifyTestCheckout();
  const cart = useCart();
  const [result, setResult] = useState<CheckoutVerification | null>(null);
  const [error, setError] = useState('');
  const started = useRef(false);
  const removed = useRef(false);
  const mutateRef = useRef(verify.mutate);
  mutateRef.current = verify.mutate;
  const removeRef = useRef(cart.remove);
  removeRef.current = cart.remove;

  const run = useCallback(() => {
    if (!sessionId) return;
    setError('');
    mutateRef.current(
      { data: { sessionId } },
      {
        onSuccess: (r) => {
          setResult(r);
          if (r.status === 'paid' && !removed.current) {
            removed.current = true;
            r.planIds.filter(isPlanId).forEach((id) => removeRef.current(id));
          }
        },
        onError: (e) => setError(apiErrorMessage(e, 'تعذّر التحقق من حالة الدفع التجريبي. حاول مجددًا.')),
      },
    );
  }, [sessionId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Keep Stripe's test session id in the return URL so refresh can verify again.
    // Ownership is still checked with the HttpOnly proof; the id alone grants nothing.
    run();
  }, [run]);

  const actions = (retry: boolean) => (
    <div className="flex flex-wrap gap-3 pt-2">
      {retry && (
        <button type="button" onClick={run} disabled={verify.isPending} className={btnPrimary} data-testid="button-retry-verify">
          <RotateCw className={`h-4 w-4 ${verify.isPending ? 'animate-spin' : ''}`} aria-hidden /> إعادة التحقق
        </button>
      )}
      <a href={homeHref('#plans')} className={retry ? btnGhost : btnPrimary} data-testid="link-back-plans">العودة إلى الباقات</a>
    </div>
  );

  if (!sessionId) {
    return (
      <CheckoutShell tone="bad" icon={<ShieldAlert className="h-7 w-7" />} title="لا يمكن التحقق من هذه العودة" testId="card-checkout-invalid">
        <p>الرابط لا يحتوي على معرّف جلسة اختبار صالح، لذلك لم يتم تأكيد أي دفع. سلتك لم تتغير.</p>
        {actions(false)}
      </CheckoutShell>
    );
  }

  if (verify.isPending && !result) {
    return (
      <CheckoutShell tone="idle" icon={<Loader2 className="h-7 w-7 animate-spin" />} title="نتحقق من الدفع التجريبي…" testId="card-checkout-verifying">
        <p role="status">نسأل الخادم عن حالة الجلسة لدى Stripe. لا نعتمد على الرابط وحده.</p>
        <div className="space-y-2" aria-hidden><div className="h-3 w-3/4 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /></div>
      </CheckoutShell>
    );
  }

  if (error || !result) {
    return (
      <CheckoutShell tone="bad" icon={<ShieldAlert className="h-7 w-7" />} title="تعذّر التحقق" testId="card-checkout-error">
        <p role="alert" data-testid="text-verify-error">{error || 'لم يكتمل التحقق بعد.'}</p>
        <p>لم يتم تأكيد أي دفع، وسلتك كما هي.</p>
        {actions(true)}
      </CheckoutShell>
    );
  }

  if (result.status === 'paid') {
    const names = result.planIds.filter(isPlanId).map((id) => getPlan(id).name);
    return (
      <CheckoutShell tone="ok" icon={<BadgeCheck className="h-7 w-7" />} title="تم تأكيد الدفع التجريبي" testId="card-checkout-paid">
        <p role="status" data-testid="text-verify-message">{result.message}</p>
        {names.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="الباقات المؤكدة">
            {names.map((n) => <li key={n} className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-primary">{n}</li>)}
          </ul>
        )}
        <p className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm text-foreground">هذه عملية اختبار: لم تُخصم أي مبالغ حقيقية، ولم يُفعَّل أي اشتراك أو وصول مدفوع. أُزيلت الباقات المؤكدة فقط من سلتك.</p>
        {actions(false)}
      </CheckoutShell>
    );
  }

  const expired = result.status === 'expired';
  return (
    <CheckoutShell tone="warn" icon={expired ? <TimerOff className="h-7 w-7" /> : <Clock className="h-7 w-7" />} title={expired ? 'انتهت صلاحية جلسة الدفع' : 'الدفع التجريبي قيد المعالجة'} testId={`card-checkout-${result.status}`}>
      <p role="status" data-testid="text-verify-message">{result.message}</p>
      <p>لم يتم تأكيد الدفع، وسلتك محفوظة كما هي.{expired ? ' يمكنك بدء عملية جديدة من السلة.' : ''}</p>
      {actions(!expired)}
    </CheckoutShell>
  );
}
