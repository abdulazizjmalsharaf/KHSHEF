import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabase-client';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
    async signInWithGoogle() {
      const supabase = getSupabaseClient();
      const basePath = import.meta.env.BASE_URL.endsWith('/')
        ? import.meta.env.BASE_URL
        : `${import.meta.env.BASE_URL}/`;
      const redirectTo = `${window.location.origin}${basePath}invoices/new`;
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
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
