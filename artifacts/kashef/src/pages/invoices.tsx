import { useAuth } from '@/components/auth-provider';
import { useInvoiceList } from '@/hooks/use-invoices';
import type { InvoiceStatus } from '@/lib/invoice-types';
import { Link } from 'wouter';
import { ArrowUpLeft, CalendarDays, FileText, LockKeyhole, Plus, ReceiptText, RefreshCw } from 'lucide-react';
import { PageIntro, PrimaryLink, QueryProblem, WorkspaceFrame } from '@/pages/invoice-workspace';
import { getLanguage, t } from '@/lib/i18n';

const statusLabels: Record<InvoiceStatus, string> = {
  under_review: 'قيد المراجعة',
  matched: 'متطابقة',
  discrepancy: 'تحتاج انتباهك',
  approved: 'معتمدة',
  disputed: 'تم الاعتراض',
};

const statusStyles: Record<InvoiceStatus, string> = {
  under_review: 'border-accent/35 bg-accent/10 text-[hsl(30_75%_32%)]',
  matched: 'border-primary/20 bg-primary/10 text-primary',
  discrepancy: 'border-destructive/25 bg-destructive/5 text-destructive',
  approved: 'border-primary/20 bg-primary/10 text-primary',
  disputed: 'border-destructive/25 bg-destructive/5 text-destructive',
};

function money(value: string | number | null, currency: string | null) {
  if (value === null || value === '') return '—';
  const formatted = new Intl.NumberFormat(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(value));
  return `${formatted} ${currency || (getLanguage() === 'ar' ? 'د.ك' : 'KWD')}`;
}

function dateLabel(value: string | null) {
  if (!value) return t('التاريخ غير متوفر');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default function InvoicesPage() {
  const { user, loading: authLoading } = useAuth();
  const invoices = useInvoiceList(user?.id);

  return (
    <WorkspaceFrame>
      <PageIntro
        eyebrow="مكتب الفواتير"
        title="فواتيرك، في مكان واحد"
        description="راجع ما وصل من الموردين، وافتح أي فاتورة لتفاصيل القراءة والفحوصات الحسابية."
        action={<PrimaryLink href="/invoices/new" testId="button-new-invoice"><Plus className="h-4 w-4" aria-hidden /> {t('فاتورة جديدة')}</PrimaryLink>}
      />

      {authLoading ? (
          <div className="space-y-3" aria-label={t('جارٍ تحميل مساحة العمل')} data-testid="status-invoices-auth-loading">
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : !user ? (
        <section className="rounded-3xl border border-border bg-card px-6 py-12 text-center" data-testid="state-invoices-sign-in">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><LockKeyhole className="h-6 w-6" aria-hidden /></div>
          <h2 className="mt-4 font-display text-2xl text-primary">{t('سجّل الدخول أولًا')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('تظهر فواتيرك بعد الدخول إلى مساحة كاشف الخاصة بك.')}</p>
          <Link href="/login" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground" data-testid="link-invoices-login">{t('الدخول إلى حسابك')} <ArrowUpLeft className="h-4 w-4" aria-hidden /></Link>
        </section>
      ) : invoices.isLoading ? (
        <div className="space-y-3" aria-label={t('جارٍ تحميل الفواتير')} data-testid="status-invoices-loading">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl border border-border/70 bg-card" />)}
        </div>
      ) : invoices.isError ? (
        <QueryProblem message="تعذر الوصول إلى قائمة الفواتير. تحقق من اتصالك ثم أعد المحاولة." onRetry={() => void invoices.refetch()} />
      ) : !invoices.data?.length ? (
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-12 text-center sm:py-16" data-testid="state-invoices-empty">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent/80" aria-hidden />
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[1.35rem] bg-secondary text-primary"><ReceiptText className="h-7 w-7" aria-hidden /></div>
          <p className="mt-6 text-xs font-semibold tracking-wide text-primary/70">{t('بداية مرتبة')}</p>
          <h2 className="mt-2 font-display text-2xl text-primary sm:text-3xl">{t('لا توجد فواتير بعد')}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">{t('ارفع صورة أو ملف PDF لفاتورتك الأولى. سيقرأ كاشف البيانات ويفحص الإجمالي قبل أن تقرر.')}</p>
          <PrimaryLink href="/invoices/new" testId="button-empty-upload"><Plus className="h-4 w-4" aria-hidden /> {t('ارفع أول فاتورة')}</PrimaryLink>
          <p className="mt-5 text-xs text-muted-foreground">{t('لا تحتاج إلى كتابة أي بيانات يدويًا.')}</p>
        </section>
      ) : (
          <section aria-label={t('قائمة الفواتير')} data-testid="list-invoices">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span data-testid="text-invoice-count">{new Intl.NumberFormat(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW').format(invoices.data.length)} {t(invoices.data.length === 1 ? 'فاتورة' : 'فواتير')}</span>
            <button type="button" onClick={() => void invoices.refetch()} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-refresh-invoices"><RefreshCw className="h-3.5 w-3.5" aria-hidden /> {t('تحديث')}</button>
          </div>
          <div className="space-y-3">
            {invoices.data.map((invoice) => (
              <Link href={`/invoices/${invoice.id}`} key={invoice.id} className="group grid gap-4 rounded-2xl border border-border/80 bg-card p-4 transition-transform hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_40px_-30px_hsl(var(--primary)/.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5" data-testid={`card-invoice-${invoice.id}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><FileText className="h-5 w-5" aria-hidden /></span>
                  <span className="min-w-0">
                    <span dir="auto" className="block truncate font-semibold text-foreground" data-testid={`text-supplier-${invoice.id}`} data-no-translate>{invoice.supplier_name || t('مورد غير محدد')}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span data-testid={`text-invoice-number-${invoice.id}`}>{t('رقم الفاتورة:')} <bdi dir="auto">{invoice.invoice_number || t('غير واضح')}</bdi></span>
                      <span className="inline-flex items-center gap-1" data-testid={`text-invoice-date-${invoice.id}`}><CalendarDays className="h-3 w-3" aria-hidden />{dateLabel(invoice.invoice_date)}</span>
                    </span>
                  </span>
                </div>
                <span className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className="text-right">
                    <span className="block text-[11px] text-muted-foreground">{t('الإجمالي')}</span>
                    <span className="mt-0.5 block font-mono text-base font-semibold tabular-nums text-foreground" dir="ltr" data-testid={`text-total-${invoice.id}`}>{money(invoice.total_amount, invoice.currency)}</span>
                  </span>
                  <span className={`inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-semibold ${statusStyles[invoice.status]}`} data-testid={`status-invoice-${invoice.id}`}>{t(statusLabels[invoice.status])}</span>
                  <ArrowUpLeft className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-1 sm:block" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground" data-testid="text-invoices-private-note">{t('هذه القائمة خاصة بحسابك. لا تظهر فواتير مستخدمين آخرين.')}</p>
        </section>
      )}
    </WorkspaceFrame>
  );
}
