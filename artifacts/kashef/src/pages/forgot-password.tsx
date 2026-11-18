import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, Mail, Send } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { AuthField, AuthFrame, AuthMessage, AuthSubmit, type AuthMethods } from '@/components/auth-presentation';
import { t, useLanguage } from '@/lib/i18n';

export default function ForgotPasswordPage() {
  const auth = useAuth() as ReturnType<typeof useAuth> & AuthMethods;
  const { language } = useLanguage();
  const BackArrow = language === 'ar' ? ArrowLeft : ArrowRight;
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t('أدخل بريدًا إلكترونيًا صحيحًا.'));
    setPending(true);
    try { await auth.requestPasswordReset(email.trim()); setSent(true); }
    catch (cause) { setError(t(cause instanceof Error ? cause.message : 'تعذر إرسال الطلب الآن. حاول مرة أخرى.')); }
    finally { setPending(false); }
  }

  return <AuthFrame eyebrow="استعادة الوصول" title={<>{t('لنعد إلى')}<br />{t('مساحة عملك.')}</>} description="أدخل البريد المرتبط بحسابك وسنرسل رابطًا لإعادة تعيين كلمة المرور.">
    {sent ? <div className="space-y-5"><AuthMessage kind="success" testId="status-reset-request-success">{t('إذا كان هناك حساب مرتبط بهذا البريد، فستصلك رسالة تتضمن رابط إعادة تعيين كلمة المرور. تحقق من صندوق الوارد والبريد غير المرغوب فيه.')}</AuthMessage><Link href="/login" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-reset-request-login">{t('العودة إلى تسجيل الدخول')} <BackArrow className="h-4 w-4" aria-hidden /></Link></div> :
      <form onSubmit={submit} noValidate className="space-y-4" data-testid="form-forgot-password">
        <AuthField id="reset-request-email" label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="name@example.com" icon={<Mail className="h-4 w-4" />} />
        {error && <AuthMessage kind="error" testId="status-reset-request-error">{t(error)}</AuthMessage>}
        <AuthSubmit pending={pending} testId="button-reset-request-submit">{pending ? t('جارٍ الإرسال…') : t('إرسال رابط الاستعادة')} <Send className="h-4 w-4" aria-hidden /></AuthSubmit>
        <p className="pt-2 text-center text-sm text-muted-foreground"><Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline" data-testid="link-reset-request-back">{t('العودة إلى تسجيل الدخول')}</Link></p>
      </form>}
  </AuthFrame>;
}
