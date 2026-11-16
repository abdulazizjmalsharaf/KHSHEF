import { useCallback, useEffect, useState } from 'react';
import { readStorage, writeStorage } from '@/lib/safe-storage';

export type Theme = 'light' | 'dark';
const KEY = 'kashef:theme';

const systemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

function readSaved(): { theme: Theme | null; ok: boolean } {
  const r = readStorage(KEY);
  if (!r.ok) return { theme: null, ok: false };
  return { theme: r.value === 'dark' || r.value === 'light' ? r.value : null, ok: true };
}

export function useTheme() {
  const [explicit, setExplicit] = useState<Theme | null>(() => readSaved().theme);
  const [system, setSystem] = useState<Theme>(systemTheme);
  const [storageFailed, setStorageFailed] = useState(() => !readSaved().ok);
  const theme = explicit ?? system;

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setExplicit(next);
    if (!writeStorage(KEY, next)) setStorageFailed(true);
  }, [theme]);

  return { theme, toggle, storageFailed };
}
