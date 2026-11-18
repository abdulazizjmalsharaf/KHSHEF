import { getLanguage } from '@/lib/i18n';

/** KWD has 1000 fils per dinar. */
export function formatFils(fils: number): string {
  return new Intl.NumberFormat(getLanguage() === 'ar' ? 'ar-KW' : 'en-KW', { style: 'currency', currency: 'KWD', minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(fils / 1000);
}
