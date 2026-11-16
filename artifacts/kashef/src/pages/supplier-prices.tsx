import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'wouter';
import { AlertCircle, Check, ChevronLeft, CircleDollarSign, PencilLine, Plus, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useDeleteSupplierPrice, useSaveSupplierPrice, useSupplierPrices } from '@/hooks/use-invoices';
import type { SupplierPriceRow } from '@/lib/invoice-types';
import { PageIntro, QueryProblem, WorkspaceFrame } from '@/pages/invoice-workspace';

type PriceFormValues = {
  supplierName: string;
  itemName: string;
  unit: string;
  unitPrice: string;
  currency: string;
};

const blankValues: PriceFormValues = {
  supplierName: '',
  itemName: '',
  unit: '',
  unitPrice: '',
  currency: 'KWD',
};

const supportedCurrencies = [
  { value: 'KWD', label: 'دينار كويتي · KWD' },
  { value: 'SAR', label: 'ريال سعودي · SAR' },
  { value: 'BHD', label: 'دينار بحريني · BHD' },
  { value: 'USD', label: 'دولار أمريكي · USD' },
];

function formatPrice(price: string | number, currency: string) {
  const digits = currency === 'KWD' || currency === 'BHD' ? 3 : 2;
  const amount = Number(price);
  if (!Number.isFinite(amount)) return `${price} ${currency}`;
  return `${new Intl.NumberFormat('ar-KW', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)} ${currency}`;
}

function supplierPriceValues(row: SupplierPriceRow): PriceFormValues {
  return {
    supplierName: row.supplier_name,
    itemName: row.item_name,
    unit: row.unit ?? '',
    unitPrice: String(row.unit_price),
    currency: row.currency || 'KWD',
  };
}

export default function SupplierPricesPage() {
  const { user, loading: authLoading } = useAuth();
  const prices = useSupplierPrices(user?.id);
  const savePrice = useSaveSupplierPrice(user?.id ?? '');
  const deletePrice = useDeleteSupplierPrice(user?.id);
  const [editing, setEditing] = useState<SupplierPriceRow | null>(null);
  const [deleting, setDeleting] = useState<SupplierPriceRow | null>(null);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const form = useForm<PriceFormValues>({ defaultValues: blankValues });

  const resetForm = () => {
    form.reset(blankValues);
    setEditing(null);
    setFormError('');
    setSavedNotice('');
  };

  const startEdit = (row: SupplierPriceRow) => {
    setEditing(row);
    form.reset(supplierPriceValues(row));
    setFormError('');
    setSavedNotice('');
    setActionError('');
  };

  const submit = form.handleSubmit(async (values) => {
    setFormError('');
    setSavedNotice('');
    setActionError('');
    try {
      const saved = await savePrice.mutateAsync({
        supplierName: values.supplierName,
        itemName: values.itemName,
        unit: values.unit,
        unitPrice: values.unitPrice,
        currency: values.currency || 'KWD',
      });
      if (editing && saved.id !== editing.id) {
        try {
          await deletePrice.mutateAsync(editing.id);
        } catch {
          setActionError('تم حفظ السعر الجديد، لكن تعذر حذف السجل السابق. راجعه في القائمة وأزله عند التأكد.');
          setSavedNotice('تم حفظ السعر المعدّل.');
          resetForm();
          return;
        }
      }
      setSavedNotice(editing ? 'تم تحديث السعر المتفق عليه.' : 'تمت إضافة السعر المتفق عليه.');
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'تعذر حفظ السعر. تحقق من البيانات ثم حاول مجددًا.');
    }
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    setActionError('');
    try {
      await deletePrice.mutateAsync(deleting.id);
      if (editing?.id === deleting.id) resetForm();
      setSavedNotice('تم حذف السعر المتفق عليه.');
      setDeleting(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'تعذر حذف السعر. حاول مرة أخرى.');
    }
  };

  const busy = savePrice.isPending || deletePrice.isPending;

  return (
    <WorkspaceFrame>
      <div className="mb-5">
        <Link href="/invoices" className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-back-to-invoices"><ChevronLeft className="h-4 w-4" aria-hidden /> العودة إلى الفواتير</Link>
      </div>
      <PageIntro
        eyebrow="مرجع الأسعار"
        title="أسعار متفق عليها"
        description="احفظ سعر الصنف لكل مورد ووحدة. يستخدم كاشف هذا المرجع للمساعدة في إظهار فروقات السعر أثناء المراجعة."
        action={<span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.045] px-4 text-xs font-semibold text-primary" data-testid="badge-price-currency-default"><CircleDollarSign className="h-4 w-4" aria-hidden /> الدينار الكويتي هو الافتراضي</span>}
      />

      {authLoading ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]" aria-label="جارٍ التحقق من الحساب" data-testid="status-prices-auth-loading">
          <div className="h-80 animate-pulse rounded-2xl bg-muted" />
          <div className="h-80 animate-pulse rounded-2xl bg-muted" />
        </section>
      ) : !user ? (
        <section className="rounded-3xl border border-border bg-card px-6 py-12 text-center" data-testid="state-prices-sign-in">
          <ShieldCheck className="mx-auto h-9 w-9 text-primary" aria-hidden />
          <h2 className="mt-4 font-display text-2xl text-primary">الأسعار محفوظة في مساحتك</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">ادخل إلى حسابك للوصول إلى أسعار الموردين الخاصة بك.</p>
          <Link href="/login" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground" data-testid="link-prices-login">الدخول بحساب Google</Link>
        </section>
      ) : prices.isLoading ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]" aria-label="جارٍ تحميل أسعار الموردين" data-testid="status-prices-loading">
          <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
        </section>
      ) : prices.isError ? (
        <QueryProblem message="تعذر تحميل الأسعار المتفق عليها. أعد المحاولة؛ لن نعرض بيانات غير مؤكدة." onRetry={() => void prices.refetch()} testId="status-prices-error" />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
          <section className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 lg:sticky lg:top-5" data-testid="panel-price-form">
            <div className="mb-5 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Plus className="h-5 w-5" aria-hidden /></span>
              <div>
                <h2 className="font-display text-xl text-primary" data-testid="heading-price-form">{editing ? 'تعديل السعر' : 'إضافة سعر متفق عليه'}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">سعر لكل مورد وصنف ووحدة قياس.</p>
              </div>
            </div>
            <form onSubmit={submit} className="space-y-4" aria-busy={savePrice.isPending} data-testid="form-supplier-price">
              <div>
                <label htmlFor="price-supplier" className="mb-1.5 block text-sm font-medium">اسم المورد</label>
                <input id="price-supplier" autoComplete="organization" {...form.register('supplierName', { required: 'أدخل اسم المورد.' })} placeholder="مثال: شركة المواد الغذائية" className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="input-price-supplier" />
                {form.formState.errors.supplierName && <p className="mt-1 text-xs text-destructive" data-testid="error-price-supplier">{form.formState.errors.supplierName.message}</p>}
              </div>
              <div>
                <label htmlFor="price-item" className="mb-1.5 block text-sm font-medium">اسم الصنف</label>
                <input id="price-item" {...form.register('itemName', { required: 'أدخل اسم الصنف.' })} placeholder="مثال: زيت زيتون" className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="input-price-item" />
                {form.formState.errors.itemName && <p className="mt-1 text-xs text-destructive" data-testid="error-price-item">{form.formState.errors.itemName.message}</p>}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(100px,.7fr)] gap-3">
                <div>
                  <label htmlFor="price-unit" className="mb-1.5 block text-sm font-medium">الوحدة</label>
                  <input id="price-unit" {...form.register('unit', { required: 'أدخل وحدة القياس.' })} placeholder="كرتون، كغ، لتر…" className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="input-price-unit" />
                  {form.formState.errors.unit && <p className="mt-1 text-xs text-destructive" data-testid="error-price-unit">{form.formState.errors.unit.message}</p>}
                </div>
                <div>
                  <label htmlFor="price-currency" className="mb-1.5 block text-sm font-medium">العملة</label>
                  <select id="price-currency" {...form.register('currency', { required: true })} className="min-h-11 w-full rounded-xl border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="select-price-currency">
                    {supportedCurrencies.map((currency) => <option key={currency.value} value={currency.value}>{currency.value}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="price-unit-price" className="mb-1.5 block text-sm font-medium">السعر المتفق عليه للوحدة</label>
                <div className="relative">
                  <input id="price-unit-price" type="number" inputMode="decimal" min="0" step="0.001" {...form.register('unitPrice', { required: 'أدخل السعر المتفق عليه.', validate: (value) => (Number.isFinite(Number(value)) && Number(value) >= 0) || 'أدخل مبلغًا صحيحًا غير سالب.' })} placeholder="0.000" className="min-h-12 w-full rounded-xl border border-input bg-background px-3 pl-14 text-left font-mono text-lg tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr" data-testid="input-price-unit-price" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground" data-testid="text-price-currency-suffix">{form.watch('currency') || 'KWD'}</span>
                </div>
                {form.formState.errors.unitPrice && <p className="mt-1 text-xs text-destructive" data-testid="error-price-unit-price">{form.formState.errors.unitPrice.message}</p>}
              </div>

              {formError && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-5 text-destructive" data-testid="status-price-save-error"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{formError}</p>}
              {actionError && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-5 text-destructive" data-testid="status-price-action-error">{actionError}</p>}
              {savedNotice && <p role="status" className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-sm text-primary" data-testid="status-price-saved">{savedNotice}</p>}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
                {editing && <button type="button" onClick={resetForm} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input px-4 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50" data-testid="button-cancel-price-edit"><X className="h-4 w-4" aria-hidden /> إلغاء التعديل</button>}
                <button type="submit" disabled={busy} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60" data-testid="button-save-supplier-price">
                  {savePrice.isPending ? <span className="h-4 w-4 animate-pulse rounded-full border-2 border-primary-foreground border-t-transparent" aria-hidden /> : editing ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                  {savePrice.isPending ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديل' : 'إضافة السعر'}
                </button>
              </div>
            </form>
          </section>

          <section className="min-w-0" data-testid="section-supplier-prices">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><h2 className="font-display text-xl text-primary">قائمة الأسعار</h2><p className="mt-1 text-xs text-muted-foreground">مرجع المورد والصنف والوحدة.</p></div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary tabular-nums" data-testid="text-price-count">{new Intl.NumberFormat('ar-KW').format(prices.data?.length ?? 0)} سعر</span>
            </div>

            {deleting && (
              <div className="mb-3 flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between" role="alert" data-testid={`confirm-delete-price-${deleting.id}`}>
                <p className="text-sm leading-6">حذف سعر <strong>{deleting.item_name}</strong> لدى <strong>{deleting.supplier_name}</strong>؟</p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => setDeleting(null)} disabled={deletePrice.isPending} className="min-h-9 rounded-lg border border-input px-3 text-xs font-semibold hover:bg-muted" data-testid="button-cancel-delete-price">إبقاء السعر</button>
                  <button type="button" onClick={() => void confirmDelete()} disabled={deletePrice.isPending} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:opacity-60" data-testid="button-confirm-delete-price">{deletePrice.isPending ? 'جارٍ الحذف…' : <><Trash2 className="h-3.5 w-3.5" aria-hidden /> تأكيد الحذف</>}</button>
                </div>
              </div>
            )}

            {!prices.data?.length ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center sm:py-14" data-testid="state-supplier-prices-empty">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><CircleDollarSign className="h-6 w-6" aria-hidden /></div>
                <h3 className="mt-4 font-display text-xl text-primary">لا توجد أسعار محفوظة</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">أضف أول سعر متفق عليه بينك وبين المورد. سيبقى مرتبطًا بحسابك ويظهر هنا عند تحميله بنجاح.</p>
                <button type="button" onClick={() => document.getElementById('price-supplier')?.focus()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground" data-testid="button-add-first-price"><Plus className="h-4 w-4" aria-hidden /> إضافة سعر</button>
              </div>
            ) : (
              <div className="space-y-3">
                {prices.data.map((row) => (
                  <article key={row.id} className={`rounded-2xl border bg-card p-4 transition-colors sm:p-5 ${editing?.id === row.id ? 'border-primary/40 ring-1 ring-primary/10' : 'border-border/80'}`} data-testid={`card-supplier-price-${row.id}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-xs text-muted-foreground" data-testid={`text-price-supplier-${row.id}`}>{row.supplier_name}</p>
                        <h3 className="mt-1 text-base font-semibold" data-testid={`text-price-item-${row.id}`}>{row.item_name}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span data-testid={`text-price-unit-${row.id}`}>لكل {row.unit || 'وحدة غير محددة'}</span>
                          <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
                          <span data-testid={`text-price-updated-${row.id}`}>آخر تحديث: {formatUpdatedAt(row.updated_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <p className="text-left font-mono text-xl font-semibold tabular-nums text-primary sm:min-w-32" dir="ltr" data-testid={`text-price-value-${row.id}`}>{formatPrice(row.unit_price, row.currency || 'KWD')}<span className="mt-1 block text-[10px] font-sans font-normal text-muted-foreground">للوحدة</span></p>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => startEdit(row)} aria-label={`تعديل سعر ${row.item_name} لدى ${row.supplier_name}`} className="grid h-10 w-10 place-items-center rounded-lg border border-border text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`button-edit-price-${row.id}`}><PencilLine className="h-4 w-4" aria-hidden /></button>
                          <button type="button" onClick={() => { setDeleting(row); setActionError(''); }} aria-label={`حذف سعر ${row.item_name} لدى ${row.supplier_name}`} className="grid h-10 w-10 place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive/25 hover:bg-destructive/5 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`button-delete-price-${row.id}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 text-xs leading-5 text-muted-foreground" data-testid="notice-price-privacy">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              الأسعار تُحمّل من سجلات حسابك المحمية بسياسات قاعدة البيانات. إذا تعذّر التحميل، لن نعرض قائمة بديلة أو بيانات تجريبية.
            </div>
          </section>
        </div>
      )}

      {prices.isSuccess && <p className="mt-7 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground" data-testid="text-price-reference-note"><RotateCcw className="h-3.5 w-3.5" aria-hidden /> يمكنك تعديل المرجع أو حذفه في أي وقت.</p>}
    </WorkspaceFrame>
  );
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير معروف';
  return new Intl.DateTimeFormat('ar-KW', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}
