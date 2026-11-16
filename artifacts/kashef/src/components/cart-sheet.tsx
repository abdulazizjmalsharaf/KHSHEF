import { Info, ShoppingBag, Trash2, X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Plan, PlanId } from '@/data/plans';
import { formatFils } from '@/lib/money';

type Props = { open: boolean; onOpenChange: (o: boolean) => void; items: Plan[]; totalFils: number; onRemove: (id: PlanId) => void; onClear: () => void };

export function CartSheet({ open, onOpenChange, items, totalFils, onRemove, onClear }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" dir="rtl" className="flex w-full flex-col gap-0 border-card-border bg-background p-0 text-right sm:max-w-md [&>button:last-child]:hidden" data-testid="sheet-cart">
        <SheetHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-border p-5 text-right">
          <div>
            <SheetTitle className="font-display text-2xl text-primary">السلة التجريبية</SheetTitle>
            <SheetDescription className="mt-1">معاينة لاختيار الباقات فقط.</SheetDescription>
          </div>
          <SheetClose className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="إغلاق السلة" data-testid="button-close-cart">
            <X className="h-5 w-5" aria-hidden />
          </SheetClose>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center" data-testid="empty-cart">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-primary"><ShoppingBag className="h-7 w-7" aria-hidden /></span>
              <p className="mt-4 font-display text-xl text-primary">السلة فارغة</p>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">اختر باقة من قسم الباقات لمعاينتها هنا.</p>
              <SheetClose asChild>
                <a href="#plans" className="mt-6 inline-flex h-11 items-center rounded-xl border border-input px-5 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-cart-browse-plans">تصفّح الباقات</a>
              </SheetClose>
            </div>
          ) : (
            <ul className="space-y-3" aria-label="الباقات المختارة">
              {items.map((p) => (
                <li key={p.id} className="slide-in flex items-center justify-between gap-3 rounded-2xl border border-card-border bg-card p-4" data-testid={`row-cart-${p.id}`}>
                  <div>
                    <p className="font-display text-lg text-primary">{p.name}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">{formatFils(p.priceFils)} / شهريًا</p>
                  </div>
                  <button type="button" onClick={() => onRemove(p.id)} aria-label={`إزالة باقة «${p.name}» من السلة`} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`button-remove-${p.id}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4 border-t border-border bg-card/60 p-5">
          {items.length > 0 && (
            <>
              <div className="flex items-baseline justify-between" aria-live="polite">
                <span className="text-muted-foreground">المجموع الشهري</span>
                <span className="font-display text-2xl tabular-nums text-foreground" data-testid="text-cart-total">{formatFils(totalFils)}</span>
              </div>
              {items.length > 1 && (
                <p className="text-xs leading-relaxed text-muted-foreground" data-testid="text-cart-multi-notice">اختيار أكثر من باقة متاح هنا لأنها سلة تجريبية. قواعد الاشتراك النهائية ستُؤكَّد لاحقًا عند الربط مع Stripe.</p>
              )}
            </>
          )}
          <div role="note" className="flex gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm leading-relaxed" data-testid="text-checkout-disabled">
            <Info className="h-5 w-5 shrink-0 text-[hsl(30_80%_38%)] dark:text-accent" aria-hidden />
            <p>الدفع غير مفعّل بعد. سيُتاح بعد ربط Stripe في وضع الاختبار، ولن يُطلب منك أي دفع الآن.</p>
          </div>
          {items.length > 0 && (
            <button type="button" onClick={onClear} className="h-11 w-full rounded-xl border border-input font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-clear-cart">إفراغ السلة</button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
