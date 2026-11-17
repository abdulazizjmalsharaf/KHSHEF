import { getSupabaseClient } from '@/lib/supabase-client';

/** Save a supplier for the signed-in owner; RLS derives the owner from auth.uid(). */
export async function saveSupplier(name: string): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > 80) {
    throw new Error('اكتب اسم مورد من حرف إلى ٨٠ حرفًا.');
  }

  const supabase = getSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('سجّل الدخول قبل إضافة المورد.');
  }

  const { error } = await supabase.from('suppliers').insert({ name: trimmedName });
  if (error) {
    throw new Error('تعذّر حفظ المورد في Supabase. تحقق من إعداد الجدول والاتصال ثم حاول مجددًا.');
  }
}
