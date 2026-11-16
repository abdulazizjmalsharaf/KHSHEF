import Decimal from "decimal.js";
import type { InvoiceAnalysis, ArithmeticCheck } from "@workspace/api-zod";
import type { ExtractedInvoice } from "./invoice-extraction";

const D = Decimal.clone({ precision: 48, rounding: Decimal.ROUND_HALF_UP });
const CURRENCY_DIGITS: Record<string, number> = {
  KWD: 3, BHD: 3, OMR: 3, JOD: 3, TND: 3,
  SAR: 2, USD: 2, EUR: 2, AED: 2, QAR: 2, GBP: 2, EGP: 2, JPY: 0,
};

export function verifyInvoice(invoice: ExtractedInvoice): InvoiceAnalysis {
  const knownDigits = invoice.currency === null ? undefined : CURRENCY_DIGITS[invoice.currency];
  const digits = knownDigits ?? 3;
  const round = (d: Decimal) => d.toDecimalPlaces(digits, D.ROUND_HALF_UP);
  const money = (d: Decimal) => round(d).toFixed(digits);
  const value = (s: string | null) => new D(s ?? "0");
  const warnings: string[] = [...invoice.notes];
  if (knownDigits === undefined) warnings.push("العملة غير محددة أو غير مدعومة للتقريب؛ عرضنا الحساب بثلاث منازل للمراجعة فقط.");
  if (invoice.unsupportedAdjustments) warnings.push("توجد بيانات أو تسويات غير واضحة؛ لا يمكن اعتماد المقارنة النهائية.");
  if (invoice.sourceReviewRequired) warnings.push("استُخرجت البيانات من صورة أو صفحة ممسوحة؛ راجع الأرقام في الأصل، لذلك تبقى المطابقة غير مؤكدة.");
  if (invoice.taxIncluded) warnings.push("الأسعار شاملة الضريبة؛ يلزم تحديد أساس المجاميع يدويًا، ولم نضف الضريبة مرة أخرى.");
  if (invoice.discountAmount === null) warnings.push("خصم الفاتورة غير مذكور؛ الإجمالي المحسوب يستخدم الخصومات الصريحة فقط، ولا يؤكد عدم وجود خصم آخر.");
  if (invoice.taxAmount === null) warnings.push("ضريبة الفاتورة غير مذكورة؛ لم نفترض معدل ضريبة أو نؤكد أنها صفر.");
  if (invoice.additionalCharges !== null && invoice.taxRate !== null) warnings.push("توجد رسوم إضافية؛ لم نتحقق من وعائها الضريبي أو ضريبة الرسوم.");
  const safeBasis = !invoice.unsupportedAdjustments && !invoice.sourceReviewRequired && invoice.taxIncluded !== true && knownDigits !== undefined;
  const check = (label: string, stated: string | null, calc: Decimal | null, reliable = safeBasis): ArithmeticCheck => {
    const calculated = calc === null ? null : money(calc);
    const difference = calc !== null && stated !== null ? money(value(stated).minus(round(calc))) : null;
    return {
      label, stated, calculated, difference,
      status: !reliable || difference === null ? "unverified" : value(difference).isZero() ? "match" : "mismatch",
    };
  };
  let subtotal = new D(0);
  let itemTaxes = new D(0);
  let allLines = invoice.items.length > 0;
  let invalidDiscount = false;
  const itemChecks = invoice.items.map((line, i) => {
    if (invoice.taxIncluded || invoice.unsupportedAdjustments) {
      allLines = false;
      return check(line.description, line.lineTotal, null);
    }
    if (line.quantity === null || line.unitPrice === null) {
      allLines = false;
      warnings.push(`الصنف ${i + 1}: الكمية أو سعر الوحدة غير مذكور، فلم نخمنه.`);
      return check(line.description, line.lineTotal, null);
    }
    const base = value(line.quantity).times(value(line.unitPrice));
    const net = base.minus(value(line.discountAmount));
    if (net.isNegative()) invalidDiscount = true;
    subtotal = subtotal.plus(round(net));
    itemTaxes = itemTaxes.plus(value(line.taxAmount));
    return check(line.description, line.lineTotal, net.plus(value(line.taxAmount)), safeBasis && !net.isNegative());
  });
  if (invalidDiscount) warnings.push("خصم أحد الأصناف أكبر من قيمته؛ راجع القيم المستخرجة.");
  const safeTotals = safeBasis && allLines && !invalidDiscount;
  const base = allLines ? subtotal : null;
  if (invoice.subtotal === null) warnings.push("المجموع الفرعي غير مذكور صراحة في النص.");
  const checks = [check("المجموع الفرعي بعد خصومات الأصناف وقبل ضريبتها", invoice.subtotal, base, safeTotals)];
  // Rate comparisons require an explicit base and adjustment amount, never invent missing amounts.
  if (invoice.discountRate !== null) {
    const calc = base !== null ? base.times(value(invoice.discountRate)).div(100) : null;
    checks.push(check("خصم الفاتورة حسب النسبة المذكورة", invoice.discountAmount, calc, safeTotals));
    if (invoice.discountAmount === null) warnings.push("نسبة الخصم مذكورة دون مبلغ؛ لم نستخدم مبلغًا مستنتجًا في الإجمالي.");
  }
  const net = base?.minus(value(invoice.discountAmount)) ?? null;
  if (net?.isNegative()) warnings.push("خصم الفاتورة أكبر من مجموع الأصناف.");
  if (invoice.taxRate !== null) {
    const calc = net !== null ? net.times(value(invoice.taxRate)).div(100) : null;
    checks.push(check("ضريبة الفاتورة على المجموع بعد الخصم (دون الرسوم)", invoice.taxAmount, calc,
      safeTotals && invoice.discountAmount !== null && (invoice.additionalCharges === null || value(invoice.additionalCharges).isZero()) && !net?.isNegative()));
    if (invoice.taxAmount === null) warnings.push("نسبة الضريبة مذكورة دون مبلغ؛ لم نستخدم مبلغًا مستنتجًا في الإجمالي.");
  }
  const total = net === null ? null : net.plus(itemTaxes).plus(value(invoice.taxAmount)).plus(value(invoice.additionalCharges));
  const explicitAdjustments = invoice.discountAmount !== null && invoice.taxAmount !== null;
  checks.push(check("الإجمالي النهائي بالمبالغ المذكورة فقط", invoice.total, total,
    safeTotals && explicitAdjustments && !net?.isNegative()));
  if (invoice.total === null) warnings.push("الإجمالي النهائي غير مذكور، ولا يمكن تأكيد مطابقته.");
  const allChecks = [...itemChecks, ...checks];
  return {
    invoice, itemChecks, checks, warnings: [...new Set(warnings)],
    status: allChecks.some((c) => c.status === "mismatch") ? "mismatch"
      : warnings.length || allChecks.some((c) => c.status === "unverified") ? "unverified" : "match",
    roundingNote: `حساب عشري دقيق، وتقريب النصف للأعلى إلى ${digits} منازل لكل صنف ثم جمع الأصناف. الصنف = الكمية × سعر الوحدة − خصمه + ضريبته. الإجمالي = مجموع الأصناف الصافي − خصم الفاتورة + ضرائب الأصناف + ضريبة الفاتورة + الرسوم المذكورة. القيم الغائبة تبقى «غير مذكور»؛ الإجمالي المقارن مشروط بالمبالغ الصريحة فقط. الفرق = المذكور − المحسوب. القيم الموجبة تعني أن المذكور أعلى.`,
  };
}
