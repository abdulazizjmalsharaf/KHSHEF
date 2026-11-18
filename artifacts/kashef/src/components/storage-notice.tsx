import { AlertTriangle } from 'lucide-react';

import { t } from '@/lib/i18n';

export function StorageNotice() {
  return (
    <div role="status" className="mx-auto mt-4 flex max-w-6xl items-start gap-3 rounded-xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm leading-relaxed" data-testid="status-storage-unavailable">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(30_80%_38%)] dark:text-accent" aria-hidden />
      <p>{t('تعذّر حفظ تفضيلاتك في هذا المتصفح (قد يكون التخزين المحلي معطّلًا أو في وضع التصفح الخاص). ستعمل الصفحة عاديًا، لكن الوضع والمفضلة والسلة لن تُحفظ بعد إغلاقها.')}</p>
    </div>
  );
}
