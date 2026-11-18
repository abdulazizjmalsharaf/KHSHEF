import { useId, useMemo, useState } from 'react';
import { Search, SearchX, X } from 'lucide-react';
import { FEATURES } from '@/data/features';
import { FeatureCard } from '@/components/feature-card';
import { t } from '@/lib/i18n';

const norm = (s: string) => s.toLowerCase().replace(/[\u064B-\u0652]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();

export function FeaturesSection({ isFavorite, onToggleFavorite, favoriteCount }: { isFavorite: (id: string) => boolean; onToggleFavorite: (id: string) => void; favoriteCount: number }) {
  const [q, setQ] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const inputId = useId();
  const results = useMemo(() => {
    const n = norm(q);
    return FEATURES.filter((f) => (!onlyFav || isFavorite(f.id)) && (!n || norm(`${f.title} ${f.body} ${f.keywords}`).includes(n)));
  }, [q, onlyFav, isFavorite]);

  return (
    <section id="features" aria-labelledby="features-title" className="mx-auto max-w-6xl px-5 py-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="features-title" className="font-display text-4xl text-primary">{t('ما يعمل اليوم،')}<br />{t('وما نبنيه بعده.')}</h2>
          <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">{t('نكتب الحالة بوضوح: بعض المميزات متاح الآن، والباقي مخطط له ولم يُفعّل بعد.')}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <div className="relative sm:w-80">
            <label htmlFor={inputId} className="sr-only">{t('ابحث في المميزات')}</label>
            <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id={inputId}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('ابحث: فاتورة، استلام، مورد…')}
              className="h-12 w-full rounded-xl border border-input bg-card pe-10 ps-10 text-base transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              data-testid="input-feature-search"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label={t('مسح البحث')} className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-clear-search">
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-pressed={onlyFav}
            onClick={() => setOnlyFav((v) => !v)}
            className="h-12 shrink-0 rounded-xl border border-input px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-destructive/50 aria-pressed:bg-destructive/10 aria-pressed:text-destructive"
            data-testid="button-filter-favorites"
          >
            {t('المفضلة فقط')} <span className="tabular-nums">({favoriteCount})</span>
          </button>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{results.length.toLocaleString()} {t('من النتائج')}</p>
      {results.length ? (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
          {results.map((f, i) => (
            <FeatureCard key={f.id} feature={f} index={i} favorite={isFavorite(f.id)} onToggleFavorite={() => onToggleFavorite(f.id)} />
          ))}
        </ul>
      ) : (
        <div className="ledger-lines mt-10 flex flex-col items-center rounded-3xl border border-dashed border-card-border bg-card px-6 py-14 text-center" data-testid="empty-features">
          <SearchX className="h-10 w-10 text-accent" aria-hidden />
          <p className="mt-4 font-display text-2xl text-primary">{t('لا شيء يطابق بحثك')}</p>
          <p className="mt-2 max-w-sm text-muted-foreground">{t(onlyFav && !q ? 'لم تضف أي ميزة إلى المفضلة بعد. اضغط القلب على أي بطاقة.' : 'جرّب كلمة أخرى مثل «فاتورة» أو «مورد».')}</p>
          <button type="button" onClick={() => { setQ(''); setOnlyFav(false); }} className="mt-6 h-11 rounded-xl border border-input bg-background px-5 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-reset-features">
            {t('عرض كل المميزات')}
          </button>
        </div>
      )}
    </section>
  );
}
