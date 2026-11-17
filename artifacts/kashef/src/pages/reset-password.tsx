import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { AuthFrame, AuthMessage, AuthSubmit, type AuthMethods } from '@/components/auth-presentation';

export default function ResetPasswordPage() {
  const auth = useAuth() as ReturnType<typeof useAuth> & AuthMethods;
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (password.length < 8) return setError('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.');
    if (password !== confirm) return setError('كلمتا المرور غير متطابقتين.');
    setPending(true);
    try { await auth.updatePassword(password); setLocation('/login'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحديث كلمة المرور. افتح رابط الاستعادة مجددًا وحاول مرة أخرى.'); }
    finally { setPending(false); }
  }

  return <AuthFrame eyebrow="تعيين كلمة مرور جديدة" title={<>خطوة أخيرة،<br />ثم تعود لمساحتك.</>} description="اختر كلمة مرور جديدة لحساب كاشف.">
    <form onSubmit={submit} noValidate className="space-y-4" data-testid="form-reset-password">
      <div>
        <label htmlFor="new-password" className="mb-2 block text-sm font-semibold text-foreground">كلمة المرور الجديدة</label>
        <div className="relative"><input id="new-password" data-testid="input-new-password" dir="ltr" type={show ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="8 أحرف على الأقل" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 pr-12 text-left text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /><button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} className="absolute inset-y-0 start-2 grid w-10 place-items-center rounded-lg text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-toggle-new-password">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
      </div>
      <div><label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold text-foreground">تأكيد كلمة المرور</label><input id="confirm-password" data-testid="input-confirm-password" dir="ltr" type={show ? 'text' : 'password'} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" placeholder="أعد كتابة كلمة المرور" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-left text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></div>
      <p className="text-xs leading-5 text-muted-foreground" data-testid="text-password-requirement">استخدم 8 أحرف على الأقل.</p>
      {error && <AuthMessage kind="error" testId="status-reset-password-error">{error}</AuthMessage>}
      <AuthSubmit pending={pending} testId="button-reset-password-submit">{pending ? 'جارٍ حفظ كلمة المرور…' : 'حفظ كلمة المرور'} <KeyRound className="h-4 w-4" aria-hidden /></AuthSubmit>
      <p className="text-center text-xs text-muted-foreground"><ArrowLeft className="me-1 inline h-3.5 w-3.5" aria-hidden />تأكد من فتح رابط الاستعادة الذي وصلك عبر البريد.</p>
    </form>
  </AuthFrame>;
}
