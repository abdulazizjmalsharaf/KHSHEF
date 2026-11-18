import { Moon, Sun } from 'lucide-react';
import type { Theme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={dark}
      aria-label={dark ? t('الوضع الداكن مفعّل، التبديل إلى الفاتح') : t('التبديل إلى الوضع الداكن')}
      title={dark ? t('الوضع الفاتح') : t('الوضع الداكن')}
      className="group relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-input bg-card text-primary transition-colors hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      data-testid="button-theme-toggle"
    >
      <Sun className={`absolute h-5 w-5 transition-all duration-300 ${dark ? 'translate-y-6 rotate-90 opacity-0' : 'opacity-100'}`} aria-hidden />
      <Moon className={`absolute h-5 w-5 transition-all duration-300 ${dark ? 'opacity-100' : '-translate-y-6 -rotate-90 opacity-0'}`} aria-hidden />
    </button>
  );
}
