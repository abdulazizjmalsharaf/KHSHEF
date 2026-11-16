import { Check, Info, Plus } from 'lucide-react';
import { PLANS, type PlanId } from '@/data/plans';
import { formatFils } from '@/lib/money';

export function PlansSection({ has, onAdd }: { has: (id: PlanId) => boolean; onAdd: (id: PlanId) => void }) {
  return (
    <section id="plans" aria-labelledby="plans-title" className="border-y border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          <h2 id="plans-title" className="font-display text-4xl text-primary">الباقات الشهرية</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">أسعار مبدئية معتمدة بالدينار الكويتي. تفاصيل كل باقة وحدودها ستُعلن عند تفعيل الاشتراكات.</p>
        </div>
        <div role="note" className="mt-6 flex max-w-2xl gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm leading-relaxed" data-testid="text-plans-notice">
          <Info className="h-5 w-5 shrink-0 text-[hsl(30_80%_38%)] dark:text-accent" aria-hidden />
          <p>الدفع متاح في وضع اختبار Stripe فقط عند جاهزية الإعداد: لا تُخصم مبالغ حقيقية ولا يُفعَّل اشتراك مدفوع.</p>
        </div>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map((p, i) => {
            const added = has(p.id);
            return (
              <li key={p.id} className={`rise relative flex flex-col rounded-3xl border bg-card p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-30px_hsl(186_62%_20%/0.6)] ${i === 1 ? 'border-primary/50 md:-translate-y-3 md:hover:-translate-y-4' : 'border-card-border'}`} style={{ animationDelay: `${i * 80}ms` }} data-testid={`card-plan-${p.id}`}>
                <h3 className="font-display text-2xl text-primary">{p.name}</h3>
                <p className="mt-2 min-h-12 text-sm leading-relaxed text-muted-foreground">{p.audience}</p>
                <p className="mt-6 flex items-baseline gap-2">
                  <span className="font-display text-4xl text-foreground tabular-nums" data-testid={`text-plan-price-${p.id}`}>{formatFils(p.priceFils)}</span>
                  <span className="text-sm text-muted-foreground">/ شهريًا</span>
                </p>
                <button
                  type="button"
                  onClick={() => onAdd(p.id)}
                  className={`mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${added ? 'border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15' : 'bg-primary text-primary-foreground hover:-translate-y-0.5'}`}
                  data-testid={`button-add-plan-${p.id}`}
                >
                  {added ? <><Check className="h-5 w-5" aria-hidden /> في السلة، عرض السلة</> : <><Plus className="h-5 w-5" aria-hidden /> أضف إلى السلة</>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
