import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowDown, ClipboardList, PackageCheck, ReceiptText, ScanLine } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { StorageNotice } from '@/components/storage-notice';
import { InvoiceAnalysisSection } from '@/components/invoice-analysis-section';
import { FeaturesSection } from '@/components/features-section';
import { PlansSection } from '@/components/plans-section';
import { CartSheet } from '@/components/cart-sheet';
import { useTheme } from '@/hooks/use-theme';
import { useFavorites } from '@/hooks/use-favorites';
import { useCart } from '@/hooks/use-cart';
import type { PlanId } from '@/data/plans';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getLanguage, t } from '@/lib/i18n';

const invoiceRows = [
  { item: 'طماطم', itemEn: 'Tomatoes', unit: 'كغ', unitEn: 'kg', ordered: 40, received: 36, billed: 40, price: 4.25 },
  { item: 'جبنة بيضاء', itemEn: 'White cheese', unit: 'علبة', unitEn: 'pack', ordered: 12, received: 12, billed: 12, price: 18.5 },
  { item: 'حليب طازج', itemEn: 'Fresh milk', unit: 'لتر', unitEn: 'L', ordered: 30, received: 30, billed: 30, price: 5.75 },
  { item: 'خبز صامولي', itemEn: 'Samoon bread', unit: 'كيس', unitEn: 'bag', ordered: 25, received: 22, billed: 25, price: 3.2 },
];

function InvoiceExample() {
  const language = getLanguage();
  const numberFormat = new Intl.NumberFormat(language === 'ar' ? 'ar-KW' : 'en-KW', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  const mismatches = invoiceRows.filter((row) => row.billed !== row.received);
  return <figure className="relative rounded-[1.75rem] border border-card-border bg-card p-5 shadow-[0_28px_70px_-38px_hsl(186_62%_20%/0.5)] sm:p-7" aria-label={t('مثال توضيحي لمطابقة فاتورة')} data-testid="card-example-invoice">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div><p className="text-xs text-muted-foreground">{t('فاتورة مورد خضار وألبان')}</p><h2 className="mt-1 font-display text-xl text-primary">{t('مراجعة قبل الدفع')}</h2></div>
      <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-primary/40 bg-background px-3 py-1.5 text-xs font-semibold text-primary" data-testid="badge-example">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />{t('مثال توضيحي')}
        </span>
        <span className="rotate-[-5deg] rounded-md border-2 border-destructive/70 bg-card px-2.5 py-1 font-display text-xs font-bold text-destructive">{t('راجع قبل الدفع')}</span>
      </div>
    </header>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[330px] text-sm">
        <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-2 text-start font-medium">{t('الصنف')}</th><th className="py-2 font-medium">{t('طُلب')}</th><th className="py-2 font-medium">{t('وصل')}</th><th className="py-2 font-medium">{t('الفاتورة')}</th></tr></thead>
        <tbody className="tabular-nums">{invoiceRows.map((row) => {
          const mismatch = row.billed !== row.received;
          return <tr key={row.item} className={`border-b border-border/60 last:border-0 ${mismatch ? 'bg-destructive/[0.06]' : ''}`}>
            <td className="py-3 text-start font-medium">{language === 'ar' ? row.item : row.itemEn} <span className="text-xs text-muted-foreground">/ {language === 'ar' ? row.unit : row.unitEn}</span></td>
            <td className="py-3 text-center">{numberFormat.format(row.ordered)}</td><td className={`py-3 text-center ${mismatch ? 'font-bold text-destructive' : ''}`}>{numberFormat.format(row.received)}</td>
            <td className={`py-3 text-center ${mismatch ? 'font-bold text-destructive underline decoration-wavy underline-offset-4' : ''}`}>{numberFormat.format(row.billed)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div className="mt-5 rounded-2xl bg-primary p-4 text-primary-foreground">
      <p className="text-sm text-primary-foreground/75">{t('فرق يستحق المراجعة')}</p>
       <ul className="mt-2 space-y-2 text-sm">{mismatches.map((row) => <li key={row.item} className="flex justify-between gap-3"><span>{language === 'ar' ? `${row.item}: ${row.billed} ${t('في الفاتورة،')} ${row.received} ${t('وصل')}` : `${row.itemEn}: ${numberFormat.format(row.billed)} billed, ${numberFormat.format(row.received)} received`}</span><b className="shrink-0 tabular-nums text-accent">{numberFormat.format((row.billed - row.received) * row.price)} {t('د.ك')}</b></li>)}</ul>
    </div>
    <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">{t('أرقام افتراضية للتوضيح فقط، وليست بيانات حقيقية أو مراجعة مباشرة.')}</figcaption>
  </figure>;
}

function Step({ n, icon, title, children }: { n: string; icon: ReactNode; title: string; children: ReactNode }) {
  return <li className="flex gap-4 border-b border-border/80 py-5 last:border-0 sm:gap-5">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/20 font-display text-lg font-bold text-[hsl(30_80%_38%)]">{n}</span>
    <div><h3 className="flex items-center gap-2 font-display text-lg font-semibold text-primary">{icon}{title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p></div>
  </li>;
}

const questions = [
  { q: 'ما الذي يراجعه كاشف؟', a: 'يقارن كاشف بين ما طلبته، وما استلمته، وما كتبه المورد في الفاتورة.' },
  { q: 'هل أحتاج خبرة محاسبية؟', a: 'لا. تظهر الفروقات بكلمات واضحة لتراجعها قبل الدفع.' },
  { q: 'هل يمكنني تجربة الباقات؟', a: 'نعم، الشهر الأول مجاناً. الأسعار المعروضة بالدينار الكويتي.' },
  { q: 'لمن صُمّم كاشف؟', a: 'لأصحاب المطاعم والمقاهي والبقالات الذين يراجعون فواتير الموردين.' },
];

export default function Home() {
  const [cartOpen, setCartOpen] = useState(false);
  const theme = useTheme();
  const favorites = useFavorites();
  const cart = useCart();
  const storageFailed = theme.storageFailed || favorites.storageFailed || cart.storageFailed;
  const numbers = getLanguage() === 'ar' ? ['١', '٢', '٣', '٤'] : ['1', '2', '3', '4'];
  const addPlan = (id: PlanId) => { cart.add(id); setCartOpen(true); };

  return <div className="grain min-h-[100dvh] w-full min-w-0 overflow-x-clip bg-background text-foreground">
     <a href="#top" className="sr-only focus:not-sr-only focus:fixed focus:end-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">{t('تخطَّ إلى المحتوى')}</a>
    <SiteHeader theme={theme.theme} onToggleTheme={theme.toggle} cartCount={cart.items.length} onOpenCart={() => setCartOpen(true)} />
    <div aria-hidden className="h-[68px]" />
    {storageFailed && <div className="mx-auto max-w-6xl px-5 pt-3"><StorageNotice /></div>}
    <main id="top" tabIndex={-1} className="focus:outline-none">
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-9 px-5 pb-12 pt-9 md:gap-12 md:pb-16 md:pt-14 lg:grid-cols-[1fr_0.95fr]">
        <div>
          <p className="rise mb-4 inline-flex rounded-full border border-primary/15 bg-secondary px-4 py-1.5 text-sm font-medium text-primary">{t('للمطاعم والمقاهي والبقالات')}</p>
          <h1 className="rise font-display text-[2.65rem] leading-[1.16] text-primary sm:text-6xl" style={{ animationDelay: '80ms' }}>{t('ادفع لمورّدك')}<br /><span className="relative inline-block"><span className="relative z-10">{t('وأنت متأكد.')}</span><span className="absolute inset-x-0 bottom-1 z-0 h-3.5 bg-accent/50" aria-hidden /></span></h1>
          <p className="rise mt-5 max-w-lg text-base leading-[1.9] text-muted-foreground sm:text-lg" style={{ animationDelay: '150ms' }}>{t('قارن ما طلبته بما وصل وما في الفاتورة. اكتشف الفرق قبل أن تدفع — ببساطة.')}</p>
          <div className="rise mt-7 flex flex-wrap items-center gap-3" style={{ animationDelay: '220ms' }}>
            <Link href="/app" className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-[0_10px_24px_-12px_hsl(186_62%_20%/0.7)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" data-testid="button-hero-start">{t('ابدأ مجاناً')}</Link>
            <a href="#how" className="inline-flex h-12 items-center gap-2 rounded-xl border border-input bg-card/60 px-5 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-scroll-how">{t('كيف يعمل')} <ArrowDown className="h-4 w-4" aria-hidden /></a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t('لا تحتاج إلى خبرة محاسبية.')}</p>
        </div>
        <div className="rise min-w-0" style={{ animationDelay: '180ms' }}><InvoiceExample /></div>
      </section>

      <section className="girih bg-primary text-primary-foreground" aria-label={t('أمثلة على الفروقات')}>
        <div className="mx-auto max-w-6xl px-5 py-8 sm:py-9">
          <div className="grid items-center gap-5 md:grid-cols-[1.15fr_1fr] md:gap-8">
            <p className="font-display text-2xl leading-relaxed sm:text-3xl">{t('«طلبت أربعين، وصلت ستة وثلاثين، والفاتورة تقول أربعين.»')}</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[{ value: '04', label: 'كمية زائدة' }, { value: '01', label: 'سعر مختلف' }, { value: '02', label: 'فاتورة مكررة' }].map((stat) => <div key={stat.label} className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.07] px-2 py-3 text-center sm:px-3"><p className="font-display text-2xl font-bold text-accent sm:text-3xl">{stat.value}</p><p className="mt-1 text-[11px] leading-tight text-primary-foreground/75 sm:text-xs">{t(stat.label)}</p></div>)}
            </div>
          </div>
          <p className="mt-4 text-sm text-primary-foreground/70">{t('فرق صغير في كل توريدة يتراكم بصمت. كاشف يجعله واضحاً.')}</p>
        </div>
      </section>

      <section id="how" className="mx-auto grid max-w-6xl grid-cols-1 gap-7 px-5 py-12 sm:py-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
        <div>
          <p className="mb-3 text-xs font-bold tracking-[0.16em] text-[hsl(30_80%_38%)]">{t('بلا تعقيد')}</p>
          <h2 className="font-display text-3xl leading-tight text-primary sm:text-4xl">{t('أربع خطوات. مطابقة واحدة.')}</h2>
          <div className="mt-5 flex gap-2" aria-label={t('الخطوات الأربع')}>{numbers.map((n) => <span key={n} className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 font-display text-sm font-bold text-[hsl(30_80%_38%)]">{n}</span>)}</div>
          <p className="mt-4 max-w-sm leading-relaxed text-muted-foreground">{t('كل شيء واضح من البداية: ما طلبته، ما وصلك، وما يطلبه المورد.')}</p>
        </div>
        <ol className="ledger-lines rounded-3xl border border-card-border bg-card px-5 sm:px-7">
          <Step n={numbers[0]} icon={<ClipboardList className="h-5 w-5" aria-hidden />} title={t('أمر الشراء')}>{t('سجّل الأصناف والكميات التي طلبتها.')}</Step>
          <Step n={numbers[1]} icon={<PackageCheck className="h-5 w-5" aria-hidden />} title={t('الاستلام')}>{t('أدخل ما وصل إلى بابك فعلاً.')}</Step>
          <Step n={numbers[2]} icon={<ReceiptText className="h-5 w-5" aria-hidden />} title={t('الفاتورة')}>{t('أضف تفاصيل فاتورة المورد.')}</Step>
          <Step n={numbers[3]} icon={<ScanLine className="h-5 w-5" aria-hidden />} title={t('راجع الفرق')}>{t('شاهد ما يحتاج إلى مراجعة قبل الدفع.')}</Step>
        </ol>
      </section>

      <InvoiceAnalysisSection />
      <FeaturesSection isFavorite={favorites.isFavorite} onToggleFavorite={favorites.toggle} favoriteCount={favorites.favorites.length} />
      <PlansSection has={cart.has} onAdd={addPlan} />

      <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-4xl px-5 py-12 sm:py-14">
        <div className="mb-6"><p className="text-xs font-bold tracking-[0.16em] text-[hsl(30_80%_38%)]">{t('إجابات واضحة')}</p><h2 id="faq-title" className="mt-2 font-display text-3xl text-primary sm:text-4xl">{t('الأسئلة الشائعة')}</h2></div>
        <Accordion type="single" collapsible className="ledger-lines rounded-3xl border border-card-border bg-card px-5 sm:px-7">
          {questions.map((item, index) => <AccordionItem key={item.q} value={`question-${index + 1}`} className="border-border/80">
            <AccordionTrigger data-testid={`button-faq-${index + 1}`} className="min-h-14 text-start font-display text-base font-semibold text-primary hover:no-underline">{t(item.q)}</AccordionTrigger>
            <AccordionContent className="max-w-2xl text-sm leading-7 text-muted-foreground">{t(item.a)}</AccordionContent>
          </AccordionItem>)}
        </Accordion>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-12 pt-2 sm:pb-14">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-accent/35 bg-accent/15 px-6 py-8 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-10 sm:py-9">
          <div className="absolute -left-8 -top-12 h-36 w-36 rounded-full border border-accent/30" aria-hidden />
          <div className="relative"><h2 className="font-display text-3xl text-primary">{t('ابدأ بمورّد واحد')}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('جرّب مراجعة فاتورتك القادمة قبل الدفع.')}</p></div>
          <Link href="/app" className="relative mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground hover:-translate-y-0.5 sm:mt-0 sm:w-auto" data-testid="button-footer-start">{t('ابدأ مجاناً')}</Link>
        </div>
      </section>
    </main>
     <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground"><a href="#top" className="font-display text-primary hover:underline" data-testid="link-back-top">{t('كاشف')}</a> — {t('راجع فاتورة المورد قبل أن تدفع.')}</footer>
    <CartSheet open={cartOpen} onOpenChange={setCartOpen} items={cart.items} totalFils={cart.totalFils} onRemove={cart.remove} onClear={cart.clear} />
  </div>;
}
