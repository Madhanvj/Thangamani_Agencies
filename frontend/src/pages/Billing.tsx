import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi, customersApi, invoicesApi, settingsApi } from '../api';
import type { Product, PaymentMode, DiscountType, Customer } from '../types';
import { formatCurrency, isValidPhone, isValidGSTIN } from '../utils/formatters';
import {
  Search,
  Trash2,
  AlertCircle,
  Receipt,
  UserCheck,
  CreditCard,
  Building2,
  ArrowRight,
  Edit3,
} from 'lucide-react';

interface BillingLineItem {
  id: string; // temporary key
  product: Product;
  quantity: number;
  unit_price: number;
  raw_unit_price?: string;
  raw_total_price?: string;
  price_includes_gst: boolean;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  taxable_value: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
  update_product_price: boolean;
  stock_error?: string;
}

export const Billing: React.FC = () => {
  const navigate = useNavigate();

  // Company State
  const [companyState, setCompanyState] = useState<string>('Tamil Nadu');

  // Customer State
  const [customerId, setCustomerId] = useState<number | undefined>(undefined);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerState, setCustomerState] = useState('Tamil Nadu');
  const [customerGstin, setCustomerGstin] = useState('');
  const [existingCustomerFound, setExistingCustomerFound] = useState(false);

  const [customerType, setCustomerType] = useState<'RETAIL' | 'VENDOR'>('RETAIL');
  const [vendorOptions, setVendorOptions] = useState<Customer[]>([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [outstanding, setOutstanding] = useState<number | string>(0);

  // Line items
  const [items, setItems] = useState<BillingLineItem[]>([]);

  // Product Search Dropdown
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Payment Details
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customerType !== 'VENDOR') return;
    let active = true;
    const timer = setTimeout(() => {
      customersApi.getCustomers({ customer_type: 'VENDOR', search: vendorSearch, limit: 100 })
        .then(res => { if (active) setVendorOptions(res.items); })
        .catch(() => { if (active) setFormError('Unable to load vendors. Please try again.'); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [customerType, vendorSearch]);

  // Fetch company setting to know intra-state vs inter-state
  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        const s = await settingsApi.getCompanySettings();
        if (s.state) {
          setCompanyState(s.state);
        }
      } catch (err) {
        console.error('Failed to load company setting', err);
      }
    };
    fetchCompanySettings();
  }, []);

  // Phone auto-suggest: when phone length reaches 10 digits
  useEffect(() => {
    let active = true;
    setCustomerId(undefined); setOutstanding(0);
    const checkCustomerPhone = async () => {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      if (cleanPhone.length === 10) {
        try {
          const cust = await customersApi.getCustomerByPhone(cleanPhone);
          if (!active) return;
          if (cust) {
            setCustomerType(cust.customer_type || 'RETAIL');
            setOutstanding(cust.balance_due ?? 0);
            setCustomerId(cust.id);
            setCustomerName(cust.name);
            setCustomerEmail(cust.email || '');
            setCustomerAddress(cust.address || '');
            setCustomerState(cust.state || 'Tamil Nadu');
            setCustomerGstin(cust.gstin || '');
            setExistingCustomerFound(true);
          } else {
            setOutstanding(0);
            setCustomerId(undefined);
            setExistingCustomerFound(false);
          }
        } catch {
          setExistingCustomerFound(false);
        }
      } else {
        setExistingCustomerFound(false);
      }
    };

    const timer = setTimeout(checkCustomerPhone, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [customerPhone]);

  // Product live search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await productsApi.getProducts({
          search: searchQuery.trim(),
          is_active: true,
          limit: 8,
        });
        setSearchResults(res.items);
        setShowDropdown(true);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Failed to search products', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard navigation inside product search dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        addProductToInvoice(searchResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const isInterstate = customerState.trim().toLowerCase() !== companyState.trim().toLowerCase();

  // Helper to re-calculate a single line item
  const recalculateLine = (
    item: BillingLineItem,
    qty: number,
    price: number,
    discType: DiscountType,
    discVal: number,
    priceIncludesGst?: boolean,
    updateProductPrice?: boolean
  ): BillingLineItem => {
    const isInclusive = priceIncludesGst !== undefined ? priceIncludesGst : item.price_includes_gst;
    const shouldUpdateDb = updateProductPrice !== undefined ? updateProductPrice : (item.update_product_price ?? true);
    const rawSubtotal = Math.round(price * qty * 100) / 100;
    let discAmt = 0;
    if (discType === 'percentage') {
      discAmt = Math.round(rawSubtotal * (discVal / 100) * 100) / 100;
    } else {
      discAmt = Math.min(discVal, rawSubtotal);
    }

    const lineAfterDisc = Math.max(0, Math.round((rawSubtotal - discAmt) * 100) / 100);
    const gstRate = parseFloat(String(item.gst_rate));

    let taxable = 0;
    let gstTotal = 0;
    let lineTotal = 0;

    if (isInclusive) {
      taxable = Math.round((lineAfterDisc / (1 + gstRate / 100)) * 100) / 100;
      gstTotal = Math.round((lineAfterDisc - taxable) * 100) / 100;
      lineTotal = lineAfterDisc;
    } else {
      taxable = lineAfterDisc;
      gstTotal = Math.round(taxable * (gstRate / 100) * 100) / 100;
      lineTotal = Math.round((taxable + gstTotal) * 100) / 100;
    }

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterstate) {
      igst = gstTotal;
    } else {
      cgst = Math.round((gstTotal / 2) * 100) / 100;
      sgst = Math.round((gstTotal - cgst) * 100) / 100;
    }

    // Check stock warning
    let stockErr: string | undefined;
    if (qty > item.product.current_stock) {
      stockErr = `Only ${item.product.current_stock} units available in stock!`;
    }

    return {
      ...item,
      quantity: qty,
      unit_price: price,
      price_includes_gst: isInclusive,
      discount_type: discType,
      discount_value: discVal,
      discount_amount: discAmt,
      taxable_value: taxable,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      line_total: lineTotal,
      update_product_price: shouldUpdateDb,
      stock_error: stockErr,
    };
  };

  const addProductToInvoice = (product: Product) => {
    // Check if already in items
    const existingIndex = items.findIndex((it) => it.product.id === product.id);
    if (existingIndex >= 0) {
      // Increase qty by 1
      const it = items[existingIndex];
      const updated = recalculateLine(
        it,
        it.quantity + 1,
        it.unit_price,
        it.discount_type,
        it.discount_value
      );
      const newItems = [...items];
      newItems[existingIndex] = updated;
      setItems(newItems);
    } else {
      const isInclusive = product.price_includes_gst !== false;
      const newLine: BillingLineItem = {
        id: `${product.id}-${Date.now()}`,
        product,
        quantity: 1,
        unit_price: parseFloat(String(product.unit_price)),
        price_includes_gst: isInclusive,
        discount_type: 'percentage',
        discount_value: 0,
        discount_amount: 0,
        taxable_value: parseFloat(String(product.unit_price)),
        gst_rate: parseFloat(String(product.gst_rate)),
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        line_total: 0,
        update_product_price: true,
      };
      const calculated = recalculateLine(newLine, 1, newLine.unit_price, 'percentage', 0);
      setItems((prev) => [...prev, calculated]);
    }

    setSearchQuery('');
    setShowDropdown(false);
    searchInputRef.current?.focus();
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateItemQty = (id: string, qtyStr: string) => {
    const qty = parseInt(qtyStr) || 0;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = recalculateLine(it, qty, it.unit_price, it.discount_type, it.discount_value);
          return {
            ...updated,
            raw_total_price: undefined,
          };
        }
        return it;
      })
    );
  };

  const updateItemPrice = (id: string, priceStr: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const price = parseFloat(priceStr);
          const validPrice = isNaN(price) || price < 0 ? 0 : price;
          const updated = recalculateLine(it, it.quantity, validPrice, it.discount_type, it.discount_value);
          return {
            ...updated,
            raw_unit_price: priceStr,
            raw_total_price: undefined,
          };
        }
        return it;
      })
    );
  };

  const updateItemTotalPrice = (id: string, totalStr: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const totalVal = parseFloat(totalStr);
          const validTotal = isNaN(totalVal) || totalVal < 0 ? 0 : totalVal;
          const qty = it.quantity > 0 ? it.quantity : 1;
          let calculatedPrice = 0;
          if (it.price_includes_gst) {
            calculatedPrice = Math.round(((validTotal + it.discount_amount) / qty) * 100) / 100;
          } else {
            const divisor = 1 + it.gst_rate / 100;
            const taxable = validTotal / divisor;
            calculatedPrice = Math.round(((taxable + it.discount_amount) / qty) * 100) / 100;
          }
          const updated = recalculateLine(it, it.quantity, calculatedPrice, it.discount_type, it.discount_value);
          return {
            ...updated,
            raw_total_price: totalStr,
            raw_unit_price: undefined,
          };
        }
        return it;
      })
    );
  };

  const togglePriceIncludesGst = (id: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = recalculateLine(
            it,
            it.quantity,
            it.unit_price,
            it.discount_type,
            it.discount_value,
            !it.price_includes_gst
          );
          return {
            ...updated,
            raw_total_price: undefined,
          };
        }
        return it;
      })
    );
  };

  const toggleUpdateProductPrice = (id: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          return { ...it, update_product_price: !it.update_product_price };
        }
        return it;
      })
    );
  };

  const updateItemDiscount = (id: string, valStr: string, type: DiscountType) => {
    const val = parseFloat(valStr) || 0;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = recalculateLine(it, it.quantity, it.unit_price, type, val);
          return {
            ...updated,
            raw_total_price: undefined,
          };
        }
        return it;
      })
    );
  };

  // Recalculate all items when customer state changes (Intra-state vs Inter-state)
  useEffect(() => {
    setItems((prev) =>
      prev.map((it) =>
        recalculateLine(it, it.quantity, it.unit_price, it.discount_type, it.discount_value)
      )
    );
  }, [customerState, companyState]);

  // Totals aggregation
  const subtotal = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  const totalDiscount = items.reduce((sum, it) => sum + it.discount_amount, 0);
  const totalTaxable = items.reduce((sum, it) => sum + it.taxable_value, 0);
  const totalCgst = items.reduce((sum, it) => sum + it.cgst_amount, 0);
  const totalSgst = items.reduce((sum, it) => sum + it.sgst_amount, 0);
  const totalIgst = items.reduce((sum, it) => sum + it.igst_amount, 0);

  const exactGrandTotal = totalTaxable + totalCgst + totalSgst + totalIgst;
  const grandTotal = Math.round(exactGrandTotal);
  const roundOff = Math.round((grandTotal - exactGrandTotal) * 100) / 100;

  // Auto-fill full payment if paid in full is desired
  const handleFullPayment = () => {
    setAmountPaid(grandTotal);
  };

  const balanceDue = Math.max(0, Math.round((grandTotal - amountPaid) * 100) / 100);

  const hasStockErrors = items.some((it) => it.quantity <= 0 || it.quantity > it.product.current_stock);

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (items.length === 0) {
      setFormError('Please add at least one appliance product to the invoice.');
      return;
    }

    if (!customerName.trim()) {
      setFormError('Customer name is required.');
      return;
    }

    if (!isValidPhone(customerPhone)) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (customerGstin && !isValidGSTIN(customerGstin)) {
      setFormError('Invalid GSTIN format. Please enter a valid 15-character GSTIN or leave blank.');
      return;
    }

    if (hasStockErrors) {
      setFormError('Cannot create invoice: one or more items exceed current stock or have 0 quantity.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        customer: {
          customer_type: customerType,
          id: customerId,
          name: customerName.trim(),
          phone: customerPhone.trim(),
          email: customerEmail.trim() || null,
          address: customerAddress.trim() || null,
          state: customerState.trim(),
          gstin: customerGstin.trim().toUpperCase() || null,
        },
        items: items.map((it) => ({
          product_id: it.product.id,
          quantity: it.quantity,
          unit_price: it.unit_price,
          price_includes_gst: it.price_includes_gst,
          discount_type: it.discount_type,
          discount_value: it.discount_value,
          update_product_price: it.update_product_price,
        })),
        payment_mode: paymentMode,
        amount_paid: amountPaid,
        notes: notes.trim() || null,
      };

      const createdInvoice = await invoicesApi.createInvoice(payload);
      // Navigate directly to the generated printable invoice view
      navigate(`/invoices/${createdInvoice.id}`);
    } catch (err: any) {
      console.error('Failed to create invoice', err);
      setFormError(err.response?.data?.detail || 'Failed to generate invoice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          New Tax Invoice
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Company State: <strong>{companyState}</strong> • Tax Mode:{' '}
          <strong style={{ color: isInterstate ? '#0284c7' : '#059669' }}>
            {isInterstate ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'}
          </strong>
        </p>
      </div>

      {formError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 18px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '0.9rem',
            border: '1px solid #fecaca',
          }}
        >
          <AlertCircle size={20} />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmitInvoice}>
        <div className="billing-grid">
          {/* Main Billing Column */}
          <div className="billing-main-col">
            {/* Customer Details Box */}
            <div className="card">
              <div className="card-header" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} color="var(--primary)" />
                  <h3 className="card-title">Customer Information</h3>
                </div>
                {existingCustomerFound && (
                  <span className="badge badge-paid" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <UserCheck size={12} /> Existing Customer Auto-filled
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="customer-type">Customer Type</label>
                <select id="customer-type" className="form-control" value={customerType} onChange={e => {
                  const type = e.target.value as 'RETAIL' | 'VENDOR';
                  setCustomerType(type); setCustomerId(undefined); setCustomerPhone(''); setCustomerName('');
                  setCustomerAddress(''); setCustomerEmail(''); setCustomerGstin(''); setOutstanding(0);
                  setExistingCustomerFound(false); setPaymentMode(type === 'VENDOR' ? 'Credit' : 'Cash'); setAmountPaid(0);
                }}><option value="RETAIL">Retail</option><option value="VENDOR">Vendor</option></select>
              </div>
              {customerType === 'VENDOR' && <div className="form-group">
                <label className="form-label" htmlFor="billing-vendor-search">Search Vendors</label>
                <input id="billing-vendor-search" className="form-control" value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} placeholder="Vendor name, shop or phone" />
                <select aria-label="Select vendor" className="form-control" value={customerId || ''} onChange={e => {
                  const v = vendorOptions.find(v => v.id === Number(e.target.value));
                  if (!v) return;
                  setCustomerId(v.id); setCustomerName(v.name); setCustomerPhone(v.phone); setCustomerEmail(v.email || '');
                  setCustomerAddress(v.address || ''); setCustomerState(v.state); setCustomerGstin(v.gstin || '');
                  setOutstanding(v.balance_due ?? 0); setPaymentMode('Credit'); setAmountPaid(0); setExistingCustomerFound(true);
                }}><option value="">Choose a vendor or enter details below</option>{vendorOptions.map(v => <option key={v.id} value={v.id}>{v.name} {v.shop_name ? `- ${v.shop_name}` : ''} ({v.phone})</option>)}</select>
                <p>Current Outstanding: <strong>{formatCurrency(outstanding)}</strong></p>
              </div>}
              <div className="form-row">
                <div className="form-col form-group">
                  <label className="form-label">Phone Number * (10 Digits)</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="e.g. 9842112345"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    maxLength={10}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Type 10 digits to auto-suggest existing customer
                  </span>
                </div>

                <div className="form-col form-group">
                  <label className="form-label">Customer / Business Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter customer or enterprise name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col form-group">
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Street, City, Pincode"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>

                <div className="form-col form-group" style={{ maxWidth: '200px' }}>
                  <label className="form-label">Customer State *</label>
                  <select
                    className="form-control"
                    value={customerState}
                    onChange={(e) => setCustomerState(e.target.value)}
                  >
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Telangana">Telangana</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-col form-group" style={{ maxWidth: '240px' }}>
                  <label className="form-label">GSTIN (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="15-digit GSTIN"
                    value={customerGstin}
                    onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                    maxLength={15}
                  />
                </div>
              </div>
            </div>

            {/* Product Search & Line Items Box */}
            <div className="card">
              <div className="card-header" style={{ marginBottom: '14px' }}>
                <h3 className="card-title">Appliance Line Items</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {items.length} product(s) added
                </span>
              </div>

              {/* Product Live Search Dropdown */}
              <div className="search-dropdown-wrapper" style={{ marginBottom: '20px' }}>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-light)',
                    }}
                  >
                    <Search size={18} />
                  </span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: '44px', fontSize: '0.95rem', height: '46px' }}
                    placeholder="Search appliances by brand, model, SKU, or name (e.g. Sony, LG, 55X74L, Preethi)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowDropdown(true);
                    }}
                  />
                </div>

                {showDropdown && searchResults.length > 0 && (
                  <div className="search-results-popup">
                    {searchResults.map((prod, idx) => (
                      <div
                        key={prod.id}
                        className={`search-result-item ${idx === selectedIndex ? 'selected' : ''}`}
                        onClick={() => addProductToInvoice(prod)}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{prod.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {prod.brand} • SKU: {prod.sku} • HSN: {prod.hsn_code} • GST: {prod.gst_rate}%
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                            {formatCurrency(prod.unit_price)}
                          </div>
                          <div
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: prod.current_stock <= prod.reorder_level ? '#dc2626' : '#059669',
                            }}
                          >
                            Stock: {prod.current_stock}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items Table */}
              {items.length === 0 ? (
                <div
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: 'var(--radius-md)',
                    padding: '48px 20px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Receipt size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>No products added yet</p>
                  <p style={{ fontSize: '0.82rem' }}>
                    Use the search bar above to select appliances for this invoice.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="billing-table">
                    <thead>
                      <tr>
                        <th>Product Details</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Qty</th>
                        <th style={{ width: '125px', textAlign: 'right' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            Rate / Unit (₹) <Edit3 size={12} color="var(--primary)" />
                          </span>
                        </th>
                        <th style={{ width: '100px', textAlign: 'right' }}>Discount</th>
                        <th className="text-right" style={{ width: '90px' }}>Taxable</th>
                        <th className="text-right" style={{ width: '130px' }}>
                          {isInterstate ? 'IGST' : 'CGST + SGST'}
                        </th>
                        <th className="text-right" style={{ width: '125px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            Total (₹) <Edit3 size={12} color="var(--primary)" />
                          </span>
                        </th>
                        <th style={{ width: '30px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className={it.stock_error ? 'row-alert' : ''}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.84rem', lineHeight: 1.25 }}>
                              {it.product.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              SKU: {it.product.sku} • HSN: {it.product.hsn_code} • GST: {it.gst_rate}%
                            </div>
                            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => togglePriceIncludesGst(it.id)}
                                title="Click to toggle between inclusive/exclusive tax pricing"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  fontSize: '0.66rem',
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  backgroundColor: it.price_includes_gst ? '#ecfdf5' : '#eff6ff',
                                  color: it.price_includes_gst ? '#065f46' : '#1e40af',
                                  fontWeight: 600,
                                }}
                              >
                                {it.price_includes_gst ? '✓ Incl. GST' : '+ Excl. GST'}
                              </button>

                              <label
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.68rem',
                                  cursor: 'pointer',
                                  color: it.unit_price !== Number(it.product.unit_price) ? '#d97706' : 'var(--text-muted)',
                                  fontWeight: it.unit_price !== Number(it.product.unit_price) ? 600 : 400,
                                }}
                                title="Save this new price to the product catalog in the database"
                              >
                                <input
                                  type="checkbox"
                                  checked={it.update_product_price}
                                  onChange={() => toggleUpdateProductPrice(it.id)}
                                  style={{ cursor: 'pointer', width: '12px', height: '12px' }}
                                />
                                <span>Update DB price</span>
                              </label>

                              {it.unit_price !== Number(it.product.unit_price) && (
                                <span style={{ fontSize: '0.65rem', color: '#92400e', backgroundColor: '#fef3c7', padding: '1px 4px', borderRadius: '3px' }}>
                                  DB was ₹{Number(it.product.unit_price).toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                            {it.stock_error && (
                              <div style={{ color: '#dc2626', fontSize: '0.72rem', fontWeight: 600, marginTop: '2px' }}>
                                ⚠️ {it.stock_error}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="number"
                              min={1}
                              max={it.product.current_stock}
                              className="form-control billing-input-compact"
                              style={{ width: '52px', textAlign: 'center', margin: '0 auto' }}
                              value={it.quantity}
                              onChange={(e) => updateItemQty(it.id, e.target.value)}
                            />
                            <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Avail: {it.product.current_stock}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              className="form-control billing-input-compact"
                              style={{
                                width: '100px',
                                textAlign: 'right',
                                marginLeft: 'auto',
                                fontWeight: 600,
                                borderColor: it.unit_price !== Number(it.product.unit_price) ? '#f59e0b' : undefined,
                                backgroundColor: it.unit_price !== Number(it.product.unit_price) ? '#fffbeb' : undefined,
                              }}
                              value={it.raw_unit_price !== undefined ? it.raw_unit_price : it.unit_price}
                              onChange={(e) => updateItemPrice(it.id, e.target.value)}
                              title="Edit unit price (auto-calculates CGST/SGST and line total)"
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                className="form-control billing-input-compact"
                                style={{ width: '46px', textAlign: 'right' }}
                                value={it.discount_value}
                                onChange={(e) =>
                                  updateItemDiscount(it.id, e.target.value, it.discount_type)
                                }
                              />
                              <select
                                className="form-control billing-input-compact"
                                style={{ width: '38px', padding: '2px 2px', fontSize: '0.72rem' }}
                                value={it.discount_type}
                                onChange={(e) =>
                                  updateItemDiscount(
                                    it.id,
                                    String(it.discount_value),
                                    e.target.value as DiscountType
                                  )
                                }
                              >
                                <option value="percentage">%</option>
                                <option value="amount">₹</option>
                              </select>
                            </div>
                            {it.discount_amount > 0 && (
                              <div style={{ fontSize: '0.66rem', color: '#059669', textAlign: 'right', marginTop: '1px' }}>
                                -{formatCurrency(it.discount_amount)}
                              </div>
                            )}
                          </td>
                          <td className="text-right" style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                            {formatCurrency(it.taxable_value)}
                          </td>
                          <td className="text-right" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {isInterstate ? (
                              <div>
                                <div style={{ fontWeight: 600 }}>{formatCurrency(it.igst_amount)}</div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                                  {it.gst_rate}% IGST
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                  {formatCurrency(it.cgst_amount + it.sgst_amount)}
                                </div>
                                <div style={{ fontSize: '0.66rem', color: '#0369a1', lineHeight: 1.25 }}>
                                  CGST ({it.gst_rate / 2}%): {formatCurrency(it.cgst_amount)}
                                </div>
                                <div style={{ fontSize: '0.66rem', color: '#0284c7', lineHeight: 1.25 }}>
                                  SGST ({it.gst_rate / 2}%): {formatCurrency(it.sgst_amount)}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              className="form-control billing-input-compact"
                              style={{
                                width: '105px',
                                textAlign: 'right',
                                marginLeft: 'auto',
                                fontWeight: 700,
                                color: 'var(--primary)',
                              }}
                              value={it.raw_total_price !== undefined ? it.raw_total_price : it.line_total}
                              onChange={(e) => updateItemTotalPrice(it.id, e.target.value)}
                              title="Edit total price directly (auto-calculates rate, CGST & SGST)"
                            />
                          </td>
                          <td className="text-center" style={{ padding: '4px' }}>
                            <button
                              type="button"
                              onClick={() => removeItem(it.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Remove item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div className="card">
              <label className="form-label">Invoice Remarks / Customer Note (Optional)</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="e.g. Free delivery promised, Serial numbers or installation notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Sticky Summary & Payment Panel */}
          <div className="sticky-panel">
            <div className="totals-card">
              <h3
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CreditCard size={18} color="var(--primary)" />
                <span>Invoice Summary</span>
              </h3>

              <div className="totals-row">
                <span>Gross Value</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="totals-row" style={{ color: '#059669' }}>
                  <span>Total Discount</span>
                  <span>-{formatCurrency(totalDiscount)}</span>
                </div>
              )}

              <div className="totals-row" style={{ fontWeight: 600 }}>
                <span>Taxable Amount</span>
                <span>{formatCurrency(totalTaxable)}</span>
              </div>

              {isInterstate ? (
                <div className="totals-row">
                  <span>Total IGST</span>
                  <span>{formatCurrency(totalIgst)}</span>
                </div>
              ) : (
                <>
                  <div className="totals-row">
                    <span>Total CGST</span>
                    <span>{formatCurrency(totalCgst)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Total SGST</span>
                    <span>{formatCurrency(totalSgst)}</span>
                  </div>
                </>
              )}

              <div className="totals-row">
                <span>Round Off</span>
                <span>{formatCurrency(roundOff)}</span>
              </div>

              <div className="totals-row grand-total">
                <span>Grand Total</span>
                <span style={{ color: 'var(--primary)' }}>{formatCurrency(grandTotal)}</span>
              </div>

              {/* Payment Details */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-control"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Card">Debit / Credit Card</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="Credit">Credit / Due</option>
                  </select>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Amount Paid Now (₹)</label>
                    <button
                      type="button"
                      onClick={handleFullPayment}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Paid in Full
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="form-control"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                  }}
                >
                  <span>Balance Due:</span>
                  <span style={{ color: balanceDue > 0 ? '#dc2626' : '#059669' }}>
                    {formatCurrency(balanceDue)}
                  </span>
                </div>

                <div style={{ marginTop: '8px', textAlign: 'center' }}>
                  <span
                    className={`badge ${
                      amountPaid >= grandTotal
                        ? 'badge-paid'
                        : amountPaid > 0
                        ? 'badge-partial'
                        : 'badge-unpaid'
                    }`}
                  >
                    Status:{' '}
                    {amountPaid >= grandTotal
                      ? 'PAID'
                      : amountPaid > 0
                      ? 'PARTIALLY PAID'
                      : 'UNPAID'}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || items.length === 0 || hasStockErrors}
                style={{ width: '100%', marginTop: '20px', padding: '14px', fontSize: '1rem' }}
              >
                {isSubmitting ? 'Generating Invoice...' : 'Complete & Generate Invoice'}{' '}
                <ArrowRight size={18} />
              </button>

              {hasStockErrors && (
                <div style={{ color: '#dc2626', fontSize: '0.75rem', textAlign: 'center', marginTop: '8px' }}>
                  Reduce quantities to available stock to proceed.
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};


