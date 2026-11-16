import type { ExtractedInvoice } from "../lib/invoice-extraction";

/** Synthetic data only; never copy a real user's invoice into tests. */
export function fixture(): ExtractedInvoice {
  return {
    isInvoice: true, currency: "KWD",
    items: [
      { description: "طماطم", quantity: "2", unitPrice: "1.250", lineTotal: "2.500", discountAmount: null, taxAmount: null },
      { description: "حليب", quantity: "3", unitPrice: "0.750", lineTotal: "2.250", discountAmount: null, taxAmount: null },
    ],
    subtotal: "4.750", discountAmount: "0", discountRate: null,
    taxAmount: "0", taxRate: null, additionalCharges: null, total: "4.750",
    taxIncluded: false, unsupportedAdjustments: false, notes: [],
  };
}
