import assert from 'node:assert/strict';
import { getDashboardMetrics, getOnboardingSteps } from './dashboard-metrics';
import type { InvoiceListRow } from './invoice-types';

const invoice = (
  overrides: Partial<InvoiceListRow> = {},
): InvoiceListRow => ({
  id: 'invoice-1',
  supplier_name: 'مورد',
  invoice_number: '1',
  invoice_date: '2026-11-18',
  currency: 'KWD',
  total_amount: '10',
  status: 'matched',
  created_at: '2026-11-18T10:00:00Z',
  checks: [],
  ...overrides,
});

const metrics = getDashboardMetrics([
  invoice({
    id: 'review',
    status: 'under_review',
    checks: [
      {
        code: 'line_math',
        severity: 'difference',
        title: 'فرق السطر',
        detail: '',
        amountAffected: '2.000',
        currency: 'KWD',
      },
      {
        code: 'invoice_math',
        severity: 'difference',
        title: 'فرق الإجمالي',
        detail: '',
        amountAffected: '3.000',
        currency: 'KWD',
      },
      {
        code: 'fee_notice',
        severity: 'warning',
        title: 'رسوم',
        detail: '',
        amountAffected: '99.000',
        currency: 'KWD',
      },
    ],
  }),
  invoice({
    id: 'difference',
    status: 'discrepancy',
    currency: 'USD',
    checks: [
      {
        code: 'duplicate',
        severity: 'difference',
        title: 'مكررة',
        detail: '',
        amountAffected: '8.00',
        currency: 'USD',
      },
      {
        code: 'invalid',
        severity: 'difference',
        title: 'غير معروف',
        detail: '',
        amountAffected: 'not-a-number',
        currency: 'USD',
      },
    ],
  }),
  invoice({ id: 'approved', status: 'approved' }),
]);

assert.equal(metrics.needsReviewCount, 2);
assert.equal(metrics.invoicesWithDifferencesCount, 2);
assert.equal(metrics.differenceChecksCount, 4);
assert.deepEqual(metrics.largestDifferenceByCurrency, [
  { currency: 'KWD', amount: 3 },
  { currency: 'USD', amount: 8 },
]);

const steps = getOnboardingSteps({
  suppliers: 0,
  supplierPrices: 0,
  invoices: 0,
});
assert.deepEqual(
  steps.map((step) => step.complete),
  [false, false, false],
);
assert.deepEqual(
  getOnboardingSteps({
    suppliers: 2,
    supplierPrices: 4,
    invoices: 1,
  }).map((step) => step.complete),
  [true, true, true],
);

console.log('Dashboard metrics checks passed.');
