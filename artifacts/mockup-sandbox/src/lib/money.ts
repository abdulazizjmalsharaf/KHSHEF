const formatter = new Intl.NumberFormat('ar-KW', { style: 'currency', currency: 'KWD', minimumFractionDigits: 0, maximumFractionDigits: 3 });

/** KWD has 1000 fils per dinar. */
export function formatFils(fils: number): string {
  return formatter.format(fils / 1000);
}
