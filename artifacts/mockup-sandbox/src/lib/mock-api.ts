import { useState } from 'react';

export type ArithmeticCheckStatus = 'match' | 'mismatch' | 'unverified';
export type InvoiceAnalysisStatus = ArithmeticCheckStatus;
export type InvoiceDecimal = string | null;

export interface InvoiceLine {
  description: string;
  quantity: InvoiceDecimal;
  unitPrice: InvoiceDecimal;
  lineTotal: InvoiceDecimal;
  discountAmount: InvoiceDecimal;
  taxAmount: InvoiceDecimal;
}

export interface InvoiceExtraction {
  isInvoice: boolean;
  currency: string | null;
  items: InvoiceLine[];
  subtotal: InvoiceDecimal;
  discountAmount: InvoiceDecimal;
  discountRate: InvoiceDecimal;
  taxAmount: InvoiceDecimal;
  taxRate: InvoiceDecimal;
  additionalCharges: InvoiceDecimal;
  total: InvoiceDecimal;
  taxIncluded: boolean | null;
  unsupportedAdjustments: boolean;
  sourceReviewRequired: boolean;
  notes: string[];
}

export interface ArithmeticCheck {
  label: string;
  stated: InvoiceDecimal;
  calculated: string | null;
  difference: string | null;
  status: ArithmeticCheckStatus;
}

export interface InvoiceAnalysis {
  invoice: InvoiceExtraction;
  itemChecks: ArithmeticCheck[];
  checks: ArithmeticCheck[];
  warnings: string[];
  status: InvoiceAnalysisStatus;
  roundingNote: string;
}

export function useAnalyzeInvoice(_options?: unknown) {
  const [data] = useState<InvoiceAnalysis | undefined>(undefined);
  return {
    data,
    error: null as Error | null,
    isPending: false,
    mutate: (_input: { data: { text: string; consent: true } }) => {},
    reset: () => {},
  };
}
