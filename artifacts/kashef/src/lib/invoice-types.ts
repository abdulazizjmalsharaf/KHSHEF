export type InvoiceStatus =
  | 'under_review'
  | 'matched'
  | 'discrepancy'
  | 'approved'
  | 'disputed';

export type ExtractedItem = {
  name: string | null;
  nameConfidence: number;
  quantity: string | null;
  quantityConfidence: number;
  unit: string | null;
  unitConfidence: number;
  unitPrice: string | null;
  unitPriceConfidence: number;
  lineTotal: string | null;
  lineTotalConfidence: number;
  itemKey?: string;
};

export type ExtractedFee = {
  name: string | null;
  nameConfidence: number;
  amount: string | null;
  amountConfidence: number;
  feeKey?: string;
};

export type ReceiptItem = {
  name: string | null;
  nameConfidence: number;
  quantity: string | null;
  quantityConfidence: number;
  unit: string | null;
  unitConfidence: number;
  itemKey?: string;
};

export type InvoiceExtraction = {
  supplierName: string | null;
  supplierNameConfidence: number;
  supplierKey?: string;
  supplierId?: string | null;
  selectedSupplierName?: string | null;
  invoiceNumber: string | null;
  invoiceNumberConfidence: number;
  invoiceNumberKey?: string | null;
  invoiceDate: string | null;
  invoiceDateConfidence: number;
  currency: string | null;
  currencyConfidence: number;
  items: ExtractedItem[];
  additionalFees: ExtractedFee[];
  total: string | null;
  totalConfidence: number;
  receiptItems: ReceiptItem[];
};

export type InvoiceCheck = {
  code: string;
  severity: 'difference' | 'warning';
  title: string;
  detail: string;
  amountAffected: string | null;
  currency: string;
  itemKey?: string;
  itemName?: string | null;
  unit?: string | null;
  suggestedUnitPrice?: string | null;
};

export type InvoiceRow = {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_key: string;
  invoice_number: string | null;
  invoice_number_key: string | null;
  invoice_date: string | null;
  currency: string;
  total_amount: string | number | null;
  status: InvoiceStatus;
  invoice_path: string;
  receipt_path: string | null;
  extracted_data: InvoiceExtraction;
  checks: InvoiceCheck[];
  created_at: string;
  updated_at: string;
};

export type InvoiceItemRow = {
  id: string;
  name: string;
  quantity: string | number | null;
  unit: string | null;
  unit_price: string | number | null;
  line_total: string | number | null;
  confidence: Record<string, number>;
};

export type InvoiceListRow = Pick<
  InvoiceRow,
  'id' | 'supplier_name' | 'invoice_number' | 'invoice_date' | 'currency' | 'total_amount' | 'status' | 'created_at' | 'checks'
>;

export type SupplierPriceRow = {
  id: string;
  supplier_id?: string | null;
  supplier_name: string;
  supplier_key: string;
  item_name: string;
  item_key: string;
  unit: string | null;
  unit_price: string | number;
  currency: string;
  updated_at: string;
};

export type SupplierRow = {
  id: string;
  user_id: string;
  name: string;
  supplier_key: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
};
