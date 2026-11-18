import { useMemo } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft, BadgeCheck, CircleAlert, ClipboardCheck, FilePlus2,
  FileText, Package, RefreshCw, Sparkles, Users,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useInvoiceList } from '@/hooks/use-invoices';
import { useSupplierPrices } from '@/hooks/use-invoices';
import { useSuppliers } from '@/hooks/use-suppliers';
import { getDashboardMetrics, getOnboardingSteps } from '@/lib/dashboard-metrics';
import type { InvoiceListRow } from '@/lib/invoice-types';
import { PageIntro, PrimaryLink, QueryProblem, WorkspaceFrame } from '@/pages/invoice-workspace';
import { getLanguage, t, useLanguage } from '@/lib/i18n';

function formatAmount(value: number | string | null, currency: string) {
  if (value === null || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW', {
      style: 'currency',
      currency: currency || 'KWD',
      maximumFractionDigits: 3,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW')} ${currency}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return t('التاريخ غير محدد');
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? t('التاريخ غير محدد')
    : new Intl.DateTimeFormat(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function statusLabel(status: InvoiceListRow['status']) {
  const labels: Record<InvoiceListRow['status'], string> = {
    under_review: 'قيد المراجعة',
    matched: 'متطابقة',
    discrepancy: 'تحتاج انتباهًا',
    approved: 'معتمدة',
    disputed: 'معترض عليها',
  };
  return labels[status] ? t(labels[status]) : t('غير محددة');
}

function statusStyle(status: InvoiceListRow['status']) {
  if (status === 'discrepancy' || status === 'disputed') return 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300';
  if (status === 'approved' || status === 'matched') return 'border-emerald-600/20 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300';
  return 'border-primary/20 bg-primary/5 text-primary';
}

function LoadingPanel() {
  return (
    <div className="space-y-3" aria-label={t('جارٍ تحميل البيانات')} data-testid="status-dashboard-loading">
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="h-52 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function DashboardPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const invoicesQuery = useInvoiceList(user?.id);
  const suppliersQuery = useSuppliers(user?.id);
  const pricesQuery = useSupplierPrices(user?.id);
  const invoices = invoicesQuery.data ?? [];
  const metrics = useMemo(() => getDashboardMetrics(invoices), [invoices]);
  const steps = getOnboardingSteps({
    suppliers: suppliersQuery.data?.length ?? 0,
    supplierPrices: pricesQuery.data?.length ?? 0,
    invoices: invoices.length,
  });
  const anyLoading = invoicesQuery.isLoading || suppliersQuery.isLoading || pricesQuery.isLoading;
  const failed = invoicesQuery.isError || suppliersQuery.isError || pricesQuery.isError;
  const retryAll = () => {
    void invoicesQuery.refetch();
    void suppliersQuery.refetch();
    void pricesQuery.refetch();
  };
  const businessName = user?.user_metadata?.business_name;
  const hasBusinessName = typeof businessName === 'string' && Boolean(businessName.trim());
  const greetingName = hasBusinessName ? businessName.trim() : '';

  return (
    <WorkspaceFrame>
      <PageIntro
        eyebrow="مساحة العمل · اليوم"
        title={<>{t('صباح المراجعة،')} {hasBusinessName ? <span data-no-translate>{greetingName}</span> : t('أهلًا بك')}</>}
        description="نظرة سريعة على الفواتير وملاحظات المطابقة، لتعرف ما يحتاج انتباهك قبل اعتماد الحساب."
        action={<PrimaryLink href="/invoices/new" testId="link-dashboard-new-invoice">{t('فاتورة جديدة')} <FilePlus2 className="h-4 w-4" aria-hidden /></PrimaryLink>}
      />

      {failed ? (
        <QueryProblem message="لم نتمكن من تحميل بعض بيانات مساحة العمل. تحقق من الاتصال ثم أعد المحاولة." onRetry={retryAll} testId="status-dashboard-error" />
      ) : anyLoading ? (
        <LoadingPanel />
      ) : (
        <div className="space-y-8">
          <section aria-label={t('ملخص المراجعة')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary p-5 text-primary-foreground shadow-sm sm:p-6" data-testid="card-dashboard-review-count">
              <div className="absolute -left-5 -top-8 h-28 w-28 rounded-full border border-primary-foreground/10" aria-hidden />
              <p className="text-sm text-primary-foreground/75">{t('تحتاج مراجعتك')}</p>
              <p className="mt-3 font-display text-4xl leading-none" data-testid="text-dashboard-review-count">{metrics.needsReviewCount.toLocaleString(language === 'ar' ? 'ar-KW' : 'en-KW')}</p>
              <p className="mt-3 text-xs text-primary-foreground/70">{t('فواتير قيد المراجعة أو عليها اختلاف')}</p>
              <ClipboardCheck className="absolute bottom-5 left-5 h-7 w-7 opacity-35" aria-hidden />
            </article>
            <article className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" data-testid="card-dashboard-invoices">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><FileText className="h-5 w-5" aria-hidden /></span>
                <span className="text-xs text-muted-foreground">{t('كل الفواتير')}</span>
              </div>
              <p className="mt-4 font-display text-3xl text-foreground" data-testid="text-dashboard-invoice-count">{invoices.length.toLocaleString(language === 'ar' ? 'ar-KW' : 'en-KW')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('سجل الفواتير المحفوظ')}</p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" data-testid="card-dashboard-differences">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><CircleAlert className="h-5 w-5" aria-hidden /></span>
                <span className="text-xs text-muted-foreground">{t('فواتير بها اختلافات')}</span>
              </div>
              <p className="mt-4 font-display text-3xl text-foreground" data-testid="text-dashboard-difference-invoices">{metrics.invoicesWithDifferencesCount.toLocaleString(language === 'ar' ? 'ar-KW' : 'en-KW')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{metrics.differenceChecksCount.toLocaleString(language === 'ar' ? 'ar-KW' : 'en-KW')} {t('ملاحظة اختلاف مسجلة')}</p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" data-testid="card-dashboard-largest-difference">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-foreground"><BadgeCheck className="h-5 w-5" aria-hidden /></span>
                <span className="text-xs text-muted-foreground">{t('أكبر فرق مسجل')}</span>
              </div>
              {metrics.largestDifferenceByCurrency.length ? (
                <div className="mt-3 space-y-1" data-testid="list-largest-differences">
                  {metrics.largestDifferenceByCurrency.map((entry) => (
                    <p key={entry.currency} className="font-display text-xl leading-tight text-foreground" data-testid={`text-largest-difference-${entry.currency}`}>
                      {formatAmount(entry.amount, entry.currency)}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-4 font-display text-xl text-muted-foreground" data-testid="text-no-recorded-differences">{t('لا توجد فروق مسجلة')}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{t('أعلى فرق منفرد لكل عملة، وليس مجموعًا أو توفيرًا')}</p>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.85fr)]">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" data-testid="section-latest-invoices">
              <div className="flex items-end justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-semibold text-primary/75">{t('آخر ما وصل')}</p>
                  <h2 className="mt-1 font-display text-xl text-foreground">{t('أحدث الفواتير')}</h2>
                </div>
                <Link href="/invoices" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-dashboard-all-invoices">
                  {t('عرض الكل')} <ArrowLeft className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              {invoices.length === 0 ? (
                <div className="px-6 py-12 text-center" data-testid="state-dashboard-empty-invoices">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><FileText className="h-6 w-6" aria-hidden /></span>
                  <h3 className="mt-4 font-display text-xl">{t('ابدأ بأول فاتورة')}</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t('ارفع فاتورة المورد، وأرفق سند الاستلام إن توفر، لتظهر لك نتيجة المراجعة هنا.')}</p>
                  <Link href="/invoices/new" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" data-testid="link-empty-invoice-upload">{t('رفع فاتورة')} <ArrowLeft className="h-4 w-4" aria-hidden /></Link>
                </div>
              ) : (
                <div className="divide-y divide-border/70">
                  {invoices.slice(0, 5).map((invoice) => (
                    <Link href={`/invoices/${invoice.id}`} key={invoice.id} className="group flex min-h-[78px] items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-secondary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6" data-testid={`row-dashboard-invoice-${invoice.id}`}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background text-primary"><FileText className="h-4 w-4" aria-hidden /></span>
                        <span className="min-w-0">
                          <span dir="auto" className="block truncate font-semibold text-foreground" data-testid={`text-dashboard-invoice-supplier-${invoice.id}`} data-no-translate>{invoice.supplier_name || t('مورد غير محدد')}</span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">{invoice.invoice_number ? `${t('فاتورة رقم')} ${invoice.invoice_number} · ` : ''}{formatDate(invoice.invoice_date || invoice.created_at)}</span>
                        </span>
                      </div>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span dir="auto" className="font-semibold tabular-nums text-foreground" data-testid={`text-dashboard-invoice-amount-${invoice.id}`}>{formatAmount(invoice.total_amount, invoice.currency)}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyle(invoice.status)}`} data-testid={`status-dashboard-invoice-${invoice.id}`}>{statusLabel(invoice.status)}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" data-testid="section-first-run-steps">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-primary/75">{t('تهيئة بسيطة')}</p>
                  <h2 className="mt-1 font-display text-xl">{t('جهّز مراجعتك')}</h2>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-primary"><Sparkles className="h-5 w-5" aria-hidden /></span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('كل خطوة تضيف سياقًا يساعد كاشف على مقارنة الفاتورة بما اتفقت عليه.')}</p>
              <div className="mt-5 space-y-2">
                {steps.map((step, index) => {
                  const Icon = index === 0 ? Users : index === 1 ? Package : FilePlus2;
                  return (
                    <Link key={step.key} href={step.href} className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${step.complete ? 'border-emerald-600/20 bg-emerald-600/[0.045]' : 'border-border bg-background hover:border-primary/30 hover:bg-secondary/40'}`} data-testid={`link-onboarding-${step.key}`}>
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${step.complete ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300' : 'bg-secondary text-primary'}`}>
                        {step.complete ? <BadgeCheck className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{t(step.label)}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{t(step.complete ? 'تمت الإضافة' : 'خطوة تساعد على دقة المراجعة')}</span>
                      </span>
                      <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  );
                })}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4 text-xs text-muted-foreground" data-testid="text-dashboard-data-counts">
                <span>{t('الموردون')} {suppliersQuery.data?.length ?? 0}</span>
                <span>{t('الأسعار')} {pricesQuery.data?.length ?? 0}</span>
                <button type="button" onClick={retryAll} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-dashboard-refresh"><RefreshCw className="h-3.5 w-3.5" aria-hidden /> {t('تحديث')}</button>
              </div>
            </aside>
          </section>
        </div>
      )}
    </WorkspaceFrame>
  );
}
