import { useAuth } from '@/components/auth-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { useInvoiceList, useSupplierPrices } from '@/hooks/use-invoices';
import { useSuppliers } from '@/hooks/use-suppliers';
import { useTheme } from '@/hooks/use-theme';
import { getLanguage, t } from '@/lib/i18n';
import { LockKeyhole, Mail, Moon, Sun, Store } from 'lucide-react';
import { PageIntro, QueryProblem, WorkspaceFrame } from '@/pages/invoice-workspace';

function SettingsSkeleton() {
  return (
    <div className="space-y-5" aria-label={t('جارٍ تحميل الإعدادات')} data-testid="status-settings-loading">
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      <div className="h-48 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggle, storageFailed } = useTheme();
  const invoices = useInvoiceList(user?.id);
  const suppliers = useSuppliers(user?.id);
  const prices = useSupplierPrices(user?.id);
  const isLoading = invoices.isLoading || suppliers.isLoading || prices.isLoading;
  const hasError = invoices.isError || suppliers.isError || prices.isError;
  const retry = () => {
    void invoices.refetch();
    void suppliers.refetch();
    void prices.refetch();
  };
  const businessName = typeof user?.user_metadata?.business_name === 'string'
    ? user.user_metadata.business_name
    : '';

  return (
    <WorkspaceFrame>
      <PageIntro
        eyebrow="مساحة العمل · الحساب"
        title="الإعدادات"
        description="راجع الحساب الذي تستخدمه واختر مظهر مساحة العمل. تبقى بيانات المتجر خاصة بحسابك."
      />
      {hasError ? (
        <QueryProblem message="تعذر تحميل بيانات مساحة العمل المرتبطة بحسابك." onRetry={retry} testId="status-settings-error" />
      ) : isLoading ? (
        <SettingsSkeleton />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" data-testid="section-account-settings">
            <div className="border-b border-border/70 bg-secondary/45 px-5 py-5 sm:px-7">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><Store className="h-5 w-5" aria-hidden /></span>
        <h2 className="mt-4 font-display text-2xl">{t('حساب المتجر')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('بيانات الحساب المسجل حاليًا')}</p>
            </div>
            <dl className="divide-y divide-border/70 px-5 sm:px-7">
              <div className="flex items-start gap-4 py-5" data-testid="row-account-business-name">
                <Store className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t('اسم المنشأة')}</dt>
                  <dd className="mt-1 break-words font-semibold text-foreground" data-testid="text-account-business-name">{businessName || t('لم يُحدد اسم المنشأة')}</dd>
                </div>
              </div>
              <div className="flex items-start gap-4 py-5" data-testid="row-account-email">
                <Mail className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t('البريد الإلكتروني')}</dt>
                  <dd className="mt-1 break-all font-semibold text-foreground" dir="ltr" data-testid="text-account-email">{user?.email || '—'}</dd>
                </div>
              </div>
            </dl>
            <div className="mx-5 mb-5 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.045] p-4 sm:mx-7 sm:mb-7" data-testid="notice-private-account-data">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <p className="text-sm leading-6 text-muted-foreground">{t('الفواتير والموردون وأسعارهم محفوظة ضمن مساحة حسابك الخاصة، ولا تظهر لمتاجر أخرى.')}</p>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" data-testid="section-theme-settings">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-primary/75">{t('المظهر')}</p>
                  <h2 className="mt-1 font-display text-xl">{t('راحة لعينيك')}</h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t('اختر المظهر المناسب لمكان العمل. سيُحفظ اختيارك على هذا الجهاز.')}</p>
                </div>
                <ThemeToggle theme={theme} onToggle={toggle} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${theme === 'light' ? 'border-primary/30 bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground'}`} data-testid="status-light-theme">
                  <Sun className="h-4 w-4" aria-hidden /> {t('فاتح')}
                </div>
                <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${theme === 'dark' ? 'border-primary/30 bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground'}`} data-testid="status-dark-theme">
                  <Moon className="h-4 w-4" aria-hidden /> {t('داكن')}
                </div>
              </div>
              {storageFailed && <p role="status" className="mt-4 text-xs leading-5 text-amber-800 dark:text-amber-300" data-testid="status-theme-storage-warning">{t('تعذر حفظ اختيار المظهر على هذا الجهاز؛ سيبقى التغيير مؤقتًا لهذه الجلسة.')}</p>}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" data-testid="section-workspace-data">
              <p className="text-xs font-semibold text-primary/75">{t('مساحة العمل')}</p>
              <h2 className="mt-1 font-display text-xl">{t('بياناتك الحالية')}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('ملخص للسجلات الموجودة في حسابك، دون إجراء أي تغيير عليها.')}</p>
              <div className="mt-5 grid grid-cols-3 divide-x divide-x-reverse divide-border rounded-xl border border-border bg-background text-center">
                <div className="px-2 py-3" data-testid="count-settings-suppliers"><p className="font-display text-2xl text-foreground">{(suppliers.data ?? []).length.toLocaleString(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW')}</p><p className="mt-1 text-[11px] text-muted-foreground">{t('مورد')}</p></div>
                <div className="px-2 py-3" data-testid="count-settings-prices"><p className="font-display text-2xl text-foreground">{(prices.data ?? []).length.toLocaleString(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW')}</p><p className="mt-1 text-[11px] text-muted-foreground">{t('سعر')}</p></div>
                <div className="px-2 py-3" data-testid="count-settings-invoices"><p className="font-display text-2xl text-foreground">{(invoices.data ?? []).length.toLocaleString(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW')}</p><p className="mt-1 text-[11px] text-muted-foreground">{t('فاتورة')}</p></div>
              </div>
            </section>
          </div>
        </div>
      )}
    </WorkspaceFrame>
  );
}
