export type UserRole = 'admin' | 'billing_staff' | 'inventory_manager';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category_id: number;
  brand: string;
  model: string;
  hsn_code: string;
  unit_price: number | string;
  gst_rate: number | string;
  price_includes_gst: boolean;
  current_stock: number;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
  is_low_stock?: boolean;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type MovementType = 'IN' | 'OUT';

export interface StockMovement {
  id: number;
  product_id: number;
  product_name?: string;
  sku?: string;
  type: MovementType;
  quantity: number;
  reference?: string | null;
  date: string;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface InventoryReportItem {
  product_id: number;
  name: string;
  sku: string;
  category_name: string;
  brand: string;
  unit_price: number | string;
  current_stock: number;
  reorder_level: number;
  is_low_stock: boolean;
  stock_value: number | string;
  recent_movements_count: number;
}

export interface InventoryReport {
  total_products: number;
  total_stock_units: number;
  total_stock_value: number | string;
  low_stock_count: number;
  items: InventoryReportItem[];
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  state: string;
  gstin?: string | null;
  created_at: string;
  updated_at: string;
  total_invoices?: number;
  total_spent?: number;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type InvoiceStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'CANCELLED';
export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit';
export type DiscountType = 'percentage' | 'amount';

export interface TaxSummaryItem {
  gst_rate: number | string;
  taxable_value: number | string;
  cgst_amount: number | string;
  sgst_amount: number | string;
  igst_amount: number | string;
  total_tax: number | string;
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  product_id: number;
  product_name: string;
  sku: string;
  hsn_code: string;
  quantity: number;
  unit_price: number | string;
  price_includes_gst?: boolean;
  discount_type: DiscountType;
  discount_value: number | string;
  discount_amount: number | string;
  taxable_value: number | string;
  gst_rate: number | string;
  cgst_rate: number | string;
  cgst_amount: number | string;
  sgst_rate: number | string;
  sgst_amount: number | string;
  igst_rate: number | string;
  igst_amount: number | string;
  line_total: number | string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  invoice_date: string;
  status: InvoiceStatus;
  payment_mode: PaymentMode;
  company_state: string;
  customer_state: string;
  is_interstate: boolean;
  subtotal: number | string;
  total_discount: number | string;
  total_taxable: number | string;
  total_cgst: number | string;
  total_sgst: number | string;
  total_igst: number | string;
  round_off: number | string;
  grand_total: number | string;
  grand_total_words: string;
  amount_paid: number | string;
  balance_due: number | string;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  items: InvoiceItem[];
  tax_summary?: TaxSummaryItem[];
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface InvoicePreviewResult {
  subtotal: number | string;
  total_discount: number | string;
  total_taxable: number | string;
  is_interstate: boolean;
  total_cgst: number | string;
  total_sgst: number | string;
  total_igst: number | string;
  round_off: number | string;
  grand_total: number | string;
  grand_total_words: string;
  items: any[];
  tax_summary?: TaxSummaryItem[];
}

export interface Payment {
  id: number;
  invoice_id: number;
  payment_date: string;
  amount: number | string;
  payment_mode: string;
  reference_number?: string | null;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
}

export interface SalesChartDataPoint {
  date: string;
  sales: number;
  invoices: number;
}

export interface TopProductItem {
  product_id: number;
  name: string;
  sku: string;
  brand: string;
  category_name: string;
  units_sold: number;
  total_revenue: number | string;
}

export interface DashboardMetrics {
  today_sales: number | string;
  this_month_sales: number | string;
  total_invoices_count: number;
  today_invoices_count: number;
  pending_payments_amount: number | string;
  low_stock_items_count: number;
  sales_trend_30_days: SalesChartDataPoint[];
  top_selling_products: TopProductItem[];
}

export interface CompanySetting {
  id: number;
  company_name: string;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  terms_and_conditions?: string | null;
  created_at: string;
  updated_at: string;
}
