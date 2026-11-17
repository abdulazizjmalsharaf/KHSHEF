import { useEffect, useMemo, useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { Link, useLocation, useRoute } from 'wouter';
import { AlertCircle, BadgeCheck, Check, CheckCircle2, ChevronLeft, CircleAlert, CircleDollarSign, Clipboard, FileCheck2, FileText, Image, LoaderCircle, LockKeyhole, MessageCircle, PencilLine, ShieldCheck, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useInvoice, useInvoiceDocument, useInvoiceItems, useSaveInvoiceReview, useSetInvoiceStatus } from '@/hooks/use-invoices';
import type { InvoiceCheck, InvoiceExtraction, InvoiceStatus } from '@/lib/invoice-types';
import { PageIntro, QueryProblem, WorkspaceFrame } from '@/pages/invoice-workspace';

const statusLabels: Record<InvoiceStatus, string> = {
  under_review: 'قيد المراجعة',
  matched: 'متطابقة حسابيًا',
  discrepancy: 'تحتاج انتباهك',
  approved: 'معتمدة',
  disputed: 'تم الاعتراض',
};

const statusColor: Record<InvoiceStatus, string> = {
  under_review: 'border-accent/40 bg-accent/10 text-[hsl(30_75%_30%)]',
  matched: 'border-primary/25 bg-primary/10 text-primary',
  discrepancy: 'border-destructive/30 bg-destructive/5 text-destructive',
  approved: 'border-primary/25 bg-primary/10 text-primary',
  disputed: 'border-destructive/30 bg-destructive/5 text-destructive',
};

const currencyName = (currency: string | null | undefined) => currency || 'د.ك';
const moneyFormat = new Intl.NumberFormat('ar-KW', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const money = (value: string | number | null | undefined, currency: string | null | undefined) => {
  if (value === null || value === undefined || value === '') return 'غير واضح';
  const number = Number(value);
  return Number.isFinite(number) ? `${moneyFormat.format(number)} ${currencyName(currency)}` : `${value} ${currencyName(currency)}`;
};
const confidenceLabel = (confidence: number) => `${new Intl.NumberFormat('ar-KW', { maximumFractionDigits: 0 }).format(Math.round(confidence * 100))}٪`;
const lowConfidence = (confidence: number) => confidence < 0.8;
const fieldConfidence = (extraction: InvoiceExtraction) => [
  { key: 'supplierName', label: 'اسم المورد', value: extraction.supplierName, confidence: extraction.supplierNameConfidence, path: 'supplierName' as FieldPath<InvoiceExtraction> },
  { key: 'invoiceNumber', label: 'رقم الفاتورة', value: extraction.invoiceNumber, confidence: extraction.invoiceNumberConfidence, path: 'invoiceNumber' as FieldPath<InvoiceExtraction> },
  { key: 'invoiceDate', label: 'تاريخ الفاتورة', value: extraction.invoiceDate, confidence: extraction.invoiceDateConfidence, path: 'invoiceDate' as FieldPath<InvoiceExtraction> },
  { key: 'currency', label: 'العملة', value: extraction.currency, confidence: extraction.currencyConfidence, path: 'currency' as FieldPath<InvoiceExtraction> },
  { key: 'total', label: 'الإجمالي', value: extraction.total, confidence: extraction.totalConfidence, path: 'total' as FieldPath<InvoiceExtraction> },
];

function markFieldConfirmed(extraction: InvoiceExtraction, fieldKey: string): InvoiceExtraction {
  const next: InvoiceExtraction = {
    ...extraction,
    items: extraction.items.map((item) => ({ ...item })),
    additionalFees: extraction.additionalFees.map((fee) => ({ ...fee })),
    receiptItems: extraction.receiptItems.map((item) => ({ ...item })),
  };
  const confidenceFields: Record<string, keyof InvoiceExtraction> = {
    supplierName: 'supplierNameConfidence',
    invoiceNumber: 'invoiceNumberConfidence',
    invoiceDate: 'invoiceDateConfidence',
    currency: 'currencyConfidence',
    total: 'totalConfidence',
  };
  const confidenceField = confidenceFields[fieldKey];
  if (confidenceField) {
    (next[confidenceField] as number) = 1;
    return next;
  }

  const itemMatch = fieldKey.match(/^item-(\d+)$/);
  if (itemMatch) {
    const item = next.items[Number(itemMatch[1])];
    if (item) {
      item.nameConfidence = 1;
      item.quantityConfidence = 1;
      item.unitConfidence = 1;
      item.unitPriceConfidence = 1;
      item.lineTotalConfidence = 1;
    }
    return next;
  }

  const feeMatch = fieldKey.match(/^fee-(\d+)$/);
  if (feeMatch) {
    const fee = next.additionalFees[Number(feeMatch[1])];
    if (fee) {
      fee.nameConfidence = 1;
      fee.amountConfidence = 1;
    }
    return next;
  }

  const receiptMatch = fieldKey.match(/^receipt-(\d+)$/);
  if (receiptMatch) {
    const receiptItem = next.receiptItems[Number(receiptMatch[1])];
    if (receiptItem) {
      receiptItem.nameConfidence = 1;
      receiptItem.quantityConfidence = 1;
      receiptItem.unitConfidence = 1;
    }
  }
  return next;
}

function percent(value: number | undefined) {
  return typeof value === 'number' ? confidenceLabel(value) : 'غير متاح';
}

function Confidence({ value }: { value: number }) {
  const uncertain = lowConfidence(value);
  return <span className={`inline-flex min-h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold tabular-nums ${uncertain ? 'bg-accent/15 text-[hsl(30_75%_30%)]' : 'bg-primary/10 text-primary'}`} data-testid="text-confidence">
    {uncertain && <CircleAlert className="h-3 w-3" aria-hidden />}{confidenceLabel(value)} ثقة
  </span>;
}

function ConfidenceReview({ fieldKey, label, confidence, acknowledged, onConfirm, onEdit, disabled }: {
  fieldKey: string; label: string; confidence: number; acknowledged: boolean; onConfirm: () => void; onEdit: () => void; disabled?: boolean;
}) {
  if (!lowConfidence(confidence)) return null;
  return (
    <div className={`mt-2 rounded-xl border p-3 ${acknowledged ? 'border-primary/20 bg-primary/[0.035]' : 'border-accent/35 bg-accent/[0.09]'}`} data-testid={`warning-confidence-${fieldKey}`}>
      <div className="flex items-start gap-2">
        {acknowledged ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(30_75%_30%)]" aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">{acknowledged ? `راجعت قراءة ${label}` : `تحقق من ${label}`}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{acknowledged ? 'تم تأكيد القراءة في هذه الجلسة.' : `ثقة القراءة ${confidenceLabel(confidence)}؛ قد تحتاج إلى تصحيح يدوي.`}</p>
          {!acknowledged && <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={onConfirm} disabled={disabled} className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-background px-2.5 text-xs font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" data-testid={`button-confirm-${fieldKey}`}><Check className="h-3.5 w-3.5" aria-hidden /> القراءة صحيحة</button>
            <button type="button" onClick={onEdit} disabled={disabled} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-foreground hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" data-testid={`button-edit-${fieldKey}`}><PencilLine className="h-3.5 w-3.5" aria-hidden /> تعديل</button>
          </div>}
        </div>
      </div>
    </div>
  );
}

function CheckCard({ check, index, onAddPrice }: { check: InvoiceCheck; index: number; onAddPrice?: () => void }) {
  const isDifference = check.severity === 'difference';
  return (
    <article className={`rounded-xl border p-4 ${isDifference ? 'border-destructive/25 bg-destructive/[0.035]' : 'border-accent/30 bg-accent/[0.07]'}`} data-testid={`card-invoice-check-${index}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${isDifference ? 'bg-destructive/10 text-destructive' : 'bg-accent/15 text-[hsl(30_75%_30%)]'}`}>
            {isDifference ? <AlertCircle className="h-4 w-4" aria-hidden /> : <CircleAlert className="h-4 w-4" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold leading-6">{check.title}</h3><p className="mt-1 text-xs leading-6 text-muted-foreground">{check.detail}</p>{onAddPrice && <button type="button" onClick={onAddPrice} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/25 bg-card px-3 text-xs font-semibold text-primary hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`button-check-add-price-${index}`}><CircleDollarSign className="h-3.5 w-3.5" aria-hidden /> تسجيل السعر المتفق عليه</button>}</div>
        </div>
        {check.amountAffected && <span className={`shrink-0 text-left font-mono text-sm font-semibold tabular-nums ${isDifference ? 'text-destructive' : 'text-foreground'}`} dir="ltr" data-testid={`text-check-amount-${index}`}>{money(check.amountAffected, check.currency)}</span>}
      </div>
    </article>
  );
}

function DocumentView({ src, path, loading, error }: { src?: string; path: string; loading: boolean; error: boolean }) {
  const pdf = /\.pdf(?:$|[?#])/i.test(path);
  if (loading) return <div className="grid min-h-[340px] place-items-center rounded-xl bg-muted/70" aria-label="جارٍ تحميل المستند" data-testid="status-document-loading"><div className="space-y-3"><div className="mx-auto h-8 w-8 animate-pulse rounded-lg bg-primary/15" /><div className="h-3 w-36 animate-pulse rounded bg-primary/10" /></div></div>;
  if (error || !src) return <div className="grid min-h-[280px] place-items-center rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center" role="status" data-testid="status-document-error"><div><FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden /><p className="mt-3 text-sm font-medium">تعذر عرض المستند</p><p className="mt-1 text-xs text-muted-foreground">يمكنك متابعة مراجعة الحقول والفحوصات.</p></div></div>;
  return pdf
    ? <iframe title="المستند الأصلي للفاتورة بصيغة PDF" src={src} className="h-[min(72vh,760px)] min-h-[390px] w-full rounded-xl border border-border bg-card" data-testid="document-invoice-pdf" />
    : <div className="grid min-h-[320px] place-items-center overflow-hidden rounded-xl bg-[#ece9e1] p-3 sm:min-h-[480px]" data-testid="document-invoice-image"><img src={src} alt="صورة الفاتورة الأصلية" className="max-h-[72vh] max-w-full object-contain shadow-lg" /></div>;
}

function whatsappMessage(supplier: string | null, invoiceNumber: string | null, checks: InvoiceCheck[], total: string | number | null, currency: string) {
  const reasons = checks.length
    ? checks.map((check) => `• ${check.title}: ${check.detail}${check.amountAffected ? ` (المبلغ المتأثر: ${money(check.amountAffected, check.currency || currency)})` : ''}`).join('\n')
    : '• أحتاج إلى مراجعة تفاصيل الفاتورة قبل الاعتماد.';
  return `السلام عليكم،\n\nأود مراجعة الفاتورة${invoiceNumber ? ` رقم ${invoiceNumber}` : ''}${supplier ? ` من ${supplier}` : ''} قبل اعتمادها.\n\nالملاحظات:\n${reasons}\n\nالإجمالي المسجل: ${money(total, currency)}\n\nيرجى التحقق من التفاصيل وإفادتي. شكرًا لكم.`;
}

export default function InvoiceDetailPage() {
  const [, params] = useRoute('/invoices/:invoiceId');
  const [, setLocation] = useLocation();
  const invoiceId = params?.invoiceId;
  const { user, loading: authLoading } = useAuth();
  const invoiceQuery = useInvoice(invoiceId);
  const itemQuery = useInvoiceItems(invoiceId);
  const invoice = invoiceQuery.data;
  const documentQuery = useInvoiceDocument(invoice?.invoice_path);
  const receiptQuery = useInvoiceDocument(invoice?.receipt_path ?? undefined);
  const saveReview = useSaveInvoiceReview();
  const setInvoiceStatus = useSetInvoiceStatus();
  const [editMode, setEditMode] = useState(false);
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState('');
  const [actionError, setActionError] = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const form = useForm<InvoiceExtraction>({ defaultValues: invoice?.extracted_data });
  const extraction = invoice?.extracted_data;
  const addMissingPrice = (check: InvoiceCheck) => {
    if (!invoice?.supplier_id || !check.itemName) return;
    try {
      sessionStorage.setItem('kashef.pendingSupplierPrice', JSON.stringify({
        supplierId: invoice.supplier_id,
        itemName: check.itemName,
        unit: check.unit ?? '',
        unitPrice: check.suggestedUnitPrice ?? '',
        currency: invoice.currency ?? 'KWD',
      }));
      setLocation('/supplier-prices');
    } catch {
      setActionError('تعذر تجهيز بيانات السعر. انتقل إلى قائمة الأسعار وأضفه يدويًا.');
    }
  };
  const lowFields = useMemo(() => extraction ? fieldConfidence(extraction).filter((field) => lowConfidence(field.confidence)) : [], [extraction]);

  useEffect(() => {
    if (invoice?.extracted_data) form.reset(invoice.extracted_data);
  }, [invoice?.id]); // one initialization per invoice record

  const confirmField = async (key: string) => {
    if (!invoiceId || !extraction) return;
    setSaveError('');
    const confirmed = markFieldConfirmed(form.getValues(), key);
    try {
      await saveReview.mutateAsync({ invoiceId, extraction: confirmed });
      form.reset(confirmed);
      setAcknowledged((current) => ({ ...current, [key]: true }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'تعذر حفظ التأكيد. حاول مرة أخرى.');
    }
  };
  const editField = (path: FieldPath<InvoiceExtraction>) => {
    setEditMode(true);
    window.setTimeout(() => form.setFocus(path), 0);
  };
  const save = form.handleSubmit(async (values) => {
    if (!invoiceId) return;
    setSaveError('');
    const reviewed: InvoiceExtraction = {
      ...values,
      items: values.items.map((item) => ({ ...item })),
      additionalFees: values.additionalFees.map((fee) => ({ ...fee })),
      receiptItems: values.receiptItems.map((item) => ({ ...item })),
    };
    for (const field of fieldConfidence(values)) {
      if (form.getFieldState(field.path).isDirty) {
        const confidenceField = `${field.key}Confidence` as keyof InvoiceExtraction;
        (reviewed[confidenceField] as number) = 1;
      }
    }
    for (let index = 0; index < reviewed.items.length; index += 1) {
      const item = reviewed.items[index];
      const paths = [
        ['name', 'nameConfidence'],
        ['quantity', 'quantityConfidence'],
        ['unit', 'unitConfidence'],
        ['unitPrice', 'unitPriceConfidence'],
        ['lineTotal', 'lineTotalConfidence'],
      ] as const;
      for (const [valueKey, confidenceKey] of paths) {
        const path = `items.${index}.${valueKey}` as FieldPath<InvoiceExtraction>;
        if (form.getFieldState(path).isDirty) item[confidenceKey] = 1;
      }
    }
    for (let index = 0; index < reviewed.additionalFees.length; index += 1) {
      for (const [valueKey, confidenceKey] of [['name', 'nameConfidence'], ['amount', 'amountConfidence']] as const) {
        const path = `additionalFees.${index}.${valueKey}` as FieldPath<InvoiceExtraction>;
        if (form.getFieldState(path).isDirty) reviewed.additionalFees[index][confidenceKey] = 1;
      }
    }
    for (let index = 0; index < reviewed.receiptItems.length; index += 1) {
      for (const [valueKey, confidenceKey] of [['name', 'nameConfidence'], ['quantity', 'quantityConfidence'], ['unit', 'unitConfidence']] as const) {
        const path = `receiptItems.${index}.${valueKey}` as FieldPath<InvoiceExtraction>;
        if (form.getFieldState(path).isDirty) reviewed.receiptItems[index][confidenceKey] = 1;
      }
    }
    try {
      await saveReview.mutateAsync({ invoiceId, extraction: reviewed });
      form.reset(reviewed);
      setEditMode(false);
      setAcknowledged({});
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'تعذر حفظ التعديلات. حاول مرة أخرى.');
    }
  });
  const updateStatus = async (status: 'approved' | 'disputed') => {
    if (!invoiceId) return;
    setActionError('');
    try {
      await setInvoiceStatus.mutateAsync({ invoiceId, status });
      setShowDispute(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'تعذر تحديث حالة الفاتورة.');
    }
  };
  const message = extraction && invoice ? whatsappMessage(invoice.supplier_name, invoice.invoice_number, invoice.checks ?? [], invoice.total_amount, invoice.currency) : '';
  const copyMessage = async () => {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopyError('تعذر النسخ تلقائيًا. حدّد النص وانسخه يدويًا.');
    }
  };

  if (authLoading) return <WorkspaceFrame><div className="h-36 animate-pulse rounded-2xl bg-muted" data-testid="status-detail-auth-loading" /></WorkspaceFrame>;
  if (!user) return <WorkspaceFrame><section className="rounded-2xl border border-border bg-card p-8 text-center" data-testid="state-detail-sign-in"><LockKeyhole className="mx-auto h-8 w-8 text-primary" aria-hidden /><h1 className="mt-3 font-display text-2xl text-primary">ادخل لمراجعة الفاتورة</h1><Link href="/login" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground" data-testid="link-detail-login">الدخول بحساب Google</Link></section></WorkspaceFrame>;

  return (
    <WorkspaceFrame>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/invoices" className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-back-invoices"><ChevronLeft className="h-4 w-4" aria-hidden /> كل الفواتير</Link>
        {invoice && <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold ${statusColor[invoice.status]}`} data-testid="status-current-invoice">{statusLabels[invoice.status]}</span>}
      </div>

      {invoiceQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-label="جارٍ تحميل الفاتورة" data-testid="status-invoice-loading"><div className="h-[480px] animate-pulse rounded-2xl bg-muted" /><div className="h-[480px] animate-pulse rounded-2xl bg-muted" /></div>
      ) : invoiceQuery.isError || !invoice ? (
        <QueryProblem message="تعذر تحميل هذه الفاتورة. قد لا تكون متاحة لحسابك أو قد يكون الاتصال منقطعًا." onRetry={() => void invoiceQuery.refetch()} testId="status-invoice-error" />
      ) : extraction ? (
        <>
          <PageIntro eyebrow={`رقم الفاتورة · ${invoice.invoice_number || 'غير واضح'}`} title={invoice.supplier_name || 'فاتورة مورد'} description="راجع المستند الأصلي والحقول المقروءة. الفحوصات الحسابية توضح ما يستدعي انتباهك، والقرار النهائي لك." />

          <div className="mb-6 grid gap-3 sm:grid-cols-3" data-testid="summary-invoice">
            <SummaryCell label="الإجمالي المسجل" value={money(invoice.total_amount, invoice.currency)} testId="summary-invoice-total" />
            <SummaryCell label="تاريخ الفاتورة" value={formatDate(invoice.invoice_date)} testId="summary-invoice-date" />
            <SummaryCell label="حالة الفحص" value={statusLabels[invoice.status]} testId="summary-invoice-status" />
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="min-w-0 rounded-2xl border border-border/80 bg-card p-4 sm:p-5" data-testid="panel-original-document">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Image className="h-4 w-4 text-primary" aria-hidden /><h2 className="font-display text-xl text-primary">المستند الأصلي</h2></div>
                <span className="text-[11px] text-muted-foreground">خاص بحسابك</span>
              </div>
              <DocumentView src={documentQuery.data} path={invoice.invoice_path} loading={documentQuery.isLoading || (!documentQuery.data && !documentQuery.isError)} error={documentQuery.isError} />
              {invoice.receipt_path && <div className="mt-4 border-t border-border/70 pt-4" data-testid="panel-receipt-document"><h3 className="mb-3 text-sm font-semibold">سند الاستلام أو الطلب</h3><DocumentView src={receiptQuery.data} path={invoice.receipt_path} loading={receiptQuery.isLoading || (!receiptQuery.data && !receiptQuery.isError)} error={receiptQuery.isError} /></div>}
            </section>

            <section className="min-w-0 space-y-4" data-testid="panel-extracted-fields">
              <form onSubmit={save} className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5" data-testid="form-invoice-review">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="font-display text-xl text-primary">الحقول المقروءة</h2><p className="mt-1 text-xs text-muted-foreground">مستوى الثقة ظاهر بجانب كل قراءة.</p></div>
                  {!editMode && <button type="button" onClick={() => setEditMode(true)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-input px-3 text-xs font-semibold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-edit-extraction"><PencilLine className="h-3.5 w-3.5" aria-hidden /> تعديل الحقول</button>}
                </div>
                {lowFields.length > 0 && <div className="mb-4 rounded-xl border border-accent/35 bg-accent/[0.08] p-3 text-xs leading-5 text-[hsl(30_75%_30%)]" data-testid="notice-low-confidence">{lowFields.length} {lowFields.length === 1 ? 'حقل يحتاج' : 'حقول تحتاج'} إلى مراجعتك. راجع التنبيه بجانب كل قراءة.</div>}
                {saveError && <p role="alert" className="mb-3 rounded-lg bg-destructive/5 p-3 text-sm text-destructive" data-testid="status-save-review-error">{saveError}</p>}

                <div className="grid gap-3 sm:grid-cols-2">
                  {fieldConfidence(extraction).map((field) => (
                    <div className="rounded-xl border border-border/70 bg-background p-3" key={field.key} data-testid={`field-extraction-${field.key}`}>
                      <label className="block text-xs text-muted-foreground">{field.label}</label>
                      {editMode ? <input {...form.register(field.path)} className={`mt-1 min-h-10 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${field.key === 'total' ? 'font-mono tabular-nums' : ''}`} dir={field.key === 'total' ? 'ltr' : undefined} data-testid={`input-extraction-${field.key}`} /> : <p className={`mt-1 min-h-7 break-words text-sm font-semibold ${field.key === 'total' ? 'font-mono tabular-nums' : ''}`} dir={field.key === 'total' ? 'ltr' : undefined} data-testid={`text-extraction-${field.key}`}>{field.value || 'غير واضح'}</p>}
                      <div className="mt-2"><Confidence value={field.confidence} /></div>
                      <ConfidenceReview fieldKey={field.key} label={field.label} confidence={field.confidence} acknowledged={Boolean(acknowledged[field.key])} onConfirm={() => void confirmField(field.key)} onEdit={() => editField(field.path)} disabled={saveReview.isPending} />
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-border/70 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">بنود الفاتورة</h3><span className="text-[11px] text-muted-foreground" data-testid="text-saved-item-count">{itemQuery.isLoading ? 'جارٍ تحميل البنود…' : `${new Intl.NumberFormat('ar-KW').format(itemQuery.data?.length ?? extraction.items.length)} بند`}</span></div>
                  {itemQuery.isError && <p className="mb-2 text-xs text-destructive" role="status" data-testid="status-items-load-error">تعذر تحميل البنود المحفوظة؛ المعروض أدناه من قراءة الفاتورة.</p>}
                  {extraction.items.length ? (
                    <div className="space-y-3">
                      {extraction.items.map((item, index) => {
                        const key = item.itemKey || `item-${index}`;
                        const minConfidence = Math.min(item.nameConfidence, item.quantityConfidence, item.unitConfidence, item.unitPriceConfidence, item.lineTotalConfidence);
                        const anyLow = [item.nameConfidence, item.quantityConfidence, item.unitConfidence, item.unitPriceConfidence, item.lineTotalConfidence].some(lowConfidence);
                        const editTarget = [
                          [item.nameConfidence, `items.${index}.name`],
                          [item.quantityConfidence, `items.${index}.quantity`],
                          [item.unitConfidence, `items.${index}.unit`],
                          [item.unitPriceConfidence, `items.${index}.unitPrice`],
                          [item.lineTotalConfidence, `items.${index}.lineTotal`],
                        ].find(([confidence]) => lowConfidence(confidence as number))?.[1] as FieldPath<InvoiceExtraction> | undefined;
                        return <div className="rounded-xl border border-border/70 bg-background p-3" key={key} data-testid={`row-extracted-item-${index}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-muted-foreground">الصنف {index + 1}</p>
                              {editMode ? <input {...form.register(`items.${index}.name` as const)} className="mt-1 min-h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`input-item-name-${index}`} /> : <p className="mt-1 truncate text-sm font-semibold" data-testid={`text-item-name-${index}`}>{item.name || 'اسم غير واضح'}</p>}
                            </div>
                            {editMode ? <input {...form.register(`items.${index}.lineTotal` as const)} aria-label={`مجموع السطر للصنف ${index + 1}`} className="h-9 w-28 rounded-lg border border-input bg-card px-2 text-left font-mono text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr" data-testid={`input-item-line-total-${index}`} /> : <span className="text-left font-mono text-sm font-semibold tabular-nums" dir="ltr" data-testid={`text-item-total-${index}`}>{money(item.lineTotal, extraction.currency)}</span>}
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-center sm:grid-cols-4">
                            <div><span className="block text-[10px] text-muted-foreground">الكمية</span>{editMode ? <input {...form.register(`items.${index}.quantity` as const)} className="mt-1 h-8 w-full rounded-md border border-input bg-card px-1 text-center font-mono text-xs tabular-nums" dir="ltr" data-testid={`input-item-quantity-${index}`} /> : <span className="mt-1 block font-mono text-xs tabular-nums" dir="ltr" data-testid={`text-item-quantity-${index}`}>{item.quantity || '—'} {item.unit || ''}</span>}</div>
                            <div><span className="block text-[10px] text-muted-foreground">الوحدة</span>{editMode ? <input {...form.register(`items.${index}.unit` as const)} aria-label={`وحدة الصنف ${index + 1}`} className="mt-1 h-8 w-full rounded-md border border-input bg-card px-1 text-center text-xs" data-testid={`input-item-unit-${index}`} /> : <span className="mt-1 block text-xs" data-testid={`text-item-unit-${index}`}>{item.unit || '—'}</span>}</div>
                            <div><span className="block text-[10px] text-muted-foreground">سعر الوحدة</span>{editMode ? <input {...form.register(`items.${index}.unitPrice` as const)} className="mt-1 h-8 w-full rounded-md border border-input bg-card px-1 text-center font-mono text-xs tabular-nums" dir="ltr" data-testid={`input-item-unit-price-${index}`} /> : <span className="mt-1 block font-mono text-xs tabular-nums" dir="ltr" data-testid={`text-item-unit-price-${index}`}>{money(item.unitPrice, extraction.currency)}</span>}</div>
                            <div><span className="block text-[10px] text-muted-foreground">الثقة</span><span className={`mt-1 block font-mono text-xs font-semibold tabular-nums ${lowConfidence(minConfidence) ? 'text-[hsl(30_75%_30%)]' : 'text-primary'}`} dir="ltr" data-testid={`text-item-confidence-${index}`}>{percent(minConfidence)}</span></div>
                          </div>
                          {anyLow && <ConfidenceReview fieldKey={`item-${index}`} label={item.name || `الصنف ${index + 1}`} confidence={minConfidence} acknowledged={Boolean(acknowledged[`item-${index}`])} onConfirm={() => void confirmField(`item-${index}`)} onEdit={() => editField(editTarget || (`items.${index}.name` as FieldPath<InvoiceExtraction>))} disabled={saveReview.isPending} />}
                        </div>;
                      })}
                    </div>
                  ) : <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground" data-testid="state-no-invoice-items">لم تُقرأ بنود واضحة من المستند.</p>}
                </div>

                {extraction.additionalFees.length > 0 && <div className="mt-4 border-t border-border/70 pt-4" data-testid="list-additional-fees"><h3 className="mb-2 text-sm font-semibold">رسوم إضافية</h3>{extraction.additionalFees.map((fee, index) => {
                  const confidence = Math.min(fee.nameConfidence, fee.amountConfidence);
                  const editPath = lowConfidence(fee.nameConfidence)
                    ? `additionalFees.${index}.name` as FieldPath<InvoiceExtraction>
                    : `additionalFees.${index}.amount` as FieldPath<InvoiceExtraction>;
                  return <div key={fee.feeKey || index} className="border-b border-border/50 py-3 last:border-0" data-testid={`row-additional-fee-${index}`}>
                    <div className="flex items-center justify-between gap-3">
                      {editMode ? <input {...form.register(`additionalFees.${index}.name` as const)} aria-label={`اسم الرسم ${index + 1}`} className="min-h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm" data-testid={`input-fee-name-${index}`} /> : <span>{fee.name || 'رسوم'}</span>}
                      {editMode ? <input {...form.register(`additionalFees.${index}.amount` as const)} aria-label={`مبلغ الرسم ${index + 1}`} className="min-h-8 w-28 rounded-md border border-input bg-background px-2 text-left font-mono text-sm tabular-nums" dir="ltr" data-testid={`input-fee-amount-${index}`} /> : <span className="font-mono tabular-nums" dir="ltr">{money(fee.amount, extraction.currency)}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2"><Confidence value={confidence} />{lowConfidence(confidence) && <ConfidenceReview fieldKey={`fee-${index}`} label={fee.name || 'الرسم'} confidence={confidence} acknowledged={Boolean(acknowledged[`fee-${index}`])} onConfirm={() => void confirmField(`fee-${index}`)} onEdit={() => editField(editPath)} disabled={saveReview.isPending} />}</div>
                  </div>;
                })}</div>}

                {invoice.receipt_path && <div className="mt-4 border-t border-border/70 pt-4" data-testid="list-receipt-items"><h3 className="mb-2 text-sm font-semibold">كميات سند الاستلام</h3>{extraction.receiptItems.length ? <div className="space-y-2">{extraction.receiptItems.map((item, index) => {
                  const confidence = Math.min(item.nameConfidence, item.quantityConfidence, item.unitConfidence);
                  const editPath = lowConfidence(item.nameConfidence)
                    ? `receiptItems.${index}.name` as FieldPath<InvoiceExtraction>
                    : `receiptItems.${index}.quantity` as FieldPath<InvoiceExtraction>;
                  return <div key={item.itemKey || index} className="rounded-xl border border-border/70 bg-background p-3" data-testid={`row-receipt-item-${index}`}>
                    <div className="grid grid-cols-3 gap-2">
                      {editMode ? <input {...form.register(`receiptItems.${index}.name` as const)} aria-label={`اسم الصنف المستلم ${index + 1}`} className="min-h-8 rounded-md border border-input bg-card px-2 text-xs" data-testid={`input-receipt-item-name-${index}`} /> : <span className="truncate text-xs font-semibold" data-testid={`text-receipt-item-name-${index}`}>{item.name || 'صنف غير واضح'}</span>}
                      {editMode ? <input {...form.register(`receiptItems.${index}.quantity` as const)} aria-label={`كمية الصنف المستلم ${index + 1}`} className="min-h-8 rounded-md border border-input bg-card px-2 text-center font-mono text-xs" dir="ltr" data-testid={`input-receipt-item-quantity-${index}`} /> : <span className="text-center font-mono text-xs tabular-nums" dir="ltr" data-testid={`text-receipt-item-quantity-${index}`}>{item.quantity || '—'} {item.unit || ''}</span>}
                      {editMode ? <input {...form.register(`receiptItems.${index}.unit` as const)} aria-label={`وحدة الصنف المستلم ${index + 1}`} className="min-h-8 rounded-md border border-input bg-card px-2 text-center text-xs" data-testid={`input-receipt-item-unit-${index}`} /> : <span className="text-center text-xs">{item.unit || '—'}</span>}
                    </div>
                    {lowConfidence(confidence) && <ConfidenceReview fieldKey={`receipt-${index}`} label={item.name || `الصنف المستلم ${index + 1}`} confidence={confidence} acknowledged={Boolean(acknowledged[`receipt-${index}`])} onConfirm={() => void confirmField(`receipt-${index}`)} onEdit={() => editField(editPath)} disabled={saveReview.isPending} />}
                  </div>;
                })}</div> : <p className="rounded-xl border border-accent/35 bg-accent/[0.08] p-3 text-xs leading-5 text-muted-foreground" data-testid="state-no-receipt-items">لم تُقرأ كميات واضحة من سند الاستلام؛ راجع الصورة وحاول تعديل الحقول إذا لزم.</p>}</div>}

                {editMode && <div className="mt-5 flex flex-wrap gap-2 border-t border-border/70 pt-4">
                  <button type="submit" disabled={saveReview.isPending} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" data-testid="button-save-extraction">{saveReview.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}{saveReview.isPending ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</button>
                  <button type="button" onClick={() => { form.reset(extraction); setEditMode(false); setSaveError(''); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-input px-4 text-sm font-medium hover:bg-muted" data-testid="button-cancel-extraction-edit"><X className="h-4 w-4" aria-hidden /> إلغاء</button>
                </div>}
              </form>

              <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5" data-testid="panel-invoice-checks">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div><h2 className="font-display text-xl text-primary">نتائج الفحص الحسابي</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">فحوصات ثابتة للأرقام المستخرجة، وليست قرارًا بالنيابة عنك.</p></div>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
                </div>
                {invoice.checks?.length ? (
                  <div>
                    {invoice.checks.some((check) => check.severity === 'difference') ? (
                      <div className="mb-3 flex items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/[0.06] p-4" data-testid="result-invoice-discrepancy">
                        <CircleAlert className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
                        <div><p className="font-semibold text-destructive">توجد فروقات</p><p className="mt-1 text-xs text-muted-foreground">راجع المبلغ المتأثر في كل فحص قبل اتخاذ القرار.</p></div>
                      </div>
                    ) : (
                      <div className="mb-3 flex items-center gap-3 rounded-xl border border-accent/35 bg-accent/[0.09] p-4" data-testid="result-invoice-warnings">
                        <CircleAlert className="h-5 w-5 shrink-0 text-[hsl(30_75%_30%)]" aria-hidden />
                        <div><p className="font-semibold text-[hsl(30_75%_30%)]">ملاحظات للمراجعة</p><p className="mt-1 text-xs text-muted-foreground">هذه تنبيهات للمراجعة وليست فروقات حسابية.</p></div>
                      </div>
                    )}
                    <div className="space-y-2.5">{invoice.checks.map((check, index) => <CheckCard key={`${check.code}-${index}`} check={check} index={index} onAddPrice={check.code === 'missing_agreed_price' && invoice.supplier_id && check.itemName ? () => addMissingPrice(check) : undefined} />)}</div>
                  </div>
                ) : invoice.status === 'matched' || invoice.status === 'approved' ? (
                  <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-4" data-testid="result-invoice-matched"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden /><div><p className="font-semibold text-primary">الفاتورة سليمة</p><p className="mt-1 text-sm leading-6">لم تظهر فروقات في الفحوصات الحسابية ومقارنة المورد.</p></div></div>
                ) : invoice.status === 'under_review' ? (
                  <div className="flex items-start gap-3 rounded-xl border border-accent/35 bg-accent/[0.08] p-4" data-testid="result-invoice-under-review"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(30_75%_30%)]" aria-hidden /><div><p className="font-semibold text-foreground">الفاتورة قيد المراجعة</p><p className="mt-1 text-sm leading-6 text-muted-foreground">لم تكتمل نتيجة الفحص بعد. راجع الحقول المقروءة قبل اتخاذ القرار.</p></div></div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-accent/35 bg-accent/[0.08] p-4" data-testid="result-invoice-needs-review"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(30_75%_30%)]" aria-hidden /><div><p className="font-semibold text-foreground">تحتاج مراجعة الحقول</p><p className="mt-1 text-sm leading-6 text-muted-foreground">لم تظهر فروقات حسابية، لكن بعض القراءات تحتاج تأكيدًا قبل اعتماد الفاتورة.</p></div></div>
                )}
              </section>

              {actionError && <p className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive" role="alert" data-testid="status-invoice-action-error">{actionError}</p>}

              {showDispute ? (
                <section className="rounded-2xl border border-accent/40 bg-card p-4 sm:p-5" data-testid="panel-dispute-message">
                  <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-xl text-primary">رسالة جاهزة للمورد</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">انسخها وراجعها قبل إرسالها بنفسك عبر WhatsApp. لن نرسلها نيابةً عنك.</p></div><button type="button" onClick={() => setShowDispute(false)} aria-label="إغلاق رسالة الاعتراض" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-muted" data-testid="button-close-dispute-message"><X className="h-4 w-4" aria-hidden /></button></div>
                  <textarea readOnly value={message} rows={9} className="mt-4 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="textarea-whatsapp-message" />
                  {copyError && <p className="mt-2 text-xs text-destructive" role="status" data-testid="status-copy-error">{copyError}</p>}
                    <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                      <button type="button" onClick={() => void updateStatus('disputed')} disabled={setInvoiceStatus.isPending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-destructive/30 px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60" data-testid="button-confirm-dispute">{setInvoiceStatus.isPending ? 'جارٍ تحديث الحالة…' : 'تأكيد تسجيل الاعتراض'}</button>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={() => void copyMessage()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground" data-testid="button-copy-whatsapp">{copied ? <Check className="h-4 w-4" aria-hidden /> : <Clipboard className="h-4 w-4" aria-hidden />}{copied ? 'تم نسخ الرسالة' : 'نسخ الرسالة'}</button>
                        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary/25 px-4 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-open-whatsapp"><MessageCircle className="h-4 w-4" aria-hidden /> فتح WhatsApp</a>
                      </div>
                    </div>
                </section>
              ) : (
                <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5" data-testid="panel-invoice-decision">
                  <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileCheck2 className="h-5 w-5" aria-hidden /></span><div><h2 className="font-display text-xl text-primary">قرارك، بعد المراجعة</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">تأكد من الحقول والمبلغ. يمكنك اعتماد الفاتورة أو إعداد رسالة اعتراض للمورد.</p></div></div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => void updateStatus('approved')} disabled={setInvoiceStatus.isPending || invoice.status !== 'matched'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-55" data-testid="button-approve-invoice"><ThumbsUp className="h-4 w-4" aria-hidden />{invoice.status === 'approved' ? 'تم اعتمادها' : 'اعتماد للدفع'}</button>
                    <button type="button" onClick={() => { setShowDispute(true); setCopied(false); setCopyError(''); }} disabled={setInvoiceStatus.isPending || invoice.status === 'disputed'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-background px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-55" data-testid="button-start-dispute"><ThumbsDown className="h-4 w-4" aria-hidden />{invoice.status === 'disputed' ? 'تم تسجيل الاعتراض' : 'إرسال اعتراض للمورد'}</button>
                  </div>
                </section>
              )}
            </section>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground" data-testid="text-review-disclaimer"><LockKeyhole className="h-3.5 w-3.5" aria-hidden /> لا تُرسل أي رسالة تلقائيًا، وأنت صاحب القرار النهائي.</p>
        </>
      ) : <QueryProblem message="بيانات الاستخراج غير متاحة لهذه الفاتورة." onRetry={() => void invoiceQuery.refetch()} />}
    </WorkspaceFrame>
  );
}

function SummaryCell({ label, value, testId }: { label: string; value: string; testId: string }) {
  return <div className="rounded-xl border border-border/80 bg-card px-4 py-3" data-testid={testId}><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm font-semibold tabular-nums" dir="auto">{value}</p></div>;
}

function formatDate(value: string | null) {
  if (!value) return 'غير واضح';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ar-KW', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
