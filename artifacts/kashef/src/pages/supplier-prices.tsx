import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  CircleDollarSign,
  FileSpreadsheet,
  Image as ImageIcon,
  PencilLine,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  useDeleteSupplierPrice,
  useSaveSupplierPrice,
  useSupplierPrices,
} from "@/hooks/use-invoices";
import {
  useImportSupplierPriceList,
  useSaveSupplierPriceImport,
  useSuppliers,
} from "@/hooks/use-suppliers";
import type { SupplierPriceRow } from "@/lib/invoice-types";
import { getLanguage, t } from "@/lib/i18n";
import {
  PageIntro,
  QueryProblem,
  WorkspaceFrame,
} from "@/pages/invoice-workspace";

type PriceForm = {
  supplierId: string;
  itemName: string;
  unit: string;
  unitPrice: string;
  currency: string;
};
type ReviewRow = {
  key: string;
  itemName: string;
  unit: string;
  unitPrice: string;
  confidence: number;
};
type PendingSupplierPrice = {
  supplierId: string;
  itemName: string;
  unit: string;
  unitPrice: string;
  currency: string;
};
const blankForm: PriceForm = {
  supplierId: "",
  itemName: "",
  unit: "",
  unitPrice: "",
  currency: "KWD",
};
const currencies = ["KWD", "SAR", "BHD", "USD"];

function formatPrice(price: string | number, currency: string) {
  const digits = currency === "KWD" || currency === "BHD" ? 3 : 2;
  const amount = Number(price);
  return Number.isFinite(amount)
     ? `${new Intl.NumberFormat(getLanguage() === "ar" ? "ar-KW" : "en-KW", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)} ${currency}`
    : `${price} ${currency}`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? t("غير معروف")
    : new Intl.DateTimeFormat(getLanguage() === "ar" ? "ar-KW" : "en-KW", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

export default function SupplierPricesPage() {
  const { user, loading: authLoading } = useAuth();
  const prices = useSupplierPrices(user?.id);
  const suppliers = useSuppliers(user?.id);
  const savePrice = useSaveSupplierPrice(user?.id ?? "");
  const deletePrice = useDeleteSupplierPrice(user?.id);
  const importList = useImportSupplierPriceList(user?.id, Boolean(user?.is_anonymous));
  const saveImport = useSaveSupplierPriceImport(user?.id);
  const [editing, setEditing] = useState<SupplierPriceRow | null>(null);
  const [deleting, setDeleting] = useState<SupplierPriceRow | null>(null);
  const [form, setForm] = useState<PriceForm>(blankForm);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [importSupplierId, setImportSupplierId] = useState("");
  const [confirmedKwd, setConfirmedKwd] = useState(false);
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [pendingCarryover, setPendingCarryover] =
    useState<PendingSupplierPrice | null>(null);

  useEffect(() => {
    if (
      !file ||
      (!file.type.startsWith("image/") &&
        !/\.(jpe?g|png|webp)$/i.test(file.name))
    ) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const key = "kashef.pendingSupplierPrice";
    let raw: string | null;
    try {
      raw = sessionStorage.getItem(key);
      if (raw === null) return;
      sessionStorage.removeItem(key);
    } catch {
      setFormError(t("تعذر الوصول إلى بيانات السعر المنقولة من الفاتورة."));
      return;
    }
    try {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object") {
        setFormError(t("تعذر قراءة بيانات السعر المنقولة من الفاتورة."));
        return;
      }
      const pending = value as Record<string, unknown>;
      setPendingCarryover({
        supplierId: typeof pending.supplierId === "string" ? pending.supplierId : "",
        itemName: typeof pending.itemName === "string" ? pending.itemName : "",
        unit: typeof pending.unit === "string" ? pending.unit : "",
        unitPrice:
          typeof pending.unitPrice === "string" || typeof pending.unitPrice === "number"
            ? String(pending.unitPrice)
            : "",
        currency: typeof pending.currency === "string" ? pending.currency : "KWD",
      });
    } catch {
      setFormError(t("تعذر قراءة بيانات السعر المنقولة من الفاتورة."));
    }
  }, []);

  useEffect(() => {
    if (!pendingCarryover || suppliers.isLoading) return;
    if (suppliers.isError) {
      setForm({
        supplierId: "",
        itemName: pendingCarryover.itemName.trim(),
        unit: pendingCarryover.unit,
        unitPrice: pendingCarryover.unitPrice,
        currency: pendingCarryover.currency || "KWD",
      });
      setFormError(t("تعذر تحميل الموردين. بقيت بيانات الصنف والسعر؛ أعد تحميل القائمة ثم اختر المورد."));
      setNotice(t("نُقلت بيانات السعر من الفاتورة؛ راجعها قبل الحفظ."));
      setPendingCarryover(null);
      return;
    }
    const matchingSupplier = suppliers.data?.find(
      (supplier) => supplier.id === pendingCarryover.supplierId,
    );
    const validItemName = Boolean(pendingCarryover.itemName.trim());
    setForm({
      supplierId: matchingSupplier?.id ?? "",
      itemName: validItemName ? pendingCarryover.itemName : "",
      unit: pendingCarryover.unit,
      unitPrice: pendingCarryover.unitPrice,
      currency: pendingCarryover.currency || "KWD",
    });
    setEditing(null);
    setFormError(
      !validItemName
        ? t("اسم الصنف غير صالح. أدخله يدويًا قبل حفظ السعر.")
        : !matchingSupplier
          ? t("لم نعثر على المورد المحفوظ لهذه الفاتورة. اختر المورد الصحيح قبل الحفظ.")
          : "",
    );
    setNotice(t("نُقلت بيانات السعر من الفاتورة؛ راجعها قبل الحفظ."));
    setPendingCarryover(null);
  }, [pendingCarryover, suppliers.isLoading, suppliers.isError]);

  const resetForm = () => {
    setEditing(null);
    setForm(blankForm);
    setFormError("");
  };

  const startEdit = (row: SupplierPriceRow) => {
    setEditing(row);
    setForm({
      supplierId: row.supplier_id ?? "__unlinked",
      itemName: row.item_name,
      unit: row.unit ?? "",
      unitPrice: String(row.unit_price),
      currency: row.currency || "KWD",
    });
    setFormError("");
    setNotice("");
    setActionError("");
  };

  const submitPrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setNotice("");
    setActionError("");
    const supplier = suppliers.data?.find(
      (entry) => entry.id === form.supplierId,
    );
    const keepUnlinked = Boolean(
      editing && (!form.supplierId || form.supplierId === "__unlinked"),
    );
    if (!supplier && !keepUnlinked) {
      setFormError(t("اختر موردًا محفوظًا لربط السعر به."));
      return;
    }
    try {
      await savePrice.mutateAsync({
        id: editing?.id,
        supplierName: supplier?.name ?? editing?.supplier_name ?? "",
        supplierId: supplier?.id ?? null,
        itemName: form.itemName,
        unit: form.unit,
        unitPrice: form.unitPrice,
        currency: form.currency,
      });
      setNotice(
        editing
          ? t("تم تحديث السعر المتفق عليه.")
          : t("تمت إضافة السعر المتفق عليه."),
      );
      resetForm();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? t(error.message)
          : t("تعذر حفظ السعر. تحقق من البيانات ثم حاول مجددًا."),
      );
    }
  };

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    event.currentTarget.value = "";
    setFile(selected);
    setReviewRows([]);
    setReviewed(false);
    setConfirmedKwd(false);
    setImportError("");
    setImportNotice("");
    importList.reset();
  };

  const runImport = async () => {
    if (!file) return;
    setImportError("");
    setImportNotice("");
    setReviewed(false);
    try {
      const result = await importList.mutateAsync(file);
      setReviewRows(
        result.items.map((item, index) => ({
          key: `${Date.now()}-${index}`,
          itemName: item.itemName,
          unit: item.unit ?? "",
          unitPrice: item.unitPrice ?? "",
          confidence: item.confidence,
        })),
      );
      const matched = suppliers.data?.find(
        (entry) =>
          entry.name.trim().toLocaleLowerCase() ===
          result.supplierName?.trim().toLocaleLowerCase(),
      );
      setImportSupplierId(matched?.id ?? "");
      setImportNotice(
        t("اكتملت القراءة. راجع الصفوف قبل اعتمادها؛ لم يتم حفظ أي سعر."),
      );
    } catch (error) {
      setImportError(
        error instanceof Error
          ? t(error.message)
          : t("تعذرت قراءة الملف. تحقق منه وحاول مرة أخرى."),
      );
    }
  };

  const confirmReview = () => {
    if (!reviewRows.length) {
      setImportError(t("أبقِ صفًا واحدًا على الأقل قبل متابعة المراجعة."));
      return;
    }
    setReviewed(true);
    setImportError("");
    setImportNotice(
      t("أصبحت الصفوف جاهزة للتحرير. راجع كل اسم ووحدة وسعر قبل الحفظ."),
    );
  };

  const saveReviewedImport = async () => {
    setImportError("");
    setImportNotice("");
    if (!reviewed) {
      setImportError(t("راجع القائمة أولًا قبل الحفظ."));
      return;
    }
    if (!importSupplierId) {
      setImportError(t("اختر المورد المحفوظ الذي تخصه هذه الأسعار."));
      return;
    }
    if (!confirmedKwd) {
      setImportError(t("أكد أن جميع المبالغ بالدينار الكويتي قبل الحفظ."));
      return;
    }
    if (
      reviewRows.some(
        (row) =>
          !row.itemName.trim() ||
          !row.unitPrice.trim() ||
          !/^\d+(?:\.\d{1,6})?$/.test(row.unitPrice),
      )
    ) {
      setImportError(
        t("أكمل اسم الصنف وسعرًا صحيحًا لكل صف، أو أزل الصفوف غير المكتملة."),
      );
      return;
    }
    try {
      const count = await saveImport.mutateAsync({
        supplierId: importSupplierId,
        items: reviewRows.map(({ itemName, unit, unitPrice }) => ({
          itemName,
          unit: unit.trim() || null,
          unitPrice,
        })),
        confirmedKwd: true,
      });
      setImportNotice(
        getLanguage() === "ar"
          ? `تم حفظ ${new Intl.NumberFormat("ar-KW").format(count)} سعرًا بالدينار الكويتي للمورد المختار.`
          : `Saved ${new Intl.NumberFormat("en-KW").format(count)} KWD prices for the selected supplier.`,
      );
      setReviewRows([]);
      setReviewed(false);
      setConfirmedKwd(false);
      setFile(null);
      setImportSupplierId("");
      importList.reset();
    } catch (error) {
      setImportError(
        error instanceof Error
          ? t(error.message)
          : t("تعذر حفظ القائمة كاملة. لم يتم حفظ أي صف؛ حاول مرة أخرى."),
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setActionError("");
    try {
      await deletePrice.mutateAsync(deleting.id);
      if (editing?.id === deleting.id) resetForm();
      setNotice(t("تم حذف السعر المتفق عليه."));
      setDeleting(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? t(error.message)
          : t("تعذر حذف السعر. حاول مرة أخرى."),
      );
    }
  };

  const busy = savePrice.isPending || deletePrice.isPending;
  const importResult = importList.data;
  const currencyIsKwd = importResult?.currency?.trim().toUpperCase() === "KWD";

  return (
    <WorkspaceFrame>
      <div className="mb-5">
        <Link
          href="/invoices"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="link-back-to-invoices"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> العودة إلى الفواتير
        </Link>
      </div>
      <PageIntro
        eyebrow="مرجع الأسعار"
        title="أسعار متفق عليها"
        description="احتفظ بسعر الصنف لكل مورد ووحدة. راجع القائمة قبل اعتمادها لتكون مرجعًا واضحًا عند فحص الفاتورة."
        action={
          <span
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.045] px-4 text-xs font-semibold text-primary"
            data-testid="badge-price-currency-default"
          >
            <CircleDollarSign className="h-4 w-4" aria-hidden /> الدينار الكويتي
            هو الافتراضي
          </span>
        }
      />

      {authLoading ? (
        <section
          className="grid gap-4 lg:grid-cols-2"
          aria-label="جارٍ التحقق من الحساب"
          data-testid="status-prices-auth-loading"
        >
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </section>
      ) : !user ? (
        <section
          className="rounded-3xl border border-border bg-card px-6 py-12 text-center"
          data-testid="state-prices-sign-in"
        >
          <ShieldCheck className="mx-auto h-9 w-9 text-primary" aria-hidden />
          <h2 className="mt-4 font-display text-2xl text-primary">
            الأسعار محفوظة في مساحتك
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            ادخل إلى حسابك للوصول إلى مرجع الأسعار الخاص بك.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
            data-testid="link-prices-login"
          >
            الدخول بحسابك
          </Link>
        </section>
      ) : prices.isLoading || suppliers.isLoading ? (
        <section
          className="grid gap-4 lg:grid-cols-2"
          aria-label="جارٍ تحميل بيانات الأسعار والموردين"
          data-testid="status-prices-loading"
        >
          <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
        </section>
      ) : prices.isError ? (
        <QueryProblem
          message="تعذر تحميل الأسعار المتفق عليها. أعد المحاولة؛ لن نعرض بيانات غير مؤكدة."
          onRetry={() => void prices.refetch()}
          testId="status-prices-error"
        />
      ) : suppliers.isError ? (
        <QueryProblem
          message="تعذر تحميل قائمة الموردين المطلوبة لربط الأسعار."
          onRetry={() => void suppliers.refetch()}
          testId="status-price-suppliers-error"
        />
      ) : (
        <div className="space-y-6">
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,.78fr)_minmax(0,1.22fr)]">
            <section
              className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 lg:sticky lg:top-5"
              data-testid="panel-price-form"
            >
              <div className="mb-5 flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <Plus className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2
                    className="font-display text-xl text-primary"
                    data-testid="heading-price-form"
                  >
                    {editing ? "تعديل السعر" : "إضافة سعر متفق عليه"}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    الأسعار الجديدة ترتبط بمورد محفوظ.
                  </p>
                </div>
              </div>
              {!suppliers.data?.length && (
                <p
                  className="mb-4 rounded-xl border border-accent/35 bg-accent/10 p-3 text-sm leading-6"
                  data-testid="notice-no-saved-suppliers"
                >
                  أضف موردًا أولًا قبل تسجيل سعر جديد.{" "}
                  <Link
                    href="/suppliers"
                    className="font-semibold text-primary underline underline-offset-2"
                    data-testid="link-add-supplier-from-price"
                  >
                    إدارة الموردين
                  </Link>
                </p>
              )}
              <form
                onSubmit={(event) => void submitPrice(event)}
                className="space-y-4"
                aria-busy={savePrice.isPending}
                data-testid="form-supplier-price"
              >
                <div>
                  <label
                    htmlFor="price-supplier"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    المورد
                  </label>
                  <select
                    id="price-supplier"
                    value={form.supplierId}
                    onChange={(event) =>
                      setForm({ ...form, supplierId: event.target.value })
                    }
                    required={!editing}
                    className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="select-price-supplier"
                  >
                    <option value="">اختر موردًا محفوظًا</option>
                    {editing && !editing.supplier_id && (
                      <option value="__unlinked" data-no-translate>
                        {`${t("غير مرتبط")} · ${editing.supplier_name}`}
                      </option>
                    )}
                    {suppliers.data?.map((supplier) => (
                      <option key={supplier.id} value={supplier.id} data-no-translate>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  {editing && !editing.supplier_id && (
                    <p
                      className="mt-1 text-xs text-muted-foreground"
                      data-testid="text-price-unlinked-edit"
                    >
                      يمكن حفظ التعديل دون ربط السعر، أو اختيار مورد لإعادة
                      ربطه.
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="price-item"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    اسم الصنف
                  </label>
                  <input
                    id="price-item"
                    value={form.itemName}
                    onChange={(event) =>
                      setForm({ ...form, itemName: event.target.value })
                    }
                    required
                    placeholder="مثال: زيت زيتون"
                    className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="input-price-item"
                  />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(100px,.72fr)] gap-3">
                  <div>
                    <label
                      htmlFor="price-unit"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      الوحدة
                    </label>
                    <input
                      id="price-unit"
                      value={form.unit}
                      onChange={(event) =>
                        setForm({ ...form, unit: event.target.value })
                      }
                      placeholder="كرتون، كغ، لتر…"
                      className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-testid="input-price-unit"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="price-currency"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      العملة
                    </label>
                    <select
                      id="price-currency"
                      value={form.currency}
                      onChange={(event) =>
                        setForm({ ...form, currency: event.target.value })
                      }
                      className="min-h-11 w-full rounded-xl border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-testid="select-price-currency"
                    >
                      {!currencies.includes(form.currency) && form.currency && (
                        <option value={form.currency}>{form.currency}</option>
                      )}
                      {currencies.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="price-unit-price"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    السعر المتفق عليه للوحدة
                  </label>
                  <div className="relative">
                    <input
                      id="price-unit-price"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.001"
                      value={form.unitPrice}
                      onChange={(event) =>
                        setForm({ ...form, unitPrice: event.target.value })
                      }
                      required
                      placeholder="0.000"
                      className="min-h-12 w-full rounded-xl border border-input bg-background px-3 pl-14 text-left font-mono text-lg tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      dir="ltr"
                      data-testid="input-price-unit-price"
                    />
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground"
                      data-testid="text-price-currency-suffix"
                    >
                      {form.currency}
                    </span>
                  </div>
                </div>
                {formError && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-5 text-destructive"
                    data-testid="status-price-save-error"
                  >
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden
                    />
                    {formError}
                  </p>
                )}
                {actionError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-5 text-destructive"
                    data-testid="status-price-action-error"
                  >
                    {actionError}
                  </p>
                )}
                {notice && (
                  <p
                    role="status"
                    className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-sm text-primary"
                    data-testid="status-price-saved"
                  >
                    {notice}
                  </p>
                )}
                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
                  {editing && (
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={busy}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input px-4 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                      data-testid="button-cancel-price-edit"
                    >
                      <X className="h-4 w-4" aria-hidden /> إلغاء التعديل
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busy || (!editing && !suppliers.data?.length)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-60"
                    data-testid="button-save-supplier-price"
                  >
                    {savePrice.isPending ? (
                      <span
                        className="h-4 w-4 animate-pulse rounded-full border-2 border-primary-foreground border-t-transparent"
                        aria-hidden
                      />
                    ) : editing ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden />
                    )}
                    {savePrice.isPending
                      ? "جارٍ الحفظ…"
                      : editing
                        ? "حفظ التعديل"
                        : "إضافة السعر"}
                  </button>
                </div>
              </form>
            </section>
            <section className="min-w-0" data-testid="section-supplier-prices">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl text-primary">
                    قائمة الأسعار
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    تشمل السجلات القديمة غير المرتبطة.
                  </p>
                </div>
                <span
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary tabular-nums"
                  data-testid="text-price-count"
                >
                  {new Intl.NumberFormat(getLanguage() === "ar" ? "ar-KW" : "en-KW").format(
                    prices.data?.length ?? 0,
                  )}{" "}
                  سعر
                </span>
              </div>
              {deleting && (
                <div
                  className="mb-3 flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between"
                  role="alert"
                  data-testid={`confirm-delete-price-${deleting.id}`}
                >
                  <p className="text-sm leading-6">
                    {t("حذف سعر")} <strong data-no-translate>{deleting.item_name}</strong> {t("لدى")}{" "}
                    <strong data-no-translate>{deleting.supplier_name}</strong>؟
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleting(null)}
                      disabled={deletePrice.isPending}
                      className="min-h-9 rounded-lg border border-input px-3 text-xs font-semibold hover:bg-muted"
                      data-testid="button-cancel-delete-price"
                    >
                      إبقاء السعر
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmDelete()}
                      disabled={deletePrice.isPending}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
                      data-testid="button-confirm-delete-price"
                    >
                      {deletePrice.isPending ? (
                        "جارٍ الحذف…"
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden /> تأكيد
                          الحذف
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              {!prices.data?.length ? (
                <div
                  className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center sm:py-14"
                  data-testid="state-supplier-prices-empty"
                >
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary">
                    <CircleDollarSign className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="mt-4 font-display text-xl text-primary">
                    لا توجد أسعار محفوظة
                  </h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    أضف سعرًا لموردك أو استورد قائمة وراجعها قبل حفظها.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("price-supplier")?.focus()
                    }
                    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    data-testid="button-add-first-price"
                  >
                    <Plus className="h-4 w-4" aria-hidden /> إضافة سعر
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {prices.data.map((row) => (
                    <article
                      key={row.id}
                      className={`rounded-2xl border bg-card p-4 transition-colors sm:p-5 ${editing?.id === row.id ? "border-primary/40 ring-1 ring-primary/10" : "border-border/80"}`}
                      data-testid={`card-supplier-price-${row.id}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p
                            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                            data-testid={`text-price-supplier-${row.id}`}
                          >
                            <span data-no-translate>{row.supplier_name}</span>
                            {!row.supplier_id && (
                              <span
                                className="rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-foreground"
                                data-testid={`badge-price-unlinked-${row.id}`}
                              >
                                غير مرتبط
                              </span>
                            )}
                          </p>
                          <h3
                            className="mt-1 text-base font-semibold"
                            data-testid={`text-price-item-${row.id}`}
                          >
                            <span data-no-translate>{row.item_name}</span>
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span data-testid={`text-price-unit-${row.id}`}>
                              لكل {row.unit || "وحدة غير محددة"}
                            </span>
                            <span
                              className="h-1 w-1 rounded-full bg-border"
                              aria-hidden
                            />
                            <span data-testid={`text-price-updated-${row.id}`}>
                              آخر تحديث: {formatUpdatedAt(row.updated_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <p
                            className="text-left font-mono text-xl font-semibold tabular-nums text-primary sm:min-w-32"
                            dir="ltr"
                            data-testid={`text-price-value-${row.id}`}
                          >
                            {formatPrice(row.unit_price, row.currency || "KWD")}
                            <span className="mt-1 block text-[10px] font-sans font-normal text-muted-foreground">
                              للوحدة
                            </span>
                          </p>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              aria-label={`${t("تعديل سعر")} ${row.item_name} ${t("لدى")} ${row.supplier_name}`}
                              className="grid h-10 w-10 place-items-center rounded-lg border border-border text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              data-testid={`button-edit-price-${row.id}`}
                            >
                              <PencilLine className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleting(row);
                                setActionError("");
                              }}
                              aria-label={`${t("حذف سعر")} ${row.item_name} ${t("لدى")} ${row.supplier_name}`}
                              className="grid h-10 w-10 place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive/25 hover:bg-destructive/5 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              data-testid={`button-delete-price-${row.id}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section
            className="overflow-hidden rounded-2xl border border-border/80 bg-card"
            data-testid="panel-price-import"
          >
            <div className="flex flex-col gap-4 border-b border-border/70 bg-secondary/35 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card text-primary">
                  <FileSpreadsheet className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-xl text-primary">
                    استيراد قائمة أسعار
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    ارفع صورة أو ملف Excel، ثم راجع كل صف بنفسك. لن تُحفظ
                    البيانات المستخرجة تلقائيًا.
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-primary/20 bg-card px-3 py-1.5 text-xs font-semibold text-primary">
                JPG · PNG · WebP · XLS · XLSX
              </span>
            </div>
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)]">
              <div className="space-y-4">
                {!suppliers.data?.length && (
                  <p
                    className="rounded-xl border border-accent/35 bg-accent/10 p-3 text-sm leading-6"
                    data-testid="notice-import-requires-supplier"
                  >
                    أضف المورد أولًا حتى تتمكن من ربط القائمة بأسعاره.{" "}
                    <Link
                      href="/suppliers"
                      className="font-semibold text-primary underline underline-offset-2"
                      data-testid="link-add-supplier-before-import"
                    >
                      إدارة الموردين
                    </Link>
                  </p>
                )}
                <div>
                  <label
                    htmlFor="price-list-file"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    ملف قائمة الأسعار
                  </label>
                  <input
                    id="price-list-file"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.xls,.xlsx,image/jpeg,image/png,image/webp,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={selectFile}
                    className="block min-h-11 w-full rounded-xl border border-input bg-background text-sm file:me-3 file:min-h-11 file:border-0 file:bg-secondary file:px-3 file:font-semibold file:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="input-price-list-file"
                  />
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {user?.is_anonymous ? "حد التجربة ٥ ميغابايت لكل ملف. يُزال الملف المؤقت بعد القراءة." : "الحد الأقصى ١٠ ميغابايت. يُزال الملف المؤقت بعد القراءة."}
                  </p>
                </div>
                {file && (
                  <div
                    className="rounded-xl border border-border bg-background p-3"
                    data-testid="card-price-import-source"
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={`معاينة محلية للملف ${file.name}`}
                        className="mb-3 max-h-52 w-full rounded-lg border border-border object-contain"
                        data-testid="img-price-import-preview"
                      />
                    ) : (
                      <div className="mb-3 grid h-24 place-items-center rounded-lg bg-secondary text-primary">
                        {file.name.toLowerCase().match(/\.(xls|xlsx)$/) ? (
                          <FileSpreadsheet className="h-8 w-8" aria-hidden />
                        ) : (
                          <ImageIcon className="h-8 w-8" aria-hidden />
                        )}
                      </div>
                    )}
                    <p
                      className="truncate text-sm font-semibold"
                      dir="auto"
                      data-testid="text-price-import-filename"
                    >
                      {file.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} ميغابايت ·{" "}
                      {file.type || "نوع ملف غير محدد"}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void runImport()}
                  disabled={
                    !file ||
                    !suppliers.data?.length ||
                    importList.isPending ||
                    saveImport.isPending
                  }
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-55"
                  data-testid="button-read-price-list"
                >
                  {importList.isPending ? (
                    <span
                      className="h-4 w-4 animate-pulse rounded-full border-2 border-primary-foreground border-t-transparent"
                      aria-hidden
                    />
                  ) : (
                    <Upload className="h-4 w-4" aria-hidden />
                  )}
                  {importList.isPending
                    ? "جارٍ قراءة القائمة…"
                    : "قراءة الملف ومراجعته"}
                </button>
                {importError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-5 text-destructive"
                    data-testid="status-price-import-error"
                  >
                    <p className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      {importError}
                    </p>
                    {user?.is_anonymous && importError.includes("5 ميغابايت") && (
                      <Link href="/register" className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground" data-testid="link-price-import-upgrade">
                        {t("إنشاء حساب للمتابعة")}
                      </Link>
                    )}
                  </div>
                )}
                {importNotice && (
                  <p
                    role="status"
                    className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-sm leading-5 text-primary"
                    data-testid="status-price-import-notice"
                  >
                    {importNotice}
                  </p>
                )}
              </div>

              {importResult ? (
                <div
                  className="min-w-0 space-y-4"
                  data-testid="section-price-import-review"
                >
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          ملخص قراءة الملف
                        </p>
                        <h3
                          className="mt-1 font-semibold"
                          data-testid="text-import-supplier-hint"
                        >
                          {importResult.supplierName
                            ? `${t("تلميح المورد:")} ${importResult.supplierName}`
                            : t("لم يُتعرف على اسم المورد")}
                        </h3>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${currencyIsKwd ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}
                        data-testid="badge-import-currency"
                      >
                        {importResult.currency
                          ? `${t("العملة المستخرجة:")} ${importResult.currency}`
                          : t("العملة غير معروفة")}
                      </span>
                    </div>
                    {!currencyIsKwd && (
                      <p
                        role="alert"
                        className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
                        data-testid="warning-import-currency"
                      >
                        {t("العملة المستخرجة ليست دينارًا كويتيًا أو لم يتم تحديدها. سيتم حفظ هذه القائمة بالدينار الكويتي فقط؛ تحقق من كل مبلغ وأكد العملة صراحةً قبل الحفظ.")}
                      </p>
                    )}
                    {(importResult.skippedRows > 0 ||
                      importResult.truncated) && (
                      <div
                        className="mt-3 space-y-2"
                        data-testid="warning-import-rows"
                      >
                        {importResult.skippedRows > 0 && (
                          <p
                            className="rounded-lg border border-accent/35 bg-accent/10 p-3 text-sm leading-5"
                            data-testid="warning-import-skipped"
                          >
                            تم تجاوز{" "}
                            {new Intl.NumberFormat(getLanguage() === "ar" ? "ar-KW" : "en-KW").format(
                              importResult.skippedRows,
                            )}{" "}
                            صفًا أثناء القراءة؛ قد تحتاج إلى إدخالها يدويًا.
                          </p>
                        )}
                        {importResult.truncated && (
                          <p
                            className="rounded-lg border border-accent/35 bg-accent/10 p-3 text-sm leading-5"
                            data-testid="warning-import-truncated"
                          >
                            القراءة وصلت إلى حد الصفوف؛ تحقق من اكتمال القائمة
                            الأصلية.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {!reviewed ? (
                    <div className="rounded-xl border border-dashed border-border p-5 text-center">
                      <p className="text-sm leading-6 text-muted-foreground">
                        الصفوف المستخرجة غير محفوظة. ابدأ مراجعتها لتحرير
                        الأسماء والوحدات والأسعار وإزالة الصفوف غير المناسبة.
                      </p>
                      <button
                        type="button"
                        onClick={confirmReview}
                        disabled={!reviewRows.length || importList.isPending}
                        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.05] px-4 text-sm font-semibold text-primary disabled:opacity-50"
                        data-testid="button-begin-price-review"
                      >
                        <PencilLine className="h-4 w-4" aria-hidden /> مراجعة
                        الصفوف
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="import-supplier"
                          className="mb-1.5 block text-sm font-medium"
                        >
                          المورد المحفوظ الذي تخصه القائمة
                        </label>
                        <select
                          id="import-supplier"
                          value={importSupplierId}
                          onChange={(event) =>
                            setImportSupplierId(event.target.value)
                          }
                          className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid="select-import-supplier"
                        >
                          <option value="">اختر المورد</option>
                          {suppliers.data?.map((supplier) => (
                            <option key={supplier.id} value={supplier.id} data-no-translate>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div
                        className="space-y-3"
                        data-testid="list-import-review-rows"
                      >
                        {reviewRows.map((row, index) => {
                          const lowConfidence = row.confidence < 0.7;
                          return (
                            <article
                              key={row.key}
                              className={`rounded-xl border p-3 sm:p-4 ${lowConfidence ? "border-accent/45 bg-accent/[0.045]" : "border-border bg-background"}`}
                              data-testid={`card-import-row-${index}`}
                            >
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">
                                  الصنف{" "}
                                  {new Intl.NumberFormat(getLanguage() === "ar" ? "ar-KW" : "en-KW").format(
                                    index + 1,
                                  )}
                                </span>
                                <div className="flex items-center gap-2">
                                  {lowConfidence ? (
                                    <span
                                      className="rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-bold text-foreground"
                                      data-testid={`badge-import-confidence-${index}`}
                                    >
                                      ثقة منخفضة ·{" "}
                                      {Math.round(row.confidence * 100)}٪
                                    </span>
                                  ) : (
                                    <span
                                      className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary"
                                      data-testid={`badge-import-confidence-${index}`}
                                    >
                                      ثقة {Math.round(row.confidence * 100)}٪
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReviewRows((rows) =>
                                        rows.filter(
                                          (item) => item.key !== row.key,
                                        ),
                                      )
                                    }
                                    aria-label={`${t("إزالة الصنف")} ${row.itemName || index + 1}`}
                                    className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive/25 hover:bg-destructive/5 hover:text-destructive"
                                    data-testid={`button-remove-import-row-${index}`}
                                  >
                                    <X className="h-4 w-4" aria-hidden />
                                  </button>
                                </div>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-[1.2fr_.7fr_.7fr]">
                                <div>
                                  <label
                                    htmlFor={`import-name-${index}`}
                                    className="mb-1 block text-xs font-medium"
                                  >
                                    اسم الصنف
                                  </label>
                                  <input
                                    id={`import-name-${index}`}
                                    value={row.itemName}
                                    onChange={(event) =>
                                      setReviewRows((rows) =>
                                        rows.map((item) =>
                                          item.key === row.key
                                            ? {
                                                ...item,
                                                itemName: event.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    className="min-h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    data-testid={`input-import-item-name-${index}`}
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`import-unit-${index}`}
                                    className="mb-1 block text-xs font-medium"
                                  >
                                    الوحدة
                                  </label>
                                  <input
                                    id={`import-unit-${index}`}
                                    value={row.unit}
                                    onChange={(event) =>
                                      setReviewRows((rows) =>
                                        rows.map((item) =>
                                          item.key === row.key
                                            ? {
                                                ...item,
                                                unit: event.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    placeholder="اختياري"
                                    className="min-h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    data-testid={`input-import-item-unit-${index}`}
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`import-price-${index}`}
                                    className="mb-1 block text-xs font-medium"
                                  >
                                    السعر · KWD
                                  </label>
                                  <input
                                    id={`import-price-${index}`}
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.001"
                                    value={row.unitPrice}
                                    onChange={(event) =>
                                      setReviewRows((rows) =>
                                        rows.map((item) =>
                                          item.key === row.key
                                            ? {
                                                ...item,
                                                unitPrice: event.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    placeholder="أدخل السعر"
                                    className="min-h-10 w-full rounded-lg border border-input bg-card px-2.5 text-left font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    dir="ltr"
                                    data-testid={`input-import-item-price-${index}`}
                                  />
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      <label
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/[0.035] p-4 text-sm leading-6"
                        data-testid="label-confirm-import-kwd"
                      >
                        <input
                          type="checkbox"
                          checked={confirmedKwd}
                          onChange={(event) =>
                            setConfirmedKwd(event.target.checked)
                          }
                          className="mt-1 h-4 w-4 accent-primary"
                          data-testid="checkbox-confirm-import-kwd"
                        />
                        <span>
                          <strong className="block">
                            أؤكد أن جميع المبالغ التي سأحفظها بالدينار الكويتي
                            (KWD).
                          </strong>
                          <span className="text-xs text-muted-foreground">
                            هذا تأكيد مستقل مطلوب حتى لو أشارت القائمة إلى عملة
                            أخرى أو لم تحدد العملة.
                          </span>
                        </span>
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => {
                            setReviewed(false);
                            setConfirmedKwd(false);
                            setImportNotice(
                              "يمكنك تعديل الصفوف ثم بدء المراجعة مرة أخرى.",
                            );
                          }}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input px-4 text-sm font-semibold text-muted-foreground hover:bg-muted"
                          data-testid="button-return-import-review"
                        >
                          <PencilLine className="h-4 w-4" aria-hidden /> تعديل
                          الصفوف
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveReviewedImport()}
                          disabled={
                            saveImport.isPending ||
                            !reviewRows.length ||
                            !confirmedKwd ||
                            !importSupplierId
                          }
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-55"
                          data-testid="button-save-reviewed-import"
                        >
                          {saveImport.isPending ? (
                            <span
                              className="h-4 w-4 animate-pulse rounded-full border-2 border-primary-foreground border-t-transparent"
                              aria-hidden
                            />
                          ) : (
                            <Check className="h-4 w-4" aria-hidden />
                          )}
                          {saveImport.isPending
                            ? "جارٍ حفظ القائمة كاملة…"
                             : getLanguage() === "ar"
                               ? `حفظ ${new Intl.NumberFormat("ar-KW").format(reviewRows.length)} سعرًا`
                               : `Save ${new Intl.NumberFormat("en-KW").format(reviewRows.length)} prices`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="grid min-h-52 place-items-center rounded-xl border border-dashed border-border bg-background p-6 text-center"
                  data-testid="state-price-import-empty"
                >
                  <div>
                    <FileSpreadsheet
                      className="mx-auto h-8 w-8 text-primary/70"
                      aria-hidden
                    />
                    <p className="mt-3 text-sm font-semibold">
                      قائمة الأسعار المستخرجة ستظهر هنا
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      اختر ملفًا ثم ابدأ القراءة. لن يتم حفظ أي بيانات قبل
                      مراجعتك وتأكيد العملة.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
          <div
            className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 text-xs leading-5 text-muted-foreground"
            data-testid="notice-price-privacy"
          >
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              aria-hidden
            />
            الأسعار تُحمّل من سجلات حسابك. الأسعار القديمة غير المرتبطة تبقى
            ظاهرة وقابلة للتحرير، وملف الاستيراد لا يُحفظ ضمن بياناتك.
          </div>
          {prices.isSuccess && (
            <p
              className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"
              data-testid="text-price-reference-note"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> يمكنك تعديل
              المرجع أو حذفه في أي وقت.
            </p>
          )}
        </div>
      )}
    </WorkspaceFrame>
  );
}
