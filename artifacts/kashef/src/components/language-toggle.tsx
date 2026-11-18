import { Languages } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();
  const next = language === 'ar' ? 'en' : 'ar';
  const label = language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية';

  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-input bg-card px-3 text-sm font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${compact ? 'min-w-10 px-2' : ''}`}
      data-testid="button-language-toggle"
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
    </button>
  );
}
