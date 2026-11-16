import { useState, type ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import { StorageNotice } from '@/components/storage-notice';
import { FeaturesSection } from '@/components/features-section';
import { PlansSection } from '@/components/plans-section';
import { CartSheet } from '@/components/cart-sheet';
import { InvoiceAnalysisSection } from '@/components/invoice-analysis-section';
import { useTheme } from '@/hooks/use-theme';
import { useFavorites } from '@/hooks/use-favorites';
import { useCart } from '@/hooks/use-cart';
import type { PlanId } from '@/data/plans';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ClipboardList, PackageCheck, ReceiptText, Info, Plus, ArrowDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { saveSupplier } from '@/lib/suppliers';

const schema = z.object({
  supplierName: z.string().trim().min(1, 'اكتب اسم المورد').max(80, 'الاسم أطول من ٨٠ حرفًا'),
});

function AddSupplierDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [savedName, setSavedName] = useState('');
  const [saveError, setSaveError] = useState('');
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { supplierName: '' } });
  const saving = form.formState.isSubmitting;
  const close = (o: boolean) => {
    if (saving) return;
    onOpenChange(o);
    if (!o) { form.reset(); setSavedName(''); setSaveError(''); }
  };
  const submit = async ({ supplierName }: z.infer<typeof schema>) => {
    setSaveError('');
    setSavedName('');
    try {
      await saveSupplier(supplierName);
      setSavedName(supplierName);
      form.reset();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'تعذّر حفظ المورد. حاول مجددًا.');
    }
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent dir="rtl" aria-busy={saving} className="sm:max-w-md text-right rounded-2xl border-[hsl(var(--primary)/0.2)] [&>button]:left-4 [&>button]:right-auto" data-testid="dialog-add-supplier">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle className="font-display text-2xl text-primary">إضافة مورد</DialogTitle>
          <DialogDescription>أضف اسم المورد لحفظه في قاعدة بيانات كاشف.</DialogDescription>
        </DialogHeader>
        <div role="note" className="flex gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm leading-relaxed" data-testid="text-supabase-connected">
          <Info className="h-5 w-5 shrink-0 text-[hsl(30_80%_38%)]" aria-hidden />
          <p>يُحفظ الاسم في Supabase. لا تتاح قراءة أسماء الموردين أو تعديلها أو حذفها للزوار.</p>
        </div>
        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="supplierName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">اسم المورد</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={saving} onChange={(event) => { field.onChange(event); setSavedName(''); setSaveError(''); }} autoFocus autoComplete="organization" placeholder="مثلًا: مؤسسة الخيرات للخضار" className="h-12 rounded-xl text-base" data-testid="input-supplier-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {savedName && (
              <p role="status" className="text-sm font-medium text-primary" data-testid="status-supplier-saved">
                تم حفظ المورد «{savedName}» في Supabase بنجاح.
              </p>
            )}
            {saveError && <p role="alert" className="text-sm text-destructive" data-testid="status-supplier-error">{saveError}</p>}
            <DialogFooter className="gap-2 sm:justify-start sm:space-x-0">
              <button type="submit" disabled={saving || !!savedName} className="h-11 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed" data-testid="button-submit-supplier">
                {saving ? 'جارٍ الحفظ…' : 'حفظ المورد'}
              </button>
              <button type="button" disabled={saving} onClick={() => close(false)} className="h-11 rounded-xl border border-input px-6 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60" data-testid="button-cancel-supplier">
                إغلاق
              </button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const rows = [
  { item: 'طماطم', unit: 'كغ', po: 40, rec: 36, inv: 40, price: '4.25' },
  { item: 'جبنة بيضاء', unit: 'علبة', po: 12, rec: 12, inv: 12, price: '18.50' },
  { item: 'حليب طازج', unit: 'لتر', po: 30, rec: 30, inv: 30, price: '5.75' },
  { item: 'خبز صامولي', unit: 'كيس', po: 25, rec: 22, inv: 25, price: '3.20' },
];

function ExampleBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 bg-background px-3 py-1 text-xs font-semibold text-primary" data-testid="badge-example">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      مثال توضيحي
    </span>
  );
}

function InvoiceExample() {
  const diffs = rows.filter((r) => r.inv !== r.rec);
  return (
    <figure className="relative rounded-3xl border border-card-border bg-card p-5 shadow-[0_30px_60px_-30px_hsl(186_62%_20%/0.35)] sm:p-7" aria-label="مثال توضيحي لمطابقة فاتورة" data-testid="card-example-invoice">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">فاتورة مورد خضار وألبان</p>
          <p className="font-display text-xl text-primary">مطابقة ثلاثية</p>
        </div>
        <ExampleBadge />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[340px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 text-right font-medium">الصنف</th>
              <th className="py-2 font-medium">طُلب</th>
              <th className="py-2 font-medium">استُلم</th>
              <th className="py-2 font-medium">فوتر</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r, i) => {
              const bad = r.inv !== r.rec;
              return (
                <tr key={r.item} className={`rise border-b border-border/60 last:border-0 ${bad ? 'bg-destructive/[0.06]' : ''}`} style={{ animationDelay: `${300 + i * 90}ms` }} data-testid={`row-example-${i}`}>
                  <td className="py-3 text-right font-medium">{r.item} <span className="text-xs text-muted-foreground">/ {r.unit}</span></td>
                  <td className="py-3 text-center">{r.po}</td>
                  <td className={`py-3 text-center ${bad ? 'font-bold text-destructive' : ''}`}>{r.rec}</td>
                  <td className={`py-3 text-center ${bad ? 'font-bold text-destructive underline decoration-wavy decoration-destructive/50 underline-offset-4' : ''}`}>{r.inv}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-5 rounded-2xl bg-primary p-4 text-primary-foreground">
        <p className="text-sm opacity-80">الفروقات المعروضة</p>
        <ul className="mt-2 space-y-1 text-sm">
          {diffs.map((r) => (
            <li key={r.item} className="flex justify-between gap-2">
              <span>{r.item}: فوتر {r.inv} واستُلم {r.rec}</span>
              <span className="tabular-nums font-semibold text-accent">{((r.inv - r.rec) * Number(r.price)).toFixed(2)} ر.س</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="stamp pointer-events-none absolute -left-3 -top-5 rotate-[-8deg] rounded-lg border-2 border-destructive px-3 py-1 font-display text-sm text-destructive bg-card/90 sm:-left-6" aria-hidden>
        راجِع قبل الدفع
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">أرقام افتراضية للتوضيح فقط، وليست بيانات حقيقية أو تحليلًا مباشرًا.</figcaption>
    </figure>
  );
}

function Step({ n, icon, title, children }: { n: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="relative flex gap-4 border-b border-border py-6 last:border-0 sm:gap-6">
      <span className="font-display text-5xl leading-none text-accent/80 tabular-nums" aria-hidden>{n}</span>
      <div>
        <h3 className="flex items-center gap-2 font-display text-xl text-primary">{icon}{title}</h3>
        <p className="mt-1 max-w-md leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

export default function Home() {
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const theme = useTheme();
  const favs = useFavorites();
  const cart = useCart();
  const storageFailed = theme.storageFailed || favs.storageFailed || cart.storageFailed;
  const addPlan = (id: PlanId) => { cart.add(id); setCartOpen(true); };
  const cta = (id: string, cls = '') => (
    <button type="button" onClick={() => setOpen(true)} className={`inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-[0_10px_24px_-12px_hsl(186_62%_20%/0.8)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${cls}`} data-testid={id}>
      <Plus className="h-5 w-5" aria-hidden /> إضافة مورد
    </button>
  );

  return (
    <div dir="rtl" lang="ar" className="grain min-h-[100dvh] w-full min-w-0 overflow-x-clip bg-background text-foreground">
      <a href="#top" className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">تخطَّ إلى المحتوى</a>
      <SiteHeader theme={theme.theme} onToggleTheme={theme.toggle} cartCount={cart.items.length} onOpenCart={() => setCartOpen(true)} cta={cta('button-add-supplier-header', 'h-10 px-4 text-sm')} />
      <div aria-hidden className="h-[113px] md:h-[65px]" />
      {storageFailed && <div className="px-5"><StorageNotice /></div>}

      <main id="top" tabIndex={-1} className="focus:outline-none">
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-20 pt-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div>
            <p className="rise mb-5 inline-block rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-primary">للمطاعم والمقاهي والبقالات</p>
            <h1 className="rise font-display text-[2.6rem] leading-[1.15] text-primary sm:text-6xl" style={{ animationDelay: '80ms' }}>
              ادفع لمورّدك<br />
              <span className="relative inline-block">
                <span className="relative z-10">وأنت متأكد.</span>
                <span className="absolute inset-x-0 bottom-1 z-0 h-4 bg-accent/50" aria-hidden />
              </span>
            </h1>
            <p className="rise mt-6 max-w-lg text-lg leading-loose text-muted-foreground" style={{ animationDelay: '160ms' }}>
              كاشف يضع أمر الشراء، وما استلمته فعلًا، وفاتورة المورد جنبًا إلى جنب — ثم يُظهر لك الفروقات بوضوح، قبل أن يخرج الريال من صندوقك.
            </p>
            <div className="rise mt-8 flex flex-wrap items-center gap-4" style={{ animationDelay: '240ms' }}>
              {cta('button-add-supplier-hero')}
              <a href="#how" className="inline-flex h-12 items-center gap-2 rounded-xl border border-input px-5 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-scroll-how">
                كيف يعمل <ArrowDown className="h-4 w-4" aria-hidden />
              </a>
              <a href="#invoice-analysis" className="inline-flex h-12 items-center gap-2 rounded-xl px-2 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-scroll-invoice-analysis">
                حلّل نص فاتورة <ReceiptText className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>
          <div className="rise min-w-0" style={{ animationDelay: '200ms' }}>
            <InvoiceExample />
          </div>
        </section>

        <section className="girih bg-primary text-primary-foreground">
          <div className="mx-auto max-w-4xl px-5 py-16 text-center">
            <p className="font-display text-3xl leading-relaxed sm:text-4xl">
              «طلبت أربعين، وصلت ستة وثلاثين، والفاتورة تقول أربعين.»
            </p>
            <p className="mt-4 text-primary-foreground/70">فرق صغير في كل توريدة، يتراكم بصمت. كاشف يجعله ظاهرًا أمامك.</p>
          </div>
        </section>

        <section id="how" className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-20 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <h2 className="font-display text-4xl text-primary">ثلاث أوراق.<br />مطابقة واحدة.</h2>
            <p className="mt-4 max-w-sm leading-relaxed text-muted-foreground">لا لوحات معقّدة ولا مصطلحات محاسبية. فقط ما طلبته، وما وصلك، وما يُطلب منك دفعه.</p>
          </div>
          <ol className="ledger-lines rounded-3xl border border-card-border bg-card px-6 sm:px-8">
            <Step n="١" icon={<ClipboardList className="h-5 w-5" aria-hidden />} title="أمر الشراء">ما طلبته من المورد: الأصناف والكميات.</Step>
            <Step n="٢" icon={<PackageCheck className="h-5 w-5" aria-hidden />} title="الكميات المستلمة">ما وصل إلى بابك فعلًا عند الاستلام.</Step>
            <Step n="٣" icon={<ReceiptText className="h-5 w-5" aria-hidden />} title="الفاتورة">ما يطلبه المورد منك، تُطابَق مع الورقتين السابقتين.</Step>
            <Step n="٤" icon={<Info className="h-5 w-5" aria-hidden />} title="عرض الفروقات">كل صنف لا يتطابق يظهر أمامك، لتقرر بثقة قبل الدفع.</Step>
          </ol>
        </section>

        <InvoiceAnalysisSection />

        <FeaturesSection isFavorite={favs.isFavorite} onToggleFavorite={favs.toggle} favoriteCount={favs.favorites.length} />

        <PlansSection has={cart.has} onAdd={addPlan} />

        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-accent/40 bg-accent/15 p-8 sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="font-display text-3xl text-primary">ابدأ بمورّد واحد</h2>
              <p className="mt-2 text-muted-foreground">أضف اسم مورّدك الأول واحفظه في كاشف.</p>
            </div>
            {cta('button-add-supplier-footer')}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <a href="#top" className="font-display text-primary hover:underline" data-testid="link-back-top">كاشف</a> — راجع فاتورة المورد قبل أن تدفع.
      </footer>

      <AddSupplierDialog open={open} onOpenChange={setOpen} />
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} items={cart.items} totalFils={cart.totalFils} onRemove={cart.remove} onClear={cart.clear} />
    </div>
  );
}
