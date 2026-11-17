import type { InvoiceListRow } from './invoice-types';

export type DashboardMetrics = {
  needsReviewCount: number;
  invoicesWithDifferencesCount: number;
  differenceChecksCount: number;
  largestDifferenceByCurrency: { currency: string; amount: number }[];
};

export function getDashboardMetrics(
  invoices: readonly InvoiceListRow[],
): DashboardMetrics {
  const largestByCurrency = new Map<string, number>();
  let invoicesWithDifferencesCount = 0;
  let differenceChecksCount = 0;

  for (const invoice of invoices) {
    const differences = (invoice.checks ?? []).filter(
      (check) => check.severity === 'difference',
    );
    if (differences.length > 0) invoicesWithDifferencesCount += 1;

    for (const check of differences) {
      differenceChecksCount += 1;
      if (check.amountAffected === null) continue;

      const amount = Math.abs(Number(check.amountAffected));
      if (!Number.isFinite(amount)) continue;
      const currency = check.currency || invoice.currency;
      const currentLargest = largestByCurrency.get(currency);
      if (currentLargest === undefined || amount > currentLargest) {
        largestByCurrency.set(currency, amount);
      }
    }
  }

  return {
    needsReviewCount: invoices.filter(
      (invoice) =>
        invoice.status === 'under_review' || invoice.status === 'discrepancy',
    ).length,
    invoicesWithDifferencesCount,
    differenceChecksCount,
    // Show one observed check per currency. Never add overlapping checks or
    // combine values across currencies, and do not describe them as savings.
    largestDifferenceByCurrency: [...largestByCurrency.entries()]
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}

export type OnboardingCounts = {
  suppliers: number;
  supplierPrices: number;
  invoices: number;
};

export function getOnboardingSteps(counts: OnboardingCounts) {
  return [
    {
      key: 'supplier',
      label: 'أضف أول مورد',
      href: '/suppliers',
      complete: counts.suppliers > 0,
    },
    {
      key: 'prices',
      label: 'أضف أسعار المورد',
      href: '/supplier-prices',
      complete: counts.supplierPrices > 0,
    },
    {
      key: 'invoice',
      label: 'ارفع أول فاتورة',
      href: '/invoices/new',
      complete: counts.invoices > 0,
    },
  ] as const;
}
