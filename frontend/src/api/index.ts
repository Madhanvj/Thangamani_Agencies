import { apiClient } from './client';
import type {
  User,
  Category,
  Product,
  ProductListResponse,
  StockMovement,
  InventoryReport,
  Customer,
  CustomerListResponse,
  Invoice,
  InvoiceListResponse,
  InvoicePreviewResult,
  Payment,
  DashboardMetrics,
  CompanySetting,
  MovementType,
  PaymentMode,
  DiscountType,
  InvoiceStatus,
} from '../types';

// Auth
export const authApi = {
  login: async (username: string, password: string): Promise<{ access_token: string; user: User }> => {
    const res = await apiClient.post('/auth/login', { username, password });
    return res.data;
  },
  getCurrentUser: async (): Promise<User> => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
};

// Categories & Products
export const productsApi = {
  getCategories: async (): Promise<Category[]> => {
    const res = await apiClient.get('/categories');
    return res.data;
  },
  createCategory: async (data: { name: string; description?: string }): Promise<Category> => {
    const res = await apiClient.post('/categories', data);
    return res.data;
  },
  getProducts: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category_id?: number;
    is_low_stock?: boolean;
    is_active?: boolean;
  }): Promise<ProductListResponse> => {
    const res = await apiClient.get('/products', { params });
    return res.data;
  },
  getProduct: async (id: number): Promise<Product> => {
    const res = await apiClient.get(`/products/${id}`);
    return res.data;
  },
  createProduct: async (data: Partial<Product>): Promise<Product> => {
    const res = await apiClient.post('/products', data);
    return res.data;
  },
  updateProduct: async (id: number, data: Partial<Product>): Promise<Product> => {
    const res = await apiClient.put(`/products/${id}`, data);
    return res.data;
  },
  deleteProduct: async (id: number): Promise<{ message: string }> => {
    const res = await apiClient.delete(`/products/${id}`);
    return res.data;
  },
};

// Inventory
export const inventoryApi = {
  adjustStock: async (data: {
    product_id: number;
    type: MovementType;
    quantity: number;
    reference?: string;
  }): Promise<StockMovement> => {
    const res = await apiClient.post('/inventory/adjust', data);
    return res.data;
  },
  getLowStock: async (page = 1, limit = 50): Promise<Product[]> => {
    const res = await apiClient.get('/inventory/low-stock', { params: { page, limit } });
    return res.data;
  },
  getReport: async (): Promise<InventoryReport> => {
    const res = await apiClient.get('/inventory/report');
    return res.data;
  },
  getMovements: async (productId: number): Promise<StockMovement[]> => {
    const res = await apiClient.get(`/inventory/movements/${productId}`);
    return res.data;
  },
};

// Customers
export const customersApi = {
  getCustomers: async (params?: { page?: number; limit?: number; search?: string }): Promise<CustomerListResponse> => {
    const res = await apiClient.get('/customers', { params });
    return res.data;
  },
  getCustomerByPhone: async (phone: string): Promise<Customer | null> => {
    const res = await apiClient.get(`/customers/by-phone/${encodeURIComponent(phone)}`);
    return res.data;
  },
  getCustomer: async (id: number): Promise<Customer> => {
    const res = await apiClient.get(`/customers/${id}`);
    return res.data;
  },
  getCustomerInvoices: async (id: number): Promise<Invoice[]> => {
    const res = await apiClient.get(`/customers/${id}/invoices`);
    return res.data;
  },
  createCustomer: async (data: Partial<Customer>): Promise<Customer> => {
    const res = await apiClient.post('/customers', data);
    return res.data;
  },
  updateCustomer: async (id: number, data: Partial<Customer>): Promise<Customer> => {
    const res = await apiClient.put(`/customers/${id}`, data);
    return res.data;
  },
};

// Invoices
export interface CreateInvoicePayload {
  customer: {
    id?: number;
    name: string;
    phone: string;
    email?: string | null;
    address?: string | null;
    state: string;
    gstin?: string | null;
  };
  items: {
    product_id: number;
    quantity: number;
    unit_price?: number;
    discount_type: DiscountType;
    discount_value: number;
  }[];
  payment_mode: PaymentMode;
  amount_paid: number;
  notes?: string | null;
}

export const invoicesApi = {
  previewInvoice: async (payload: {
    customer_state: string;
    items: {
      product_id: number;
      quantity: number;
      unit_price?: number;
      discount_type: DiscountType;
      discount_value: number;
    }[];
  }): Promise<InvoicePreviewResult> => {
    const res = await apiClient.post('/invoices/preview', payload);
    return res.data;
  },
  createInvoice: async (payload: CreateInvoicePayload): Promise<Invoice> => {
    const res = await apiClient.post('/invoices', payload);
    return res.data;
  },
  getInvoices: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status_filter?: InvoiceStatus;
    start_date?: string;
    end_date?: string;
  }): Promise<InvoiceListResponse> => {
    const res = await apiClient.get('/invoices', { params });
    return res.data;
  },
  getInvoice: async (id: number): Promise<Invoice> => {
    const res = await apiClient.get(`/invoices/${id}`);
    return res.data;
  },
  cancelInvoice: async (id: number): Promise<Invoice> => {
    const res = await apiClient.post(`/invoices/${id}/cancel`);
    return res.data;
  },
  downloadPdf: async (id: number, invoiceNumber: string) => {
    const res = await apiClient.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Invoice_${invoiceNumber}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
  },
};

// Payments
export const paymentsApi = {
  recordPayment: async (data: {
    invoice_id: number;
    amount: number;
    payment_mode: string;
    reference_number?: string;
    notes?: string;
  }): Promise<Payment> => {
    const res = await apiClient.post('/payments', data);
    return res.data;
  },
  getInvoicePayments: async (invoiceId: number): Promise<Payment[]> => {
    const res = await apiClient.get(`/payments/invoice/${invoiceId}`);
    return res.data;
  },
};

// Dashboard
export const dashboardApi = {
  getMetrics: async (): Promise<DashboardMetrics> => {
    const res = await apiClient.get('/dashboard/metrics');
    return res.data;
  },
};

// Settings
export const settingsApi = {
  getCompanySettings: async (): Promise<CompanySetting> => {
    const res = await apiClient.get('/settings/company');
    return res.data;
  },
  updateCompanySettings: async (data: Partial<CompanySetting>): Promise<CompanySetting> => {
    const res = await apiClient.put('/settings/company', data);
    return res.data;
  },
};
