/**
 * Supabase's public Data API; RLS only permits inserting a name.
 * Never use a service-role key here: VITE_* values are public browser config.
 */
export async function saveSupplier(name: string): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error('إعدادات الاتصال غير مكتملة. أضف إعدادات Supabase ثم أعد تشغيل التطبيق.');
  }
  let validUrl = false;
  try {
    const parsed = new URL(url);
    validUrl = parsed.protocol === 'https:' && parsed.pathname === '/' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
  } catch {
    // Never include configuration values in an error or log.
  }
  if (!validUrl) {
    throw new Error('رابط Supabase غير صحيح. حدّث VITE_SUPABASE_URL برابط المشروع ثم أعد تشغيل التطبيق.');
  }
  let publicKey = key.startsWith('sb_publishable_');
  if (key.startsWith('ey')) {
    try {
      const encoded = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      publicKey = JSON.parse(atob(encoded)).role === 'anon';
    } catch {
      publicKey = false;
    }
  }
  if (!publicKey) {
    throw new Error('مفتاح Supabase غير صحيح. استخدم مفتاح anon أو Publishable فقط.');
  }
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > 80) {
    throw new Error('اكتب اسم مورد من حرف إلى ٨٠ حرفًا.');
  }

  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/suppliers`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        // Do not request a representation: public reads are intentionally denied.
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ name: trimmedName }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('تعذّر تأكيد الحفظ بسبب الاتصال. قد يكون الاسم حُفظ؛ تحقق من Supabase قبل إعادة المحاولة.');
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('لم يُحفظ المورد. تحقق من مفتاح Supabase وصلاحية إضافة الموردين.');
    }
    throw new Error('تعذّر حفظ المورد في Supabase. تحقق من إعداد الجدول والاتصال ثم حاول مجددًا.');
  }
}
