import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { AuthFrame, AuthField, AuthMessage, AuthSubmit, GoogleMark, type AuthMethods } from '@/components/auth-presentation';
import { t, useLanguage } from '@/lib/i18n';

export default function LoginPage() {
  const auth = useAuth() as ReturnType<typeof useAuth> & AuthMethods;
  const { language } = useLanguage();
  const BackArrow = language === 'ar' ? ArrowLeft : ArrowRight;
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!auth.loading && auth.user) setLocation('/app');
  }, [auth.loading, auth.user, setLocation]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t('أدخل بريدًا إلكترونيًا صحيحًا.'));
    if (!password) return setError(t('أدخل كلمة المرور.'));
    setBusy(true);
    try {
      await auth.signInWithPassword(email.trim(), password);
      setLocation('/app');
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : 'تعذر تسجيل الدخول. تحقق من بياناتك وحاول مرة أخرى.'));
    } finally {
      setBusy(false);
    }
  }

  async function signInGoogle() {
    setError('');
    setGoogleBusy(true);
    try {
      await auth.signInWithGoogle();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(/provider.*(not enabled|disabled)|unsupported provider/i.test(message)
        ? t('تسجيل Google غير مفعّل بعد. حاول بالبريد الإلكتروني أو تواصل مع الدعم.')
        : t(message || 'تعذر بدء الدخول باستخدام Google. حاول مرة أخرى.'));
      setGoogleBusy(false);
    }
  }

  return (
    <AuthFrame eyebrow="مساحة عملك الخاصة" title={<>{t('راجع فاتورتك،')}<br />{t('قبل أن تعتمدها.')}</>} description="ادخل لمراجعة فواتير الموردين بهدوء. ملفاتك ونتائجها لا يراها إلا حسابك.">
      <form onSubmit={submit} noValidate className="space-y-4" data-testid="form-login">
        <AuthField id="login-email" label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="name@example.com" icon={<Mail />} />
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="login-password" className="text-sm font-semibold text-foreground">{t('كلمة المرور')}</label>
            <Link href="/forgot-password" className="text-xs font-semibold text-primary underline-offset-4 hover:underline" data-testid="link-forgot-password">{t('نسيت كلمة المرور؟')}</Link>
          </div>
          <div className="relative">
            <input id="login-password" data-testid="input-login-password" dir="ltr" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder={t('أدخل كلمة المرور')} className="min-h-12 w-full rounded-xl border border-input bg-background px-4 ps-12 text-left text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('إخفاء كلمة المرور') : t('إظهار كلمة المرور')} className="absolute inset-y-0 start-2 grid w-11 place-items-center rounded-lg text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-toggle-login-password">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </div>
        {error && <AuthMessage kind="error" testId="status-login-error">{error}</AuthMessage>}
        <AuthSubmit pending={busy} testId="button-login-submit">{busy ? t('جارٍ تسجيل الدخول…') : t('تسجيل الدخول')} <BackArrow className="h-4 w-4" aria-hidden /></AuthSubmit>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{t('أو')}<span className="h-px flex-1 bg-border" /></div>
      <button type="button" onClick={signInGoogle} disabled={googleBusy || busy || auth.loading} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60" data-testid="button-sign-in-google">
        {googleBusy ? <span className="h-4 w-4 animate-pulse rounded-full border-2 border-primary border-t-transparent" aria-hidden /> : <GoogleMark />}
        {googleBusy ? t('جارٍ التحويل…') : t('المتابعة باستخدام Google')}
      </button>
      <p className="mt-5 text-center text-xs leading-6 text-muted-foreground" data-testid="text-login-privacy"><LockKeyhole className="me-1 inline h-3.5 w-3.5 text-primary" aria-hidden />{t('الفواتير محفوظة في مساحة خاصة بحسابك.')}</p>
      <p className="mt-6 text-center text-sm text-muted-foreground">{t('ليس لديك حساب؟')} <Link href="/register" className="font-semibold text-primary underline-offset-4 hover:underline" data-testid="link-register">{t('أنشئ حسابًا')}</Link></p>
    </AuthFrame>
  );
}
