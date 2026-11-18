import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { AlertCircle, ArrowRight, Camera, CheckCircle2, FileImage, FilePlus2, FileText, LockKeyhole, Trash2, UploadCloud } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useCreateInvoice } from '@/hooks/use-invoices';
import { useSuppliers } from '@/hooks/use-suppliers';
import { PageIntro, WorkspaceFrame } from '@/pages/invoice-workspace';
import { getLanguage, t } from '@/lib/i18n';

type UploadSlotProps = {
  title: string;
  subtitle: string;
  file: File | null;
  required?: boolean;
  actionLabel?: string;
  onChange: (file: File | null) => void;
  testId: string;
  capture?: boolean;
};

function UploadSlot({ title, subtitle, file, required, actionLabel, onChange, testId, capture }: UploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.files?.[0] ?? null);
    event.target.value = '';
  };
  return (
    <section className={`rounded-2xl border ${file ? 'border-primary/30 bg-primary/[0.025]' : 'border-dashed border-border bg-card'} p-5 sm:p-6`} data-testid={`card-${testId}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${file ? 'bg-primary/10 text-primary' : 'bg-secondary text-primary'}`}>
          {file ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <FileImage className="h-5 w-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground">{t(title)}{required && <span className="mr-1 text-destructive" aria-label={t('مطلوب')}>*</span>}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(subtitle)}</p>
          {file ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-background px-3 py-3" data-testid={`text-file-${testId}`}>
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">({formatSize(file.size)})</span>
              </span>
              <button type="button" onClick={() => onChange(null)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`button-remove-${testId}`}><Trash2 className="h-4 w-4" aria-hidden /> {t('إزالة')}</button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" data-testid={`button-choose-${testId}`}>
                <UploadCloud className="h-4 w-4" aria-hidden /> {t(actionLabel || 'اختيار ملف')}
              </button>
              {capture && <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`button-camera-${testId}`}><Camera className="h-4 w-4" aria-hidden /> {t('تصوير الفاتورة')}</button>}
            </div>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture={capture ? 'environment' : undefined} onChange={handleChange} className="sr-only" aria-label={t(title)} data-testid={`input-file-${testId}`} />
    </section>
  );
}

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024)).toLocaleString(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW')} ${t('كيلوبايت')}`;
  return `${(size / (1024 * 1024)).toLocaleString(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW', { maximumFractionDigits: 1 })} ${t('ميغابايت')}`;
}

export default function NewInvoicePage() {
  const { user, loading: authLoading } = useAuth();
  const createInvoice = useCreateInvoice(user?.id ?? '');
  const suppliers = useSuppliers(user?.id);
  const [, setLocation] = useLocation();
  const [supplierId, setSupplierId] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError('');
    if (!invoiceFile) {
      setValidationError(t('اختر صورة أو ملف PDF للفاتورة للمتابعة.'));
      return;
    }
    setValidationError('');
    if (!user) {
      setSubmitError(t('سجّل الدخول إلى حسابك قبل رفع المستندات.'));
      return;
    }
    try {
      const invoiceId = await createInvoice.mutateAsync({ invoiceFile, supplierId: supplierId || null, receiptFile });
      setLocation(`/invoices/${invoiceId}`);
    } catch (error) {
      setSubmitError(t(error instanceof Error ? error.message : 'تعذر رفع الفاتورة. تحقق من الملف ثم حاول مرة أخرى.'));
    }
  };

  return (
    <WorkspaceFrame>
      <PageIntro eyebrow={t('فاتورة جديدة')} title={t('أرسل الأوراق، وسنتولى القراءة')} description={t('لا حاجة لإدخال بيانات يدويًا. ارفع الفاتورة، وأرفق سند الاستلام أو الطلب إن توفر.')} />
      {!user && !authLoading ? (
        <section className="mx-auto max-w-2xl rounded-3xl border border-accent/35 bg-accent/10 p-6 sm:p-8" data-testid="state-upload-needs-auth">
          <div className="flex items-start gap-3"><LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden /><div><h2 className="font-display text-xl text-primary">{t('المستندات محفوظة لحسابك')}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t('ادخل باستخدام Google لتبدأ مراجعة الفاتورة في مساحة خاصة.')}</p><Link href="/login" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground" data-testid="link-upload-login">{t('الدخول بحساب Google')} <ArrowRight className="h-4 w-4" aria-hidden /></Link></div></div>
        </section>
      ) : (
        <div className="mx-auto grid max-w-5xl gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
          <form onSubmit={submit} className="space-y-4" aria-busy={createInvoice.isPending} data-testid="form-new-invoice">
            {suppliers.isLoading ? (
              <section className="space-y-3 rounded-2xl border border-border bg-card p-5" aria-label={t('جارٍ تحميل الموردين')} data-testid="status-invoice-suppliers-loading">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-11 animate-pulse rounded-xl bg-muted" />
              </section>
            ) : suppliers.isError ? (
              <section className="rounded-2xl border border-accent/35 bg-accent/[0.08] p-4" role="status" data-testid="status-invoice-suppliers-error">
                <p className="text-sm leading-6 text-muted-foreground">{t('سنحاول معرفة المورد من الفاتورة. يمكنك متابعة الرفع، أو إعادة تحميل القائمة لاختيار مورد محفوظ.')}</p>
                <button type="button" onClick={() => void suppliers.refetch()} className="mt-2 min-h-9 rounded-lg px-3 text-sm font-semibold text-primary underline underline-offset-4" data-testid="button-retry-invoice-suppliers">{t('إعادة تحميل الموردين')}</button>
              </section>
            ) : !suppliers.data?.length ? (
              <section className="rounded-2xl border border-accent/35 bg-accent/[0.08] p-5" data-testid="state-invoice-no-suppliers">
                <h2 className="font-semibold">{t('مطابقة تلقائية للمورد')}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('سنستخرج الاسم من الفاتورة. أضف المورد إذا أردت مقارنة الأسعار بالفواتير السابقة.')}</p>
                <Link href="/suppliers" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/25 bg-background px-4 text-sm font-semibold text-primary" data-testid="link-create-invoice-supplier">{t('إدارة الموردين')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </section>
            ) : (
              <section className="rounded-2xl border border-border/80 bg-card p-5" data-testid="panel-invoice-supplier">
                <label htmlFor="invoice-supplier" className="mb-2 block text-sm font-semibold">{t('ربط اختياري بمورد محفوظ')}</label>
                <select id="invoice-supplier" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setValidationError(''); }} className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="select-invoice-supplier">
                  <option value="">{t('اكتشاف تلقائي من الفاتورة')}</option>
                  {suppliers.data.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </section>
            )}
            <UploadSlot title="فاتورة المورد" actionLabel="ارفع صورة الفاتورة" subtitle="صورة واضحة أو PDF · JPG أو PNG أو WebP أو PDF · حتى 10 ميغابايت" file={invoiceFile} required onChange={setInvoiceFile} testId="invoice" capture />
            <UploadSlot title="سند الاستلام أو الطلب" subtitle="اختياري — أرفق ما يساعد على مقارنة الأصناف والكميات" file={receiptFile} onChange={setReceiptFile} testId="receipt" />

            {validationError && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/[0.06] p-3 text-sm text-destructive" data-testid="status-upload-validation"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{validationError}</p>}
            {submitError && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/[0.06] p-4" data-testid="status-upload-error"><p className="flex items-start gap-2 text-sm leading-6 text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{submitError}</p><button type="button" onClick={() => setSubmitError('')} className="mt-2 text-xs font-semibold text-destructive underline underline-offset-4" data-testid="button-dismiss-upload-error">{t('إخفاء الرسالة')}</button></div>}

            {createInvoice.isPending && (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4" role="status" aria-live="polite" data-testid="status-upload-progress">
                <div className="flex items-center gap-3">
                  <span className="h-5 w-5 animate-pulse rounded-full border-2 border-primary border-t-transparent" aria-hidden />
                  <div><p className="text-sm font-semibold text-primary">{t('نعالج الفاتورة الآن')}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t('جارٍ رفع الملفات وقراءة البنود ثم التحقق من الحسابات. قد يستغرق ذلك لحظات.')}</p></div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-primary/10"><div className="h-full w-2/3 animate-pulse rounded-full bg-accent" /></div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/invoices" className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-cancel-upload">{t('إلغاء والعودة للفواتير')}</Link>
              <button type="submit" disabled={createInvoice.isPending || authLoading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60" data-testid="button-submit-invoice">
                {createInvoice.isPending ? <><span className="h-4 w-4 animate-pulse rounded-full border-2 border-primary-foreground border-t-transparent" aria-hidden /> {t('جارٍ الفحص…')}</> : <><FilePlus2 className="h-4 w-4" aria-hidden /> {t('رفع وبدء المراجعة')}</>}
              </button>
            </div>
          </form>

          <aside className="h-fit rounded-2xl border border-border/80 bg-card p-5 lg:sticky lg:top-6" data-testid="panel-upload-guidance">
            <h2 className="font-display text-xl text-primary">{t('قبل الرفع')}</h2>
            <ul className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden /><span>{t('اجعل كامل الفاتورة ظاهرًا، بما فيه الإجمالي والتاريخ.')}</span></li>
              <li className="flex gap-2"><Camera className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden /><span>{t('على الهاتف، استخدم التصوير لالتقاط نسخة واضحة مباشرة.')}</span></li>
              <li className="flex gap-2"><LockKeyhole className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden /><span>{t('المستندات تُرفع إلى مساحة حسابك الخاصة.')}</span></li>
            </ul>
            <p className="mt-5 border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">{t('إذا تعذرت قراءة خانة بوضوح، سنشير إليها لتراجعها بنفسك قبل الاعتماد.')}</p>
          </aside>
        </div>
      )}
    </WorkspaceFrame>
  );
}
