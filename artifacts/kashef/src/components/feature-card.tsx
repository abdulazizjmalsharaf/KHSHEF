import { ArrowLeft, Heart } from 'lucide-react';
import type { Feature } from '@/data/features';
import { t, useLanguage } from '@/lib/i18n';

export function FeatureCard({ feature, favorite, onToggleFavorite, index }: { feature: Feature; favorite: boolean; onToggleFavorite: () => void; index: number }) {
  const { language } = useLanguage();
  const Icon = feature.icon;
  const live = feature.status === 'available';
  const title = t(feature.title);
  return (
    <li
      className={`rise group relative flex flex-col rounded-2xl border bg-card p-5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-28px_hsl(186_62%_20%/0.6)] ${live ? 'border-primary/40' : 'border-card-border border-dashed'}`}
      style={{ animationDelay: `${index * 60}ms` }}
      data-testid={`card-feature-${feature.id}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${live ? 'bg-primary text-accent' : 'bg-secondary text-primary'}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={favorite
            ? (language === 'ar' ? `إزالة «${feature.title}» من المفضلة` : `Remove “${title}” from favorites`)
            : (language === 'ar' ? `إضافة «${feature.title}» إلى المفضلة` : `Add “${title}” to favorites`)}
          className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-destructive"
          data-testid={`button-favorite-${feature.id}`}
        >
          <Heart key={String(favorite)} className={`h-5 w-5 ${favorite ? 'heart-beat fill-current' : ''}`} aria-hidden />
        </button>
      </div>
      <h3 className="font-display text-xl text-primary">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{t(feature.body)}</p>
      {feature.href && (
        <a href={feature.href} className="mt-3 inline-flex items-center gap-1.5 self-start rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`link-feature-${feature.id}`}>
          {t(feature.linkLabel ?? 'انتقل إلى الميزة')} <ArrowLeft className="h-4 w-4" aria-hidden />
        </a>
      )}
      <p className="mt-4">
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary" data-testid={`status-feature-${feature.id}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--chart-4))]" aria-hidden /> {t('متاح الآن')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-muted-foreground/40 px-3 py-1 text-xs font-semibold text-muted-foreground" data-testid={`status-feature-${feature.id}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> {t('مخطط له')}
          </span>
        )}
      </p>
    </li>
  );
}
