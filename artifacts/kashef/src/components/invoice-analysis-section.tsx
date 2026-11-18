import { useId, useState, type FormEvent, type ChangeEvent } from 'react';
import { AlertTriangle, CheckCircle2, FileText, HelpCircle, Loader2, RotateCcw, ShieldCheck, Sparkles, Upload, X, XCircle } from 'lucide-react';
import { useAnalyzeInvoice, type ArithmeticCheck, type InvoiceAnalysis, type InvoiceExtraction } from '@workspace/api-client-react';
import { getLanguage, t } from '@/lib/i18n';

const MIN = 10;
const MAX = 12000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const SAMPLE = `فاتورة ضريبية (مثال تجريبي غير حقيقي)
المورد: مؤسسة الساحل للتموين - الكويت
رقم الفاتورة: 2025-0417
العملة: دينار كويتي (KWD)

1) طماطم محلية - 12 كغ × 0.450 = 5.400
2) جبنة بيضاء - 6 علبة × 1.875 = 11.250
3) زيت دوار الشمس 1.8 لتر - 4 × 2.125 = 8.500  (خصم على الصنف 0.500)
4) خبز صامولي - 20 كيس × 0.150 = 3.000

المجموع الفرعي: 27.650
خصم 5%: 1.383
رسوم توصيل: 1.000
الإجمالي المستحق: 27.267`;
const SAMPLE_EN = `Sample invoice (fictional example)
Supplier: Al Sahel Food Supply - Kuwait
Invoice number: 2025-0417
Currency: Kuwaiti dinar (KWD)

1) Local tomatoes - 12 kg × 0.450 = 5.400
2) White cheese - 6 packs × 1.875 = 11.250
3) Sunflower oil 1.8 L - 4 × 2.125 = 8.500 (item discount 0.500)
4) Samoon bread - 20 bags × 0.150 = 3.000

Subtotal: 27.650
Discount 5%: 1.383
Delivery fee: 1.000
Total due: 27.267`;

type Status = 'match' | 'mismatch' | 'unverified';

const STATUS: Record<Status, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  match: { label: 'متطابق حسابيًا', cls: 'border-[hsl(var(--chart-4)/0.45)] bg-[hsl(var(--chart-4)/0.1)] text-[hsl(152_45%_28%)] dark:text-[hsl(152_45%_62%)]', Icon: CheckCircle2 },
  mismatch: { label: 'فرق حسابي', cls: 'border-destructive/45 bg-destructive/10 text-destructive', Icon: XCircle },
  unverified: { label: 'تعذّر التحقق', cls: 'border-accent/50 bg-accent/15 text-[hsl(30_80%_32%)] dark:text-accent', Icon: HelpCircle },
};

function StatusPill({ status, testId }: { status: Status; testId?: string }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`} data-testid={testId}>
      <s.Icon className="h-3.5 w-3.5" aria-hidden /> {t(s.label)}
    </span>
  );
}

const NA = () => <span className="text-muted-foreground">{t('غير مذكور')}</span>;
const val = (v: string | null | undefined) => (v == null || v === '' ? <NA /> : <bdi className="tabular-nums" dir="ltr">{v}</bdi>);
const rate = (v: string | null | undefined) => (v == null || v === '' ? <NA /> : <bdi className="tabular-nums" dir="ltr">{v}%</bdi>);

function errorMessage(err: unknown): string {
  const e = err as { status?: number; data?: { error?: unknown } | null } | null;
  const msg = e?.data && typeof e.data.error === 'string' ? e.data.error : '';
  if (msg) return msg;
  if (e?.status === 429) return t('طلبات كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.');
  if (e?.status && e.status >= 500) return t('تعذّر التحليل الآن بسبب خطأ في الخادم. نصك ما زال هنا، أعد المحاولة.');
  return t('تعذّر الاتصال بالخادم. تحقق من الإنترنت وأعد المحاولة.');
}

function ChecksTable({ checks, caption, prefix }: { checks: ArithmeticCheck[]; caption: string; prefix: string }) {
  if (!checks.length) return <p className="text-sm text-muted-foreground">{t('لا توجد عمليات تحقق في هذا القسم.')}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-card-border">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="p-3 text-right font-medium">{t('البند')}</th>
            <th scope="col" className="p-3 font-medium">{t('المذكور')}</th>
            <th scope="col" className="p-3 font-medium">{t('المحسوب')}</th>
            <th scope="col" className="p-3 font-medium">{t('الفرق')}</th>
            <th scope="col" className="p-3 font-medium">{t('الحالة')}</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c, i) => (
            <tr key={i} className={`border-t border-border ${c.status === 'mismatch' ? 'bg-destructive/[0.05]' : ''}`} data-testid={`row-${prefix}-${i}`}>
              <th scope="row" className="p-3 text-right font-medium">{t(c.label)}</th>
              <td className="p-3 text-center">{val(c.stated)}</td>
              <td className="p-3 text-center">{c.calculated == null ? <span className="text-muted-foreground">{t('لا يمكن حسابه')}</span> : val(c.calculated)}</td>
              <td className={`p-3 text-center ${c.status === 'mismatch' ? 'font-bold text-destructive' : ''}`}>{c.difference == null ? <span className="text-muted-foreground">—</span> : val(c.difference)}</td>
              <td className="p-3 text-center"><StatusPill status={c.status} testId={`status-${prefix}-${i}`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Totals({ inv }: { inv: InvoiceExtraction }) {
  const rows: [string, React.ReactNode, string][] = [
    [t('المجموع الفرعي'), val(inv.subtotal), 'subtotal'],
    [t('نسبة الخصم'), rate(inv.discountRate), 'discount-rate'],
    [t('مبلغ الخصم'), val(inv.discountAmount), 'discount-amount'],
    [t('نسبة الضريبة'), rate(inv.taxRate), 'tax-rate'],
    [t('مبلغ الضريبة'), val(inv.taxAmount), 'tax-amount'],
    [t('الضريبة مشمولة في الأسعار'), inv.taxIncluded == null ? <NA /> : inv.taxIncluded ? t('نعم') : t('لا'), 'tax-included'],
    [t('رسوم إضافية'), val(inv.additionalCharges), 'additional'],
  ];
  return (
    <dl className="ledger-lines rounded-2xl border border-card-border bg-card px-5">
      {rows.map(([k, v, id]) => (
        <div key={id} className="flex items-center justify-between gap-4 border-b border-border/70 py-2.5 text-sm">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-medium" data-testid={`text-total-${id}`}>{v}</dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 py-3">
          <dt className="font-display text-lg text-primary">{t('الإجمالي المذكور')}</dt>
        <dd className="font-display text-xl text-primary" data-testid="text-total-total">{val(inv.total)}</dd>
      </div>
    </dl>
  );
}

function Result({ data }: { data: InvoiceAnalysis }) {
  const inv = data.invoice;
  const s = STATUS[data.status];
  const headline = data.status === 'match'
    ? t('الأرقام المستخرجة متسقة حسابيًا. هذا لا يعني اعتماد الفاتورة أو صحة الكميات المستلمة.')
    : data.status === 'mismatch'
      ? t('وجدنا فرقًا حسابيًا واحدًا على الأقل بين المذكور والمحسوب. راجع البنود المعلّمة قبل الدفع.')
      : t('لم تكفِ البيانات المستخرجة للتحقق من كل الحسابات. راجع الفاتورة يدويًا.');
  return (
    <div className="rise mt-10 space-y-8" data-testid="result-invoice-analysis">
      <div role={data.status === 'mismatch' ? 'alert' : 'status'} className={`flex gap-3 rounded-2xl border p-4 ${s.cls}`} data-testid="status-invoice-overall">
        <s.Icon className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        <div>
          <p className="font-display text-xl">{s.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{headline}</p>
        </div>
      </div>

      {!inv.isInvoice && (
        <p role="note" className="flex gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm" data-testid="text-not-invoice">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[hsl(30_80%_38%)]" aria-hidden /> {t('يبدو أن النص المُلصق ليس فاتورة واضحة؛ تعامل مع النتائج بحذر.')}
        </p>
      )}

      {(data.warnings.length > 0 || inv.unsupportedAdjustments) && (
        <div role="note" className="rounded-2xl border border-accent/40 bg-accent/10 p-4" data-testid="list-warnings">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5 text-[hsl(30_80%_38%)]" aria-hidden /> {t('تنبيهات')}</p>
          <ul className="mt-2 list-disc space-y-1 pe-2 ps-5 text-sm leading-relaxed">
            {inv.unsupportedAdjustments && <li>{t('تحتوي الفاتورة على تعديلات لا يدعمها التحقق الحسابي، لذا قد لا تكتمل المطابقة.')}</li>}
            {data.warnings.map((w, i) => <li key={i} data-testid={`text-warning-${i}`}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-2xl text-primary">{t('البنود المستخرجة')}</h3>
            <p className="text-sm text-muted-foreground" data-testid="text-currency">
              {inv.currency ? <>{t('العملة كما وردت:')} <bdi className="font-semibold text-foreground">{inv.currency}</bdi></> : t('العملة غير محددة')}
            </p>
          </div>
          {inv.items.length ? (
            <div className="overflow-x-auto rounded-2xl border border-card-border bg-card">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">{t('البنود المستخرجة من الفاتورة')}</caption>
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-3 text-right font-medium">{t('الصنف')}</th>
                    <th scope="col" className="p-3 font-medium">{t('الكمية')}</th>
                    <th scope="col" className="p-3 font-medium">{t('سعر الوحدة')}</th>
                    <th scope="col" className="p-3 font-medium">{t('خصم البند')}</th>
                    <th scope="col" className="p-3 font-medium">{t('ضريبة البند')}</th>
                    <th scope="col" className="p-3 font-medium">{t('إجمالي البند')}</th>
                    <th scope="col" className="p-3 font-medium">{t('التحقق')}</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it, i) => {
                    const chk = data.itemChecks[i];
                    return (
                      <tr key={i} className={`border-t border-border ${chk?.status === 'mismatch' ? 'bg-destructive/[0.05]' : ''}`} data-testid={`row-item-${i}`}>
                        <th scope="row" className="p-3 text-right font-medium">{it.description || <NA />}</th>
                        <td className="p-3 text-center">{val(it.quantity)}</td>
                        <td className="p-3 text-center">{val(it.unitPrice)}</td>
                        <td className="p-3 text-center">{val(it.discountAmount)}</td>
                        <td className="p-3 text-center">{val(it.taxAmount)}</td>
                        <td className="p-3 text-center font-semibold">{val(it.lineTotal)}</td>
                        <td className="p-3 text-center">
                          {chk ? (
                            <div className="flex flex-col items-center gap-1">
                              <StatusPill status={chk.status} testId={`status-item-${i}`} />
                              {chk.status === 'mismatch' && chk.calculated != null && (
                                <span className="text-xs text-muted-foreground">{t('المحسوب')} {val(chk.calculated)}{chk.difference != null && <>, {t('الفرق')} {val(chk.difference)}</>}</span>
                              )}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-card-border p-6 text-center text-muted-foreground" data-testid="empty-items">{t('لم يُستخرج أي بند من الفاتورة.')}</p>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="mb-3 font-display text-2xl text-primary">{t('الإجماليات المذكورة')}</h3>
          <Totals inv={inv} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-display text-2xl text-primary">{t('التحقق الحسابي: المذكور مقابل المحسوب')}</h3>
        <ChecksTable checks={data.checks} caption={t('ملخص التحقق الحسابي للإجماليات')} prefix="check" />
      </div>

      {inv.notes.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-xl text-primary">{t('ملاحظات مستخرجة من الفاتورة')}</h3>
          <ul className="list-disc space-y-1 ps-5 text-sm leading-relaxed text-muted-foreground" data-testid="list-notes">
            {inv.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-card-border bg-muted/50 p-4 text-sm leading-relaxed">
        <p className="font-semibold text-primary">{t('قواعد الحساب والتقريب')}</p>
        <p className="mt-1 text-muted-foreground" data-testid="text-rounding-note">{data.roundingNote}</p>
        <p className="mt-3 text-muted-foreground">{t('«متطابق حسابيًا» يعني فقط أن الأرقام المستخرجة متسقة رياضيًا. قد يخطئ الاستخراج الآلي في قراءة رقم أو صنف، والنتيجة لا تغني عن مراجعة محاسبك، ولا تمثل مطابقة مع أمر الشراء أو إيصال الاستلام.')}</p>
      </div>
    </div>
  );
}

export function InvoiceAnalysisSection() {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileResult, setFileResult] = useState<InvoiceAnalysis | null>(null);
  const [fileError, setFileError] = useState('');
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);
  const textId = useId();
  const fileId = useId();
  const consentId = useId();
  const privacyId = useId();
  const hintId = useId();
  const mutation = useAnalyzeInvoice({ mutation: { gcTime: 0 } });
  const pending = mutation.isPending || fileBusy;
  const len = text.trim().length;
  const tooShort = len < MIN;
  const tooLong = text.length > MAX;
  const bothInputs = Boolean(file && text.trim());
  const invalid = bothInputs || tooLong || (!file && tooShort);
  const result = fileResult ?? mutation.data;

  const edit = (v: string) => {
    setText(v);
    setFileResult(null);
    setFileError('');
    if (mutation.data || mutation.error) mutation.reset();
  };
  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = '';
    setFileError('');
    setFileResult(null);
    if (mutation.data || mutation.error) mutation.reset();
    if (!chosen) return;
    setFile(null);
    const extension = chosen.name.split('.').at(-1)?.toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '')) {
      setFileError(t('ارفع صورة JPG أو PNG أو WebP، أو ملف PDF.'));
      return;
    }
    if (chosen.size > MAX_FILE_BYTES) {
      setFileError(t('الحد الأقصى لحجم الملف ٨ ميغابايت.'));
      return;
    }
    setFile(chosen);
  };
  const removeFile = () => {
    setFile(null);
    setFileResult(null);
    setFileError('');
  };
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (invalid || !consent || pending) return;
    setFileResult(null);
    setFileError('');
    if (!file) {
      mutation.mutate({ data: { text, consent: true } });
      return;
    }
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('consent', 'true');
    setFileBusy(true);
    try {
      const response = await fetch('/api/openai/invoice-file-analysis', { method: 'POST', body: form });
      const data = await response.json() as InvoiceAnalysis | { error?: string };
      if (!response.ok) throw new Error('error' in data ? data.error || t('تعذر تحليل الملف.') : t('تعذر تحليل الملف.'));
      setFileResult(data as InvoiceAnalysis);
    } catch (error) {
      setFileError(t(error instanceof Error ? error.message : 'تعذر الاتصال بالخادم. تحقق من الإنترنت وأعد المحاولة.'));
    } finally {
      setFileBusy(false);
    }
  };
  const fieldError = touched && invalid
    ? bothInputs ? t('استخدم النص أو الملف، وليس الاثنين معًا.')
      : tooLong ? `${t('النص أطول من')} ${MAX.toLocaleString(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW')} ${t('حرف. اختصره ثم أعد المحاولة.')}`
        : !file && tooShort ? t('الصق نص الفاتورة (١٠ أحرف على الأقل) أو ارفع صورة أو PDF.')
          : ''
    : '';
  const analysisError = fileError || (mutation.error ? errorMessage(mutation.error) : '');

  return (
    <section id="invoice-analysis" aria-labelledby="invoice-analysis-title" className="border-y border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--chart-4))]" aria-hidden /> {t('متاح الآن')}
            </p>
            <h2 id="invoice-analysis-title" className="font-display text-4xl leading-tight text-primary">{t('أدخل الفاتورة.')}<br />{t('نراجع الحساب.')}</h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">{t('الصق نص الفاتورة بأي ترتيب، أو ارفع صورة أو PDF. نقبل حتى القوائم المختصرة مثل «حليب 230»؛ الحقول الناقصة تُترك للمراجعة بدل رفض الفاتورة. الصور الممسوحة تُعلّم دائمًا للمراجعة البصرية.')}</p>
            <div id={privacyId} role="note" className="mt-6 flex gap-3 rounded-2xl border border-primary/25 bg-card p-4 text-sm leading-relaxed" data-testid="text-privacy-notice">
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-semibold text-primary">{t('قبل الإرسال')}</p>
                <p className="mt-1 text-muted-foreground">{t('يُرسل النص أو الملف إلى OpenAI عبر Replit للتحليل. لا يحفظه كاشف ولا نتيجته، وتُحذف ملفات PDF المؤقتة بعد القراءة. لا ترفع معلومات حساسة مثل أرقام الحسابات البنكية أو البطاقات أو بيانات شخصية.')}</p>
              </div>
            </div>
          </div>

          <form noValidate onSubmit={submit} aria-busy={pending} className="rounded-3xl border border-card-border bg-card p-5 shadow-[0_30px_60px_-34px_hsl(186_62%_20%/0.35)] sm:p-7">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={textId} className="flex items-center gap-2 text-base font-semibold"><FileText className="h-4 w-4 text-primary" aria-hidden /> {t('نص الفاتورة (اختياري)')}</label>
              <button type="button" disabled={pending || !!file} onClick={() => { edit(getLanguage() === 'ar' ? SAMPLE : SAMPLE_EN); setTouched(false); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 text-xs font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" data-testid="button-fill-sample">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> {t('املأ بمثال تجريبي (غير حقيقي)')}
              </button>
            </div>
            <textarea
              id={textId}
              value={text}
              onChange={(e) => edit(e.target.value)}
              onBlur={() => setTouched(true)}
              disabled={pending}
              rows={11}
              maxLength={MAX + 500}
              aria-invalid={!!fieldError}
              aria-describedby={`${hintId} ${privacyId}`}
              placeholder={t('مثلًا:\nحليب 230\nبصل 400\nأو الصق الفاتورة كاملة بأي صيغة نصية')}
              className="w-full resize-y rounded-xl border border-input bg-background p-3 text-base leading-relaxed placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-70 aria-invalid:border-destructive"
              data-testid="input-invoice-text"
            />
            <div id={hintId} className="mt-1 flex justify-between gap-3 text-xs">
              <span className={fieldError ? 'text-destructive' : 'text-muted-foreground'} role={fieldError ? 'alert' : undefined}>{fieldError || t('اقبل القائمة المختصرة أو الفاتورة الكاملة؛ لا يلزم ذكر كل الحقول.')}</span>
              <span className={`tabular-nums ${tooLong ? 'font-semibold text-destructive' : 'text-muted-foreground'}`} data-testid="text-char-count">{text.length.toLocaleString(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW')} / {MAX.toLocaleString(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW')}</span>
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-primary/35 p-4">
              <input
                id={fileId}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={selectFile}
                className="sr-only"
                data-testid="input-invoice-file"
              />
              <label htmlFor={fileId} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-input px-4 text-sm font-semibold hover:bg-muted focus-within:ring-2 focus-within:ring-ring ${pending ? 'pointer-events-none opacity-60' : ''}`} data-testid="button-select-invoice-file">
                <Upload className="h-4 w-4 text-primary" aria-hidden /> {t('ارفع صورة أو PDF')}
              </label>
              <span className="ms-3 text-xs text-muted-foreground">{t('JPG، PNG، WebP أو PDF · حتى ٨ م.ب. · حتى ٦ صفحات ممسوحة')}</span>
              {file && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm" data-testid="text-selected-invoice-file">
                  <span className="min-w-0 truncate">{file.name}</span>
                  <button type="button" disabled={pending} onClick={removeFile} aria-label={t('إزالة ملف الفاتورة')} className="grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-background disabled:opacity-50" data-testid="button-remove-invoice-file">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
              {fileError && <p className="mt-2 text-sm text-destructive" role="alert">{fileError}</p>}
              {bothInputs && <p className="mt-2 text-sm text-destructive" role="alert">{t('استخدم النص أو الملف، وليس الاثنين معًا.')}</p>}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl bg-muted/60 p-3">
              <input id={consentId} type="checkbox" checked={consent} disabled={pending} onChange={(e) => setConsent(e.target.checked)} aria-describedby={privacyId} className="mt-1 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" data-testid="checkbox-consent" />
              <label htmlFor={consentId} className="text-sm leading-relaxed">{t('أوافق على إرسال النص أو الملف إلى OpenAI عبر Replit لتحليله، وأؤكد أنه لا يحتوي على معلومات حساسة.')}</label>
            </div>
            {touched && !consent && !pending && <p className="mt-2 text-xs text-destructive">{t('يلزم تأكيد الموافقة قبل التحليل.')}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={pending || !consent || invalid || !!fileError} className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-[0_10px_24px_-12px_hsl(186_62%_20%/0.8)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" data-testid="button-analyze-invoice">
                {pending ? <><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden /> {t('جارٍ التحليل…')}</> : t('حلّل الفاتورة')}
              </button>
              {text && !pending && (
                <button type="button" onClick={() => { edit(''); setTouched(false); }} className="h-12 rounded-xl border border-input px-5 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-clear-invoice">{t('مسح النص')}</button>
              )}
            </div>
            <p className="sr-only" role="status" aria-live="polite">{pending ? t('جارٍ تحليل الفاتورة') : result ? t('اكتمل التحليل') : ''}</p>

            {analysisError && (
              <div role="alert" className="mt-5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm" data-testid="status-analysis-error">
                <p className="flex gap-2 text-destructive"><XCircle className="h-5 w-5 shrink-0" aria-hidden />{analysisError}</p>
                <button type="button" onClick={() => submit()} disabled={!consent || invalid || pending} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-destructive/40 bg-card px-4 font-semibold text-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" data-testid="button-retry-analysis">
                  <RotateCcw className="h-4 w-4" aria-hidden /> {t('إعادة المحاولة')}
                </button>
              </div>
            )}
          </form>
        </div>

        {pending && (
          <div className="mt-10 space-y-3" aria-hidden data-testid="skeleton-analysis">
            <div className="h-16 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="h-56 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
              <div className="h-56 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
            </div>
          </div>
        )}
        {result && !pending && <Result data={result} />}
      </div>
    </section>
  );
}
