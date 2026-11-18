import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Building2, Mail, UserPlus } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { AuthField, AuthFrame, AuthMessage, AuthSubmit, type AuthMethods } from '@/components/auth-presentation';
import { t, useLanguage } from '@/lib/i18n';

export default function RegisterPage() {
  const auth = useAuth() as ReturnType<typeof useAuth> & AuthMethods;
  const { language } = useLanguage();
  const BackArrow = language === 'ar' ? ArrowLeft : ArrowRight;
  const [, setLocation] = useLocation();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (!auth.loading && auth.user) setLocation('/app');
  }, [auth.loading, auth.user, setLocation]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!businessName.trim()) return setError(t('أدخل اسم النشاط التجاري.'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t('أدخل بريدًا إلكترونيًا صحيحًا.'));
    if (password.length < 8) return setError(t('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.'));
    setPending(true);
    try {
      const result = await auth.signUpWithEmail(businessName.trim(), email.trim(), password);
      if (result.needsEmailConfirmation) {
        setCreated(true);
      } else {
        setLocation('/app');
      }
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : 'تعذر إنشاء الحساب. حاول مرة أخرى.'));
    } finally { setPending(false); }
  }

  return <AuthFrame eyebrow="ابدأ مساحة عملك" title={<>{t('حساب واحد،')}<br />{t('ومراجعة أوضح.')}</>} description="أدخل بيانات النشاط والبريد الإلكتروني لتبدأ استخدام كاشف.">
    {created ? <div className="space-y-5">
      <AuthMessage kind="success" testId="status-register-success">{t('أرسلنا رسالة تأكيد إلى')} <b dir="ltr">{email}</b>. {t('افتح الرسالة وأكّد بريدك الإلكتروني قبل تسجيل الدخول. لن تصبح مساحة الحساب جاهزة حتى يتم التأكيد.')}</AuthMessage>
      <Link href="/login" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-register-login">{t('العودة إلى تسجيل الدخول')} <BackArrow className="h-4 w-4" aria-hidden /></Link>
    </div> : <form onSubmit={submit} noValidate className="space-y-4" data-testid="form-register">
      <AuthField id="register-business-name" label="اسم النشاط التجاري" type="text" value={businessName} onChange={setBusinessName} autoComplete="organization" placeholder="مثال: مطعم الساحة" icon={<Building2 className="h-4 w-4" />} />
      <AuthField id="register-email" label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="name@example.com" icon={<Mail className="h-4 w-4" />} />
      <AuthField id="register-password" label="كلمة المرور" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="8 أحرف على الأقل" />
        {error && <AuthMessage kind="error" testId="status-register-error">{t(error)}</AuthMessage>}
        <AuthSubmit pending={pending} testId="button-register-submit">{pending ? t('جارٍ إنشاء الحساب…') : t('إنشاء الحساب')} <UserPlus className="h-4 w-4" aria-hidden /></AuthSubmit>
        <p className="text-center text-xs leading-6 text-muted-foreground" data-testid="text-register-confirmation-note">{t('ستحتاج إلى تأكيد بريدك الإلكتروني قبل استخدام الحساب.')}</p>
        <p className="pt-1 text-center text-sm text-muted-foreground">{t('لديك حساب؟')} <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline" data-testid="link-register-sign-in">{t('تسجيل الدخول')}</Link></p>
    </form>}
  </AuthFrame>;
}
