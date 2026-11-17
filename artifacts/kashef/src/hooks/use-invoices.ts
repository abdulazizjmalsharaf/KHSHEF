import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabase-client';
import type {
  InvoiceCheck,
  InvoiceExtraction,
  InvoiceItemRow,
  InvoiceListRow,
  InvoiceRow,
  InvoiceStatus,
  SupplierPriceRow,
} from '@/lib/invoice-types';

const BUCKET = 'invoice-documents';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

type AnalysisResult = {
  extraction: InvoiceExtraction;
  checks: InvoiceCheck[];
  status: InvoiceStatus;
};

function cleanFileName(file: File) {
  const safe = file.name.normalize('NFKC').replace(/[^\p{L}\p{N}._-]/gu, '_').slice(-80);
  return safe || 'invoice';
}

function validateDocument(file: File, label: string) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const fallbackType = MIME_BY_EXTENSION[extension];
  const contentType = file.type || fallbackType;
  if (!contentType || !ALLOWED_TYPES.has(contentType) || (fallbackType && contentType !== fallbackType)) {
    throw new Error(`صيغة ${label} غير مدعومة. ارفع JPG أو PNG أو WebP أو PDF.`);
  }
  if (file.size <= 0) {
    throw new Error(`ملف ${label} فارغ. اختر صورة أو PDF صالحًا.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`حجم ${label} أكبر من 10 ميغابايت.`);
  }
  return contentType;
}

function throwFor(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

async function functionErrorCode(error: unknown, data: unknown): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }
  if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
    } catch {
      return '';
    }
  }
  return '';
}

async function createInvoice(
  userId: string,
  invoiceFile: File,
  supplierId: string | null,
  receiptFile?: File | null,
) {
  const invoiceType = validateDocument(invoiceFile, 'الفاتورة');
  const receiptType = receiptFile ? validateDocument(receiptFile, 'سند الاستلام') : null;

  const supabase = getSupabaseClient();
  const invoiceId = crypto.randomUUID();
  const invoicePath = `${userId}/${invoiceId}/invoice-${cleanFileName(invoiceFile)}`;
  const receiptPath = receiptFile
    ? `${userId}/${invoiceId}/receipt-${cleanFileName(receiptFile)}`
    : null;
  const uploadedPaths: string[] = [];

  try {
    const { error: invoiceUploadError } = await supabase.storage.from(BUCKET).upload(invoicePath, invoiceFile, {
      contentType: invoiceType,
      upsert: false,
    });
    if (invoiceUploadError) throwFor(invoiceUploadError, 'تعذر حفظ صورة الفاتورة.');
    uploadedPaths.push(invoicePath);

    if (receiptFile && receiptPath) {
      const { error: receiptUploadError } = await supabase.storage.from(BUCKET).upload(receiptPath, receiptFile, {
        contentType: receiptType!,
        upsert: false,
      });
      if (receiptUploadError) throwFor(receiptUploadError, 'تعذر حفظ صورة سند الاستلام.');
      uploadedPaths.push(receiptPath);
    }

    const { error: rowError } = await supabase.from('invoices').insert({
      id: invoiceId,
      supplier_id: supplierId || null,
      invoice_path: invoicePath,
      receipt_path: receiptPath,
      status: 'under_review',
    });
    if (rowError) throwFor(rowError, 'تعذر إنشاء سجل الفاتورة.');

    const { data, error: analysisError } = await supabase.functions.invoke('invoice-review', {
      body: { action: 'analyze', invoiceId, invoicePath, receiptPath },
    });
    if (analysisError) {
      const apiError = await functionErrorCode(analysisError, data);
      const messages: Record<string, string> = {
        ai_not_configured: 'خدمة قراءة الفواتير غير مفعّلة بعد. يلزم ضبط مفتاح الذكاء الاصطناعي في أسرار Supabase.',
        unreadable_invoice: 'لم نتمكن من قراءة الفاتورة. ارفع صورة أوضح أو ملف PDF كامل.',
        invoice_not_found: 'الفاتورة غير متاحة لحسابك. أعد رفعها من جديد.',
        invoice_supplier_unavailable: 'المورد المحدد غير متاح الآن. حدّث قائمة الموردين ثم أعد المحاولة.',
        invoice_image_unavailable: 'تعذر فتح الملف المحفوظ. أعد رفع الفاتورة.',
        receipt_image_unavailable: 'تعذر فتح سند الاستلام. أعد رفعه أو احذفه وأكمل بدونه.',
        unsupported_file_type: 'صيغة الملف غير مدعومة. استخدم JPG أو PNG أو WebP أو PDF.',
        file_too_large: 'حجم الملف يتجاوز 10 ميغابايت.',
        analysis_timeout: 'استغرق تحليل الملف وقتاً أطول من المتوقع. حاول بصورة أوضح أو ملف أصغر.',
      };
      throw new Error(messages[apiError] || 'تعذر تحليل الفاتورة الآن. حاول مرة أخرى بعد قليل.');
    }

    const result = data as AnalysisResult;
    if (!result?.extraction || !Array.isArray(result.checks)) {
      throw new Error('وصلت نتيجة غير مكتملة من خدمة قراءة الفواتير.');
    }
    await saveVerifiedReview(invoiceId, result.extraction);
    return invoiceId;
  } catch (error) {
    await supabase.from('invoices').delete().eq('id', invoiceId);
    if (uploadedPaths.length) {
      await supabase.storage.from(BUCKET).remove(uploadedPaths);
    }
    throw error;
  }
}

async function saveVerifiedReview(
  invoiceId: string,
  extraction: InvoiceExtraction,
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('invoice-review', {
    body: { action: 'verify', invoiceId, extraction },
  });
  if (error || !data?.extraction || !Array.isArray(data.checks)) {
    const apiError = await functionErrorCode(error, data);
    const messages: Record<string, string> = {
      invoice_not_found: 'الفاتورة غير متاحة لحسابك. حدّث الصفحة وحاول مرة أخرى.',
      invoice_supplier_unavailable: 'المورد المحدد غير متاح الآن. اختر المورد مجددًا قبل المتابعة.',
    };
    throw new Error(messages[apiError] || 'تعذر إكمال التحقق الحسابي. أعد المحاولة.');
  }
  const verified = data as AnalysisResult;
  const { error: saveError } = await supabase.rpc('save_invoice_review', {
    p_invoice_id: invoiceId,
    p_extraction: verified.extraction,
    p_checks: verified.checks,
    p_status: verified.status,
  });
  if (saveError) throwFor(saveError, 'تعذر حفظ نتيجة مراجعة الفاتورة.');
  return verified;
}

export function useCreateInvoice(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceFile, supplierId, receiptFile }: {
      invoiceFile: File;
      supplierId?: string | null;
      receiptFile?: File | null;
    }) => createInvoice(userId, invoiceFile, supplierId ?? null, receiptFile),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices', userId] }),
  });
}

export function useInvoiceList(userId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('invoices')
        .select('id, supplier_name, invoice_number, invoice_date, currency, total_amount, status, created_at, checks')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvoiceListRow[];
    },
  });
}

export function useInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoice', invoiceId],
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('invoices')
        .select('*')
        .eq('id', invoiceId!)
        .single();
      if (error) throw error;
      return data as InvoiceRow;
    },
  });
}

export function useInvoiceItems(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoice-items', invoiceId],
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('invoice_items')
        .select('id, name, quantity, unit, unit_price, line_total, confidence')
        .eq('invoice_id', invoiceId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as InvoiceItemRow[];
    },
  });
}

export function useInvoiceDocument(path: string | undefined) {
  const query = useQuery({
    queryKey: ['invoice-document', path],
    enabled: Boolean(path),
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage.from(BUCKET).download(path!);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const [objectUrl, setObjectUrl] = useState<string>();

  useEffect(() => {
    if (!query.data) {
      setObjectUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(query.data);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [query.data]);

  return { ...query, data: objectUrl };
}

export function useSaveInvoiceReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, extraction }: { invoiceId: string; extraction: InvoiceExtraction }) => {
      const result = await saveVerifiedReview(invoiceId, extraction);
      return { invoiceId, ...result };
    },
    onSuccess: ({ invoiceId }) => {
      void queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ['invoice-items', invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useSetInvoiceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: 'approved' | 'disputed' }) => {
      const supabase = getSupabaseClient();
      const now = new Date().toISOString();
      const { error } = await supabase.from('invoices')
        .update({
          status,
          updated_at: now,
          ...(status === 'approved' ? { approved_at: now } : { disputed_at: now }),
        })
        .eq('id', invoiceId);
      if (error) throw error;
      return { invoiceId, status };
    },
    onSuccess: ({ invoiceId }) => {
      void queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

function normalizeKey(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function useSupplierPrices(userId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-prices', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('supplier_price_agreements')
        .select('*')
        .order('supplier_name')
        .order('item_name');
      if (error) throw error;
      return (data ?? []) as SupplierPriceRow[];
    },
  });
}

export function useSaveSupplierPrice(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      supplierName: string;
      supplierId?: string | null;
      itemName: string;
      unit: string;
      unitPrice: string;
      currency?: string;
    }) => {
      const supplierName = input.supplierName.trim();
      const itemName = input.itemName.trim();
      const unitPrice = input.unitPrice.trim();
      if (!supplierName || !itemName || !unitPrice || !Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0) {
        throw new Error('أدخل اسم المورد والصنف وسعراً صحيحاً غير سالب.');
      }
      const supabase = getSupabaseClient();
      let savedSupplierName = supplierName;
      let supplierKey = normalizeKey(supplierName);
      if (input.supplierId) {
        const { data: supplier, error: supplierError } = await supabase.from('suppliers')
          .select('id, name, supplier_key')
          .eq('id', input.supplierId)
          .single();
        if (supplierError || !supplier) {
          throw new Error('المورد غير متاح في حسابك. حدّث القائمة ثم حاول مرة أخرى.');
        }
        savedSupplierName = supplier.name;
        supplierKey = supplier.supplier_key || normalizeKey(supplier.name);
      }
      const itemKey = normalizeKey(itemName);
      if (!supplierKey || !itemKey) throw new Error('اسم المورد أو الصنف غير صالح.');
      const values = {
        user_id: userId,
        supplier_id: input.supplierId || null,
        supplier_name: savedSupplierName,
        supplier_key: supplierKey,
        item_name: itemName,
        item_key: itemKey,
        unit: input.unit.trim() || null,
        unit_key: normalizeKey(input.unit),
        unit_price: unitPrice,
        currency: (input.currency || 'KWD').toUpperCase(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = input.id
        ? await supabase.from('supplier_price_agreements')
          .update(values)
          .eq('id', input.id)
          .select('*')
          .single()
        : await supabase.from('supplier_price_agreements')
          .upsert(values, { onConflict: 'user_id,supplier_key,item_key,unit_key,currency' })
          .select('*')
          .single();
      if (error) throw error;
      return data as SupplierPriceRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['supplier-prices', userId] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useDeleteSupplierPrice(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('supplier_price_agreements').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['supplier-prices', userId] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
