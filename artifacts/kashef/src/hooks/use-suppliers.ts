import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { SupplierRow } from "@/lib/invoice-types";

const IMPORT_BUCKET = "supplier-price-imports";
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export type SupplierSaveInput = {
  id?: string;
  name: string;
  contactPhone: string;
};

export type SupplierPriceListItem = {
  itemName: string;
  unit: string | null;
  unitPrice: string | null;
  confidence: number;
};

export type SupplierPriceListResult = {
  supplierName: string | null;
  currency: string | null;
  items: SupplierPriceListItem[];
  skippedRows: number;
  truncated: boolean;
  sourceType: "image" | "excel";
};

export type ConfirmedSupplierPriceItem = {
  itemName: string;
  unit: string | null;
  unitPrice: string;
};

function normalizeKey(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function safeFileName(file: File) {
  return (
    file.name
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}._-]/gu, "_")
      .slice(-80) || "price-list"
  );
}

function messageForImportError(code: string) {
  const messages: Record<string, string> = {
    authentication_required: "سجّل الدخول قبل رفع قائمة الأسعار.",
    invalid_session: "انتهت جلسة الدخول. سجّل الدخول ثم حاول مرة أخرى.",
    invalid_document_path: "تعذر التحقق من الملف المرفوع. أعد اختياره.",
    file_too_large: "حجم الملف يتجاوز 10 ميغابايت.",
    unsupported_file_type:
      "ارفع صورة JPG أو PNG أو WebP أو ملف Excel بصيغة XLS أو XLSX.",
    file_extension_mismatch:
      "امتداد الملف لا يطابق محتواه. اختر صورة أو ملف Excel صحيحًا.",
    price_list_unavailable: "تعذر فتح الملف بأمان. أعد رفعه وحاول مرة أخرى.",
    unreadable_price_list:
      "لم نتمكن من قراءة صفوف الأسعار. اختر ملفًا أو صورة أوضح.",
    ai_not_configured: "قراءة الصور غير مفعّلة بعد. يمكن استيراد ملفات Excel.",
    analysis_timeout:
      "استغرق تحليل الصورة وقتًا أطول من المتوقع. حاول بصورة أصغر.",
  };
  return (
    messages[code] ||
    "تعذر قراءة قائمة الأسعار الآن. تحقق من الملف وحاول مرة أخرى."
  );
}

async function errorCode(error: unknown, data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }
  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    error.context instanceof Response
  ) {
    try {
      const body: unknown = await error.context.clone().json();
      if (
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        return body.error;
      }
    } catch {
      return "";
    }
  }
  return "";
}

export function useSuppliers(userId: string | undefined) {
  return useQuery({
    queryKey: ["suppliers", userId],
    enabled: Boolean(userId),
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from("suppliers")
        .select(
          "id, user_id, name, supplier_key, contact_phone, created_at, updated_at",
        )
        .order("name");
      if (error) throw error;
      return (data ?? []) as SupplierRow[];
    },
  });
}

export function useSaveSupplier(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SupplierSaveInput) => {
      if (!userId) throw new Error("سجّل الدخول قبل حفظ المورد.");
      const name = input.name.trim();
      const contactPhone = input.contactPhone.trim();
      const supplierKey = normalizeKey(name);
      if (!name || name.length > 80 || !supplierKey) {
        throw new Error("اكتب اسم مورد من حرف إلى ٨٠ حرفًا.");
      }
      if (contactPhone && !/^[+()\d٠-٩۰-۹.\-\s]{5,32}$/.test(contactPhone)) {
        throw new Error("اكتب رقم تواصل صحيحًا من ٥ إلى ٣٢ خانة.");
      }

      const supabase = getSupabaseClient();
      const { data: currentSuppliers, error: listError } = await supabase
        .from("suppliers")
        .select("id, name, supplier_key");
      if (listError)
        throw new Error("تعذر التحقق من الموردين المحفوظين. أعد المحاولة.");
      const duplicate = (currentSuppliers ?? []).some(
        (supplier) =>
          supplier.id !== input.id &&
          normalizeKey(supplier.supplier_key || supplier.name) === supplierKey,
      );
      if (duplicate) throw new Error("هذا المورد موجود في قائمتك من قبل.");

      const values = {
        name,
        supplier_key: supplierKey,
        contact_phone: contactPhone || null,
      };
      if (input.id) {
        const { data, error } = await supabase
          .from("suppliers")
          .update(values)
          .eq("id", input.id)
          .select(
            "id, user_id, name, supplier_key, contact_phone, created_at, updated_at",
          )
          .single();
        if (error)
          throw new Error("تعذر تعديل المورد. تأكد أن السجل تابع لحسابك.");
        return data as SupplierRow;
      }

      const { data, error } = await supabase
        .from("suppliers")
        .insert(values)
        .select(
          "id, user_id, name, supplier_key, contact_phone, created_at, updated_at",
        )
        .single();
      if (error)
        throw new Error(
          "تعذر إضافة المورد. تحقق من البيانات ثم حاول مرة أخرى.",
        );
      return data as SupplierRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers", userId] });
      void queryClient.invalidateQueries({
        queryKey: ["supplier-prices", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useDeleteSupplier(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (supplierId: string) => {
      if (!userId) throw new Error("سجّل الدخول قبل حذف المورد.");
      const { error } = await getSupabaseClient()
        .from("suppliers")
        .delete()
        .eq("id", supplierId);
      if (error)
        throw new Error(
          "تعذر حذف المورد. تأكد أن السجل تابع لحسابك ثم حاول مجددًا.",
        );
      return supplierId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers", userId] });
      void queryClient.invalidateQueries({
        queryKey: ["supplier-prices", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useImportSupplierPriceList(userId: string | undefined) {
  return useMutation({
    mutationFn: async (file: File): Promise<SupplierPriceListResult> => {
      if (!userId) throw new Error("سجّل الدخول قبل رفع قائمة الأسعار.");
      if (!file.size || file.size > MAX_IMPORT_BYTES) {
        throw new Error("اختر ملفًا أصغر من 10 ميغابايت.");
      }
      const extension = file.name.split(".").pop()?.toLowerCase();
      const mimeByExtension: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
      const acceptedExtensions = new Set(Object.keys(mimeByExtension));
      if (!extension || !acceptedExtensions.has(extension)) {
        throw new Error(
          "ارفع صورة JPG أو PNG أو WebP أو ملف Excel بصيغة XLS أو XLSX.",
        );
      }
      const expectedContentType = mimeByExtension[extension];
      const browserMimeType = file.type.toLowerCase();
      if (
        browserMimeType &&
        browserMimeType !== "application/octet-stream" &&
        browserMimeType !== expectedContentType &&
        !(extension === "jpg" && browserMimeType === "image/jpg")
      ) {
        throw new Error(
          "صيغة الملف لا تطابق امتداده. اختر صورة أو ملف Excel صحيحًا.",
        );
      }
      const contentType = expectedContentType;

      const path = `${userId}/${crypto.randomUUID()}/${safeFileName(file)}`;
      const supabase = getSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from(IMPORT_BUCKET)
        .upload(path, file, {
          contentType,
          upsert: false,
        });
      if (uploadError)
        throw new Error(
          "تعذر رفع الملف الخاص. تحقق من اتصال Supabase ثم حاول مجددًا.",
        );

      try {
        const { data, error } = await supabase.functions.invoke(
          "supplier-price-import",
          {
            body: { filePath: path },
          },
        );
        if (error)
          throw new Error(messageForImportError(await errorCode(error, data)));
        if (
          !data ||
          !Array.isArray(data.items) ||
          !["image", "excel"].includes(data.sourceType)
        ) {
          throw new Error(messageForImportError("unreadable_price_list"));
        }
        const items = data.items.filter(
          (item: unknown): item is SupplierPriceListItem =>
            item !== null &&
            item !== undefined &&
            typeof item === "object" &&
            "itemName" in item &&
            typeof item.itemName === "string" &&
            "confidence" in item &&
            typeof item.confidence === "number" &&
            "unitPrice" in item &&
            (item.unitPrice === null || typeof item.unitPrice === "string") &&
            "unit" in item &&
            (item.unit === null || typeof item.unit === "string"),
        );
        if (!items.length)
          throw new Error(messageForImportError("unreadable_price_list"));
        return {
          supplierName:
            typeof data.supplierName === "string" ? data.supplierName : null,
          currency: typeof data.currency === "string" ? data.currency : null,
          items,
          skippedRows: Number.isSafeInteger(data.skippedRows)
            ? Math.max(0, data.skippedRows)
            : 0,
          truncated: data.truncated === true,
          sourceType: data.sourceType,
        };
      } finally {
        await supabase.storage.from(IMPORT_BUCKET).remove([path]);
      }
    },
  });
}

export function useSaveSupplierPriceImport(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      supplierId: string;
      items: ConfirmedSupplierPriceItem[];
      confirmedKwd: boolean;
    }) => {
      if (!userId) throw new Error("سجّل الدخول قبل حفظ الأسعار.");
      if (!input.confirmedKwd)
        throw new Error("أكد أن الأسعار بالدينار الكويتي قبل الحفظ.");
      if (
        !input.supplierId ||
        !input.items.length ||
        input.items.length > 500
      ) {
        throw new Error("تحقق من المورد وعدد الأصناف قبل الحفظ.");
      }
      const items = input.items.map((item) => {
        const itemName = item.itemName.trim();
        const price = item.unitPrice.trim();
        if (
          !itemName ||
          !/^\d+(?:\.\d{1,6})?$/.test(price) ||
          !Number.isFinite(Number(price))
        ) {
          throw new Error("راجع اسم كل صنف وسعره قبل الحفظ.");
        }
        return {
          item_name: itemName,
          item_key: normalizeKey(itemName),
          unit: item.unit?.trim() || "",
          unit_key: normalizeKey(item.unit || ""),
          unit_price: price,
        };
      });

      const { data, error } = await getSupabaseClient().rpc(
        "save_supplier_price_import",
        {
          p_supplier_id: input.supplierId,
          p_items: items,
          p_confirmed_kwd: input.confirmedKwd,
        },
      );
      if (error) {
        if (error.message.includes("duplicate_import_rows")) {
          throw new Error(
            "توجد أصناف مكررة بنفس الوحدة. احذف أو عدّل الصف المكرر قبل الحفظ.",
          );
        }
        if (error.message.includes("supplier_not_found")) {
          throw new Error(
            "المورد غير متاح في حسابك. حدّث القائمة وحاول مرة أخرى.",
          );
        }
        if (error.message.includes("kwd_confirmation_required")) {
          throw new Error("أكد أن الأسعار بالدينار الكويتي قبل الحفظ.");
        }
        throw new Error(
          "تعذر حفظ قائمة الأسعار كاملة. لم نحفظ أي صف؛ راجع البيانات وحاول مجددًا.",
        );
      }
      return typeof data === "number" ? data : items.length;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["supplier-prices", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
