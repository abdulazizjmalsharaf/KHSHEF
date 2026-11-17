import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ContactRound,
  PencilLine,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  useDeleteSupplier,
  useSaveSupplier,
  useSuppliers,
} from "@/hooks/use-suppliers";
import type { SupplierRow } from "@/lib/invoice-types";
import {
  PageIntro,
  QueryProblem,
  WorkspaceFrame,
} from "@/pages/invoice-workspace";

export default function SuppliersPage() {
  const { user, loading: authLoading } = useAuth();
  const suppliers = useSuppliers(user?.id);
  const saveSupplier = useSaveSupplier(user?.id ?? "");
  const deleteSupplier = useDeleteSupplier(user?.id);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [deleting, setDeleting] = useState<SupplierRow | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const reset = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setFormError("");
  };

  const startEdit = (supplier: SupplierRow) => {
    setEditing(supplier);
    setName(supplier.name);
    setPhone(supplier.contact_phone ?? "");
    setNotice("");
    setFormError("");
    setActionError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setNotice("");
    try {
      await saveSupplier.mutateAsync({
        id: editing?.id,
        name,
        contactPhone: phone,
      });
      setNotice(
        editing ? "تم تحديث بيانات المورد." : "تمت إضافة المورد إلى قائمتك.",
      );
      reset();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "تعذر حفظ المورد. تحقق من البيانات وحاول مرة أخرى.",
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setActionError("");
    try {
      await deleteSupplier.mutateAsync(deleting.id);
      if (editing?.id === deleting.id) reset();
      setNotice(
        `تم حذف ${deleting.name}. بقيت الأسعار المحفوظة دون ارتباط بمورد.`,
      );
      setDeleting(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "تعذر حذف المورد. حاول مرة أخرى.",
      );
    }
  };

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
        eyebrow="دفتر الموردين"
        title="الموردون"
        description="احتفظ بأسماء الموردين ووسائل التواصل في مساحة خاصة بحسابك، ثم اربط بهم أسعار الأصناف المتفق عليها."
        action={
          <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.045] px-4 text-xs font-semibold text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden /> دفتر خاص بحسابك
          </span>
        }
      />

      {authLoading ? (
        <section
          className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]"
          aria-label="جارٍ التحقق من الحساب"
          data-testid="status-suppliers-auth-loading"
        >
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </section>
      ) : !user ? (
        <section
          className="rounded-3xl border border-border bg-card px-6 py-12 text-center"
          data-testid="state-suppliers-sign-in"
        >
          <ShieldCheck className="mx-auto h-9 w-9 text-primary" aria-hidden />
          <h2 className="mt-4 font-display text-2xl text-primary">
            دفتر الموردين خاص بك
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            ادخل إلى حسابك للوصول إلى الموردين وبيانات التواصل المحفوظة.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
            data-testid="link-suppliers-login"
          >
            الدخول إلى حسابك
          </Link>
        </section>
      ) : suppliers.isLoading ? (
        <section
          className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]"
          aria-label="جارٍ تحميل الموردين"
          data-testid="status-suppliers-loading"
        >
          <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
        </section>
      ) : suppliers.isError ? (
        <QueryProblem
          message="تعذر تحميل الموردين. أعد المحاولة؛ لن نعرض بيانات غير مؤكدة."
          onRetry={() => void suppliers.refetch()}
          testId="status-suppliers-error"
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
          <section
            className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 lg:sticky lg:top-5"
            data-testid="panel-supplier-form"
          >
            <div className="mb-5 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                <Plus className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2
                  className="font-display text-xl text-primary"
                  data-testid="heading-supplier-form"
                >
                  {editing ? "تعديل المورد" : "إضافة مورد"}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  الاسم ورقم التواصل الذي تستخدمه عند مراجعة الفواتير.
                </p>
              </div>
            </div>
            <form
              onSubmit={(event) => void submit(event)}
              className="space-y-4"
              aria-busy={saveSupplier.isPending}
              data-testid="form-supplier"
            >
              <div>
                <label
                  htmlFor="supplier-name"
                  className="mb-1.5 block text-sm font-medium"
                >
                  اسم المورد
                </label>
                <input
                  id="supplier-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  required
                  autoComplete="organization"
                  placeholder="مثال: شركة التوريدات الغذائية"
                  className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="input-supplier-name"
                />
              </div>
              <div>
                <label
                  htmlFor="supplier-phone"
                  className="mb-1.5 block text-sm font-medium"
                >
                  رقم التواصل{" "}
                  <span className="font-normal text-muted-foreground">
                    · اختياري
                  </span>
                </label>
                <input
                  id="supplier-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="+965 5xxx xxxx"
                  className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  dir="ltr"
                  data-testid="input-supplier-phone"
                />
              </div>
              {formError && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-5 text-destructive"
                  data-testid="status-supplier-save-error"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden
                  />
                  {formError}
                </p>
              )}
              {notice && (
                <p
                  role="status"
                  className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-sm text-primary"
                  data-testid="status-supplier-saved"
                >
                  {notice}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
                {editing && (
                  <button
                    type="button"
                    onClick={reset}
                    disabled={saveSupplier.isPending}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input px-4 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                    data-testid="button-cancel-supplier-edit"
                  >
                    <X className="h-4 w-4" aria-hidden /> إلغاء
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saveSupplier.isPending}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-60"
                  data-testid="button-save-supplier"
                >
                  {saveSupplier.isPending ? (
                    <span
                      className="h-4 w-4 animate-pulse rounded-full border-2 border-primary-foreground border-t-transparent"
                      aria-hidden
                    />
                  ) : editing ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden />
                  )}
                  {saveSupplier.isPending
                    ? "جارٍ الحفظ…"
                    : editing
                      ? "حفظ التعديل"
                      : "إضافة المورد"}
                </button>
              </div>
            </form>
          </section>
          <section className="min-w-0" data-testid="section-suppliers">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-primary">
                  دفتر الموردين
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  أسماء الاتصال المعتمدة لمساحتك.
                </p>
              </div>
              <span
                className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary tabular-nums"
                data-testid="text-supplier-count"
              >
                {new Intl.NumberFormat("ar-KW").format(
                  suppliers.data?.length ?? 0,
                )}{" "}
                مورد
              </span>
            </div>
            {deleting && (
              <div
                className="mb-3 space-y-3 rounded-xl border border-destructive/25 bg-destructive/[0.045] p-4"
                role="alert"
                data-testid={`confirm-delete-supplier-${deleting.id}`}
              >
                <p className="text-sm leading-6">
                  حذف <strong>{deleting.name}</strong> من دفتر الموردين؟{" "}
                  <span className="block text-destructive">
                    ستبقى الأسعار المحفوظة، لكنها ستصبح غير مرتبطة بمورد.
                  </span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleting(null)}
                    disabled={deleteSupplier.isPending}
                    className="min-h-9 rounded-lg border border-input px-3 text-xs font-semibold hover:bg-muted"
                    data-testid="button-cancel-delete-supplier"
                  >
                    إبقاء المورد
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmDelete()}
                    disabled={deleteSupplier.isPending}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
                    data-testid="button-confirm-delete-supplier"
                  >
                    {deleteSupplier.isPending ? (
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
            {actionError && (
              <p
                role="alert"
                className="mb-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"
                data-testid="status-supplier-action-error"
              >
                {actionError}
              </p>
            )}
            {!suppliers.data?.length ? (
              <div
                className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center sm:py-14"
                data-testid="state-suppliers-empty"
              >
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary">
                  <ContactRound className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-xl text-primary">
                  ابدأ دفتر الموردين
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  أضف الموردين الذين تتعامل معهم لتربط أسعارهم المتفق عليها
                  بمرجع واضح قبل مراجعة الفاتورة.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("supplier-name")?.focus()
                  }
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  data-testid="button-add-first-supplier"
                >
                  <Plus className="h-4 w-4" aria-hidden /> إضافة مورد
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {suppliers.data.map((supplier) => (
                  <article
                    key={supplier.id}
                    className={`rounded-2xl border bg-card p-4 transition-colors sm:p-5 ${editing?.id === supplier.id ? "border-primary/40 ring-1 ring-primary/10" : "border-border/80"}`}
                    data-testid={`card-supplier-${supplier.id}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3
                          className="truncate text-base font-semibold"
                          data-testid={`text-supplier-name-${supplier.id}`}
                        >
                          {supplier.name}
                        </h3>
                        <p
                          className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"
                          data-testid={`text-supplier-phone-${supplier.id}`}
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                          {supplier.contact_phone ? (
                            <bdi dir="ltr">{supplier.contact_phone}</bdi>
                          ) : (
                            "لا يوجد رقم تواصل"
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(supplier)}
                          aria-label={`تعديل ${supplier.name}`}
                          className="grid h-10 w-10 place-items-center rounded-lg border border-border text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid={`button-edit-supplier-${supplier.id}`}
                        >
                          <PencilLine className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleting(supplier);
                            setActionError("");
                          }}
                          aria-label={`حذف ${supplier.name}`}
                          className="grid h-10 w-10 place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive/25 hover:bg-destructive/5 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid={`button-delete-supplier-${supplier.id}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div
              className="mt-4 flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 text-xs leading-5 text-muted-foreground"
              data-testid="notice-supplier-privacy"
            >
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                aria-hidden
              />
              بيانات الموردين خاصة بحسابك. حذف المورد لا يحذف أسعارك السابقة، بل
              يفصلها عن المورد فقط.
            </div>
          </section>
        </div>
      )}
    </WorkspaceFrame>
  );
}
