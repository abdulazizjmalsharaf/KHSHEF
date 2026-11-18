import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabase-client';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  ensureGuestSession: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (businessName: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean; guestUpgrade: boolean }>;
  finishGuestUpgrade: (password: string, businessName: string) => Promise<void>;
  resendEmailConfirmation: (email: string, guestUpgrade: boolean) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const PENDING_GUEST_UPGRADE_KEY = 'kashef:pending-guest-upgrade';

function appUrl(path: string) {
  const basePath = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return new URL(path.replace(/^\/+/, ''), `${window.location.origin}${basePath}`).toString();
}

function friendlyEmailAuthError(error: unknown, action: 'sign-in' | 'sign-up' | 'reset' | 'update') {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (/invalid login credentials|invalid credentials/.test(message)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (/email not confirmed/.test(message)) return 'أكد بريدك الإلكتروني من الرسالة التي أرسلناها، ثم سجّل الدخول.';
  if (/already registered|user already exists|email.*already.*(use|exist)/.test(message)) return 'هذا البريد مسجل من قبل. جرّب تسجيل الدخول.';
  if (/anonymous.*(disabled|not enabled)|anonymous_provider_disabled/.test(message)) return 'التجربة تحتاج تفعيل Anonymous Sign-Ins من إعدادات Supabase Auth.';
  if (/manual.*link|identity.*link.*(disabled|not enabled)|linking.*disabled/.test(message)) return 'يلزم تفعيل ربط الهويات في إعدادات Supabase Auth حتى نربط بريدك بحساب التجربة من دون نقل بياناتك.';
  if (/email_address_not_authorized|over_email_send_rate_limit|email rate limit/.test(message)) return 'تعذر إرسال رسالة التحقق: خدمة البريد الافتراضية في Supabase محدودة. اربط SMTP مخصصًا مثل Resend ثم أعد المحاولة.';
  if (/otp_expired|expired.*(token|otp|link)|token.*expired/.test(message)) return 'انتهت صلاحية رابط التأكيد. أرسل رابطًا جديدًا ثم افتحه مباشرة.';
  if (/invalid.*(token|otp|link)|token.*invalid/.test(message)) return 'رابط التأكيد غير صالح أو استُخدم من قبل. أرسل رابطًا جديدًا.';
  if (/password.*(at least|too short|shorter)/.test(message)) return 'كلمة المرور قصيرة. استخدم ٨ أحرف على الأقل.';
  if (/rate limit|too many requests/.test(message)) return 'وصلت محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.';
  if (action === 'reset') return 'تعذّر إرسال رسالة استعادة كلمة المرور. تحقق من البريد وحاول مرة أخرى.';
  if (action === 'update') return 'تعذّر تحديث كلمة المرور. افتح رابط الاستعادة من جديد وحاول مرة أخرى.';
  if (action === 'sign-up') return 'تعذّر إنشاء الحساب. تحقق من البيانات وحاول مرة أخرى.';
  return 'تعذّر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousUserId = useRef<string | null>(null);
  const guestCreation = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const supabase = getSupabaseClient();
      const auth = supabase.auth.onAuthStateChange((_event, nextSession) => {
        const nextUserId = nextSession?.user.id ?? null;
        if (previousUserId.current && previousUserId.current !== nextUserId) {
          queryClient.clear();
        }
        previousUserId.current = nextUserId;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
        setError(null);
      });
      subscription = auth.data.subscription;
      void supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (sessionError) throw sessionError;
        if (previousUserId.current === null) {
          previousUserId.current = data.session?.user.id ?? null;
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
        setError('تعذر التحقق من جلسة الدخول. أعد تحميل الصفحة وحاول مرة أخرى.');
      });
    } catch (cause) {
      setLoading(false);
      setError(cause instanceof Error ? cause.message : 'تعذر الاتصال بـ Supabase.');
    }

    return () => subscription?.unsubscribe();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    error,
    async ensureGuestSession() {
      if (user) return;
      if (guestCreation.current) return guestCreation.current;

      const attempt = (async () => {
        const supabase = getSupabaseClient();
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (sessionData.session?.user) {
          setSession(sessionData.session);
          setUser(sessionData.session.user);
          return;
        }

        const { data, error: guestError } = await supabase.auth.signInAnonymously();
        if (guestError) {
          const friendly = /captcha/i.test(guestError.message)
            ? 'تعذر بدء التجربة بسبب إعداد الحماية في Supabase. فعّل Anonymous Sign-Ins وتحقق من إعداد CAPTCHA.'
            : friendlyEmailAuthError(guestError, 'sign-in');
          throw new Error(friendly);
        }
        if (!data.session || !data.user) throw new Error('لم يتم إنشاء جلسة التجربة. أعد المحاولة.');
        setSession(data.session);
        setUser(data.user);
      })();

      guestCreation.current = attempt;
      try {
        await attempt;
      } finally {
        if (guestCreation.current === attempt) guestCreation.current = null;
      }
    },
    async signInWithPassword(email, password) {
      const { data, error: signInError } = await getSupabaseClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw new Error(friendlyEmailAuthError(signInError, 'sign-in'));
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
    },
    async signUpWithEmail(businessName, email, password) {
      const cleanedName = businessName.trim();
      if (cleanedName.length < 2 || cleanedName.length > 120) {
        throw new Error('اكتب اسم منشأة من حرفين إلى ١٢٠ حرفًا.');
      }
      const supabase = getSupabaseClient();
      const { data: currentData, error: currentError } = await supabase.auth.getUser();
      if (currentError) throw new Error(friendlyEmailAuthError(currentError, 'sign-up'));

      if (currentData.user?.is_anonymous) {
        const { data, error: linkError } = await supabase.auth.updateUser(
          { email: email.trim(), data: { business_name: cleanedName } },
          { emailRedirectTo: appUrl('/register?guest-upgrade=verified') },
        );
        if (linkError) throw new Error(friendlyEmailAuthError(linkError, 'sign-up'));

        if (data.user) setUser(data.user);
        const upgradedImmediately = Boolean(
          data.user && !data.user.is_anonymous && data.user.email_confirmed_at,
        );
        if (!upgradedImmediately) localStorage.setItem(PENDING_GUEST_UPGRADE_KEY, currentData.user.id);
        return { needsEmailConfirmation: !upgradedImmediately, guestUpgrade: true };
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { business_name: cleanedName },
          emailRedirectTo: appUrl('/app'),
        },
      });
      if (signUpError) throw new Error(friendlyEmailAuthError(signUpError, 'sign-up'));
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      return { needsEmailConfirmation: !data.session, guestUpgrade: false };
    },
    async finishGuestUpgrade(password, businessName) {
      if (password.length < 8) throw new Error('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.');
      const supabase = getSupabaseClient();
      const { data: currentData, error: currentError } = await supabase.auth.getUser();
      if (currentError || !currentData.user) throw new Error('انتهت جلسة التجربة. سجّل الدخول من جديد.');
      if (currentData.user.is_anonymous || !currentData.user.email_confirmed_at) {
        throw new Error('أكد بريدك من رابط الرسالة أولًا، ثم عد إلى الصفحة لإضافة كلمة المرور.');
      }

      const { data, error: passwordError } = await supabase.auth.updateUser({
        password,
        data: { business_name: businessName.trim() },
      });
      if (passwordError) throw new Error(friendlyEmailAuthError(passwordError, 'update'));
      if (data.user) {
        setUser(data.user);
        const { error: profileError } = await supabase.from('business_profiles')
          .update({ business_name: businessName.trim() })
          .eq('user_id', data.user.id);
        if (profileError) throw new Error('تم ربط البريد، لكن تعذر حفظ اسم النشاط. أعد المحاولة من الإعدادات.');
      }
      localStorage.removeItem(PENDING_GUEST_UPGRADE_KEY);
    },
    async resendEmailConfirmation(email, guestUpgrade) {
      const supabase = getSupabaseClient();
      const { error: resendError } = await supabase.auth.resend({
        type: guestUpgrade ? 'email_change' : 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: appUrl(guestUpgrade ? '/register?guest-upgrade=verified' : '/app'),
        },
      });
      if (resendError) throw new Error(friendlyEmailAuthError(resendError, 'sign-up'));
    },
    async requestPasswordReset(email) {
      const { error: resetError } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: appUrl('/reset-password'),
      });
      if (resetError) throw new Error(friendlyEmailAuthError(resetError, 'reset'));
    },
    async updatePassword(password) {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(friendlyEmailAuthError(updateError, 'update'));
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) {
        throw new Error('تم تحديث كلمة المرور، لكن تعذّر إنهاء جلسة الاستعادة. سجّل الخروج ثم ادخل بكلمة المرور الجديدة.');
      }
    },
    async signInWithGoogle() {
      const supabase = getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: appUrl('/app') },
      });
      if (signInError) throw signInError;
    },
    async signOut() {
      const supabase = getSupabaseClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    },
  }), [user, session, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
