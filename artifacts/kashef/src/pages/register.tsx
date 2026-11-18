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
  const [step, setStep] = useState<'details' | 'awaiting-email' | 'password'>('details');
  const [resendWait, setResendWait] = useState(0);
  const isGuest = Boolean(auth.user?.is_anonymous);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      void auth.ensureGuestSession().catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'تعذر بدء التجربة. حاول مرة أخرى.');
      });
      return;
    }
    const pendingId = localStorage.getItem('kashef:pending-guest-upgrade');
    if (!auth.user.is_anonymous && pendingId === auth.user.id) {
      setBusinessName(String(auth.user.user_metadata?.business_name || ''));
      setEmail(auth.user.email || '');
      setStep('password');
      return;
    }
    if (!auth.user.is_anonymous) setLocation('/app');
  }, [auth.loading, auth.user, auth.ensureGuestSession, setLocation]);

  useEffect(() => {
    if (resendWait <= 0) return;
    const timer = window.setTimeout(() => setResendWait((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendWait]);

  useEffect(() => {
    const errorCode = new URLSearchParams(window.location.search).get('error_code');
    if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
      setError('انتهت صلاحية رابط التأكيد أو تم استخدامه. أرسل رابطًا جديدًا ثم افتحه مباشرة.');
      setStep('awaiting-email');
    } else if (new URLSearchParams(window.location.search).has('error')) {
      setError('رابط التأكيد غير صالح أو استُخدم من قبل. أرسل رابطًا جديدًا.');
      setStep('awaiting-email');
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!businessName.trim()) return setError(t('أدخل اسم النشاط التجاري.'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t('أدخل بريدًا إلكترونيًا صحيحًا.'));
    if (!isGuest && password.length < 8) return setError(t('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.'));
    setPending(true);
    try {
      const result = await auth.signUpWithEmail(businessName.trim(), email.trim(), password);
      if (result.guestUpgrade && result.needsEmailConfirmation) {
        setStep('awaiting-email');
        setResendWait(60);
      } else if (result.guestUpgrade) {
        localStorage.setItem('kashef:pending-guest-upgrade', auth.user?.id || '');
        setStep('password');
        setError('');
      } else if (result.needsEmailConfirmation) {
        setCreated(true);
      } else {
        setLocation('/app');
      }
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : 'تعذر إنشاء الحساب. حاول مرة أخرى.'));
    } finally { setPending(false); }
  }

  async function finishUpgrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError(t('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.'));
    setPending(true);
    try {
      await auth.finishGuestUpgrade(password, businessName || String(auth.user?.user_metadata?.business_name || ''));
      setLocation('/app');
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : 'تعذر إكمال إنشاء الحساب. حاول مرة أخرى.'));
    } finally {
      setPending(false);
    }
  }

  async function resendLink() {
    setError('');
    setPending(true);
    try {
      await auth.resendEmailConfirmation(email, isGuest);
      setResendWait(60);
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : 'تعذر إعادة إرسال رسالة التأكيد.'));
    } finally {
      setPending(false);
    }
  }

  if (auth.loading || (!auth.user && !error)) {
    return <AuthFrame eyebrow="ابدأ مساحة عملك" title={<>{t('حساب واحد،')}<br />{t('ومراجعة أوضح.')}</>} description="جارٍ تجهيز مساحة التجربة الخاصة بك.">
      <p className="text-sm text-muted-foreground" role="status" data-testid="status-register-guest-loading">{t('جارٍ بدء مساحة التجربة…')}</p>
    </AuthFrame>;
  }

  return <AuthFrame eyebrow="ابدأ مساحة عملك" title={<>{t('حساب واحد،')}<br />{t('ومراجعة أوضح.')}</>} description="أدخل بيانات النشاط والبريد الإلكتروني لتبدأ استخدام كاشف.">
    {step === 'awaiting-email' ? <div className="space-y-5">
      <AuthMessage kind="success" testId="status-register-success">
        {t('أرسلنا رابط تأكيد إلى')} <b dir="ltr">{email}</b>. {t('تقدر تواصل التجربة الآن؛ بياناتك محفوظة بالحساب نفسه. افتح الرابط ثم ارجع هنا لإضافة كلمة المرور.')}
      </AuthMessage>
      {error && <AuthMessage kind="error" testId="status-register-error">{t(error)}</AuthMessage>}
      <button type="button" onClick={() => void resendLink()} disabled={pending || resendWait > 0} className="flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-resend-confirmation">
        {pending ? t('جارٍ الإرسال…') : resendWait > 0 ? `${t('إعادة إرسال الرابط بعد')} ${resendWait} ${t('ثانية')}` : t('إعادة إرسال رابط التأكيد')}
      </button>
      <Link href="/app" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" data-testid="link-continue-guest">{t('متابعة التجربة')} <BackArrow className="h-4 w-4" aria-hidden /></Link>
    </div> : step === 'password' ? <form onSubmit={finishUpgrade} noValidate className="space-y-4" data-testid="form-finish-guest-upgrade">
      <AuthMessage kind="success" testId="status-guest-email-verified">{t('تم تأكيد بريدك وربطه ببيانات التجربة. اختر كلمة مرور لتثبيت الحساب.')}</AuthMessage>
      <AuthField id="register-password" label="كلمة المرور" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="8 أحرف على الأقل" />
      {error && <AuthMessage kind="error" testId="status-register-error">{t(error)}</AuthMessage>}
      <AuthSubmit pending={pending} testId="button-register-submit">{pending ? t('جارٍ حفظ كلمة المرور…') : t('إنشاء الحساب')} <UserPlus className="h-4 w-4" aria-hidden /></AuthSubmit>
    </form> : created ? <div className="space-y-5">
      <AuthMessage kind="success" testId="status-register-success">{t('أرسلنا رسالة تأكيد إلى')} <b dir="ltr">{email}</b>. {t('افتح الرسالة وأكّد بريدك الإلكتروني قبل تسجيل الدخول. لن تصبح مساحة الحساب جاهزة حتى يتم التأكيد.')}</AuthMessage>
      <Link href="/login" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-register-login">{t('العودة إلى تسجيل الدخول')} <BackArrow className="h-4 w-4" aria-hidden /></Link>
    </div> : <form onSubmit={submit} noValidate className="space-y-4" data-testid="form-register">
      <AuthField id="register-business-name" label="اسم النشاط التجاري" type="text" value={businessName} onChange={setBusinessName} autoComplete="organization" placeholder="مثال: مطعم الساحة" icon={<Building2 className="h-4 w-4" />} />
      <AuthField id="register-email" label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="name@example.com" icon={<Mail className="h-4 w-4" />} />
      {!isGuest && <AuthField id="register-password" label="كلمة المرور" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="8 أحرف على الأقل" />}
        {error && <AuthMessage kind="error" testId="status-register-error">{t(error)}</AuthMessage>}
        <AuthSubmit pending={pending || (!auth.user && !error)} testId="button-register-submit">{pending ? t('جارٍ إنشاء الحساب…') : isGuest ? t('اربط البريد بحساب التجربة') : t('إنشاء الحساب')} <UserPlus className="h-4 w-4" aria-hidden /></AuthSubmit>
        {isGuest && <p className="text-center text-xs leading-6 text-muted-foreground" data-testid="text-register-confirmation-note">{t('تستمر التجربة بدون تأكيد. ربط البريد يثبت بياناتك على الحساب نفسه، ثم تختار كلمة المرور بعد فتح رابط التأكيد.')}</p>}
        <p className="pt-1 text-center text-sm text-muted-foreground">{t('لديك حساب؟')} <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline" data-testid="link-register-sign-in">{t('تسجيل الدخول')}</Link></p>
    </form>}
  </AuthFrame>;
}
