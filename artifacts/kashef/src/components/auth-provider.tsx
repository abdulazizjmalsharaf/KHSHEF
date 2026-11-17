import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabase-client';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (businessName: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
  if (/already registered|user already exists/.test(message)) return 'هذا البريد مسجل من قبل. جرّب تسجيل الدخول.';
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
      const { data, error: signUpError } = await getSupabaseClient().auth.signUp({
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
      return { needsEmailConfirmation: !data.session };
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
