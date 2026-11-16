import { CircleSlash } from 'lucide-react';
import { CheckoutShell, btnGhost, btnPrimary } from '@/components/checkout-shell';
import { homeHref } from '@/lib/checkout';

export default function CheckoutCancel() {
  return (
    <CheckoutShell tone="warn" icon={<CircleSlash className="h-7 w-7" />} title="أُلغيت عملية الدفع التجريبي" testId="card-checkout-cancel">
      <p data-testid="text-cancel-message">رجعت من صفحة Stripe دون إتمام الدفع، لذلك لم يتم تأكيد أي عملية. هذه الصفحة لا تحدد حالة أي خصم، والتأكيد يتم فقط بعد تحقق الخادم.</p>
      <p>سلتك محفوظة كما هي على هذا الجهاز، ويمكنك المحاولة مرة أخرى متى شئت.</p>
      <div className="flex flex-wrap gap-3 pt-2">
        <a href={homeHref('#plans')} className={btnPrimary} data-testid="link-back-plans">العودة إلى الباقات والسلة</a>
        <a href={homeHref()} className={btnGhost} data-testid="link-back-home">الصفحة الرئيسية</a>
      </div>
    </CheckoutShell>
  );
}
