import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { invoicesApi, settingsApi, paymentsApi } from '../api';
import type { Invoice, CompanySetting, Payment } from '../types';
import { formatCurrency, formatDate, formatDateOnly } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Printer,
  Download,
  ArrowLeft,
  XCircle,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../components/Modal';

export const InvoiceView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<CompanySetting | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState('Cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const fetchInvoiceData = async () => {
    if (!id) return;
    try {
      const invData = await invoicesApi.getInvoice(parseInt(id));
      setInvoice(invData);
      setPayAmount(parseFloat(String(invData.balance_due)));

      const compData = await settingsApi.getCompanySettings();
      setCompany(compData);

      const payData = await paymentsApi.getInvoicePayments(invData.id);
      setPayments(payData);
    } catch (err: any) {
      console.error('Failed to load invoice', err);
      setError('Invoice not found or could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      await invoicesApi.downloadPdf(invoice.id, invoice.invoice_number);
    } catch {
      alert('Failed to download PDF. Please try again.');
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoice) return;
    setCancelSubmitting(true);
    try {
      await invoicesApi.cancelInvoice(invoice.id);
      setShowCancelModal(false);
      await fetchInvoiceData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel invoice.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    setPaymentSubmitting(true);
    try {
      await paymentsApi.recordPayment({
        invoice_id: invoice.id,
        amount: payAmount,
        payment_mode: payMode,
        reference_number: payRef.trim() || undefined,
        notes: payNotes.trim() || undefined,
      });
      setShowPaymentModal(false);
      await fetchInvoiceData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to record payment.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <p>Loading invoice details...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="page-container">
        <div style={{ color: 'var(--danger)', marginBottom: '16px' }}>{error}</div>
        <Link to="/invoices" className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to Invoices
        </Link>
      </div>
    );
  }

  const isCancelled = invoice.status === 'CANCELLED';
  const canModify = user?.role === 'admin' || user?.role === 'billing_staff';

  return (
    <div className="page-container">
      {/* Top Action Toolbar (Hidden during print) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <Link to="/invoices" className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to Invoices
        </Link>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handlePrint} className="btn btn-secondary">
            <Printer size={16} /> Print (A4)
          </button>
          <button onClick={handleDownloadPdf} className="btn btn-primary">
            <Download size={16} /> Download PDF
          </button>
          {canModify && !isCancelled && parseFloat(String(invoice.balance_due)) > 0 && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="btn btn-success"
            >
              <CreditCard size={16} /> Record Payment
            </button>
          )}
          {canModify && !isCancelled && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="btn btn-danger"
            >
              <XCircle size={16} /> Cancel Invoice
            </button>
          )}
        </div>
      </div>

      {isCancelled && (
        <div
          className="no-print"
          style={{
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={20} />
          <span>
            This invoice is CANCELLED. All deducted appliance stock has been automatically restored to inventory.
          </span>
        </div>
      )}

      {/* Printable A4 Sheet Preview */}
      <div className="invoice-paper-preview">
        {/* Header with Company Details */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #0f172a',
            paddingBottom: '16px',
            marginBottom: '20px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
              {company?.company_name || 'Thangamani Agencies'}
            </h1>
            <p style={{ fontSize: '0.82rem', color: '#475569', maxWidth: '380px', marginTop: '4px' }}>
              {company?.address || '124, Netaji Road, Pollachi, Tamil Nadu - 642001'}
            </p>
            <p style={{ fontSize: '0.82rem', color: '#0f172a', marginTop: '4px' }}>
              <strong>GSTIN:</strong> {company?.gstin || '33ABCDE1234F1Z5'} | <strong>State:</strong>{' '}
              {company?.state || 'Tamil Nadu'}
            </p>
            <p style={{ fontSize: '0.82rem', color: '#475569' }}>
              <strong>Phone:</strong> {company?.phone || '+91 98765 43210'} | <strong>Email:</strong>{' '}
              {company?.email || 'contact@thangamaniagencies.com'}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                color: '#4f46e5',
                letterSpacing: '0.05em',
                display: 'block',
              }}
            >
              TAX INVOICE
            </span>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '4px' }}>
              {invoice.invoice_number}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              Date: <strong>{formatDateOnly(invoice.invoice_date)}</strong>
            </div>
            <div style={{ marginTop: '8px' }}>
              <span
                className={`badge ${
                  isCancelled
                    ? 'badge-cancelled'
                    : invoice.status === 'PAID'
                    ? 'badge-paid'
                    : invoice.status === 'PARTIALLY_PAID'
                    ? 'badge-partial'
                    : 'badge-unpaid'
                }`}
              >
                {invoice.status}
              </span>
            </div>
          </div>
        </div>

        {/* Bill To & Invoice Meta Box */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: '20px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '14px 18px',
            marginBottom: '24px',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Billed To (Customer Details)
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
              {invoice.customer?.name || 'Walk-in Customer'}
            </div>
            <div style={{ color: '#475569', marginTop: '2px' }}>
              <strong>Phone:</strong> {invoice.customer?.phone || '-'}
            </div>
            {invoice.customer?.address && (
              <div style={{ color: '#475569', marginTop: '2px' }}>
                <strong>Address:</strong> {invoice.customer.address}
              </div>
            )}
            <div style={{ color: '#475569', marginTop: '2px' }}>
              <strong>State:</strong> {invoice.customer_state}
              {invoice.customer?.gstin && (
                <> | <strong>GSTIN:</strong> {invoice.customer.gstin}</>
              )}
            </div>
          </div>

          <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Invoice Details
            </div>
            <div style={{ marginTop: '4px', color: '#334155' }}>
              <strong>Place of Supply:</strong> {invoice.customer_state}
            </div>
            <div style={{ marginTop: '2px', color: '#334155' }}>
              <strong>Supply Type:</strong>{' '}
              {invoice.is_interstate ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'}
            </div>
            <div style={{ marginTop: '2px', color: '#334155' }}>
              <strong>Payment Mode:</strong> {invoice.payment_mode}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        {/* Line Items Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.82rem',
            marginBottom: '16px',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#0f172a', color: 'white' }}>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: '30px' }}>#</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item Description</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: '60px' }}>HSN</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: '45px' }}>Qty</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', width: '85px' }}>MRP/Rate (₹)</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', width: '85px' }}>Taxable (₹)</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>GST %</th>
              {invoice.is_interstate ? (
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '80px' }}>IGST (₹)</th>
              ) : (
                <>
                  <th style={{ padding: '8px 10px', textAlign: 'right', width: '75px' }}>CGST (₹)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', width: '75px' }}>SGST (₹)</th>
                </>
              )}
              <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, idx) => {
              const isInclusive = it.price_includes_gst !== false;
              return (
                <tr
                  key={it.id || idx}
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                  }}
                >
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{it.product_name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      SKU: {it.sku}
                      <span
                        style={{
                          marginLeft: '8px',
                          display: 'inline-block',
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          backgroundColor: isInclusive ? '#ecfdf5' : '#eff6ff',
                          color: isInclusive ? '#065f46' : '#1e40af',
                          fontWeight: 600,
                        }}
                      >
                        {isInclusive ? 'Price incl. GST' : 'Price excl. GST'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                    {it.hsn_code}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>{it.quantity}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    {parseFloat(String(it.unit_price)).toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    {parseFloat(String(it.taxable_value)).toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '0.78rem' }}>
                    {it.gst_rate}%
                  </td>
                  {invoice.is_interstate ? (
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {parseFloat(String(it.igst_amount)).toFixed(2)}
                    </td>
                  ) : (
                    <>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        {parseFloat(String(it.cgst_amount)).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        {parseFloat(String(it.sgst_amount)).toFixed(2)}
                      </td>
                    </>
                  )}
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                    {parseFloat(String(it.line_total)).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* GST Tax Summary Table Grouped by GST Rate */}
        {(() => {
          const taxSummaryList =
            invoice.tax_summary && invoice.tax_summary.length > 0
              ? invoice.tax_summary
              : (() => {
                  const map = new Map<string, any>();
                  for (const it of invoice.items) {
                    const rateKey = String(parseFloat(String(it.gst_rate)));
                    if (!map.has(rateKey)) {
                      map.set(rateKey, {
                        gst_rate: parseFloat(rateKey),
                        taxable_value: 0,
                        cgst_amount: 0,
                        sgst_amount: 0,
                        igst_amount: 0,
                        total_tax: 0,
                      });
                    }
                    const row = map.get(rateKey)!;
                    row.taxable_value += parseFloat(String(it.taxable_value));
                    row.cgst_amount += parseFloat(String(it.cgst_amount));
                    row.sgst_amount += parseFloat(String(it.sgst_amount));
                    row.igst_amount += parseFloat(String(it.igst_amount));
                    row.total_tax +=
                      parseFloat(String(it.cgst_amount)) +
                      parseFloat(String(it.sgst_amount)) +
                      parseFloat(String(it.igst_amount));
                  }
                  return Array.from(map.values()).sort((a, b) => a.gst_rate - b.gst_rate);
                })();

          return (
            <div style={{ marginBottom: '22px' }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  letterSpacing: '0.03em',
                }}
              >
                GST Tax Summary (Grouped by Rate)
              </div>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.78rem',
                  border: '1px solid #e2e8f0',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', border: '1px solid #e2e8f0' }}>GST Rate</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>Taxable Value (₹)</th>
                    {invoice.is_interstate ? (
                      <th style={{ padding: '6px 10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>IGST (₹)</th>
                    ) : (
                      <>
                        <th style={{ padding: '6px 10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>CGST (₹)</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>SGST (₹)</th>
                      </>
                    )}
                    <th style={{ padding: '6px 10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>Total Tax (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {taxSummaryList.map((row, rIdx) => (
                    <tr key={rIdx} style={{ backgroundColor: rIdx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                        {parseFloat(String(row.gst_rate))}% GST
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>
                        {parseFloat(String(row.taxable_value)).toFixed(2)}
                      </td>
                      {invoice.is_interstate ? (
                        <td style={{ padding: '6px 10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>
                          {parseFloat(String(row.igst_amount)).toFixed(2)}
                        </td>
                      ) : (
                        <>
                          <td style={{ padding: '6px 10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>
                            {parseFloat(String(row.cgst_amount)).toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>
                            {parseFloat(String(row.sgst_amount)).toFixed(2)}
                          </td>
                        </>
                      )}
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, border: '1px solid #e2e8f0' }}>
                        {parseFloat(String(row.total_tax)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* Totals & Tax Summary Breakdown */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: '20px',
            marginBottom: '24px',
            fontSize: '0.85rem',
          }}
        >
          {/* Left Column: Tax Breakdown and Words */}
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              GST Tax Breakdown Summary
            </div>
            <div style={{ marginTop: '8px', lineHeight: '1.6' }}>
              <div>• Total Taxable Value: <strong>{formatCurrency(invoice.total_taxable)}</strong></div>
              {invoice.is_interstate ? (
                <div>• Total Integrated GST (IGST): <strong>{formatCurrency(invoice.total_igst)}</strong></div>
              ) : (
                <>
                  <div>• Central GST (CGST): <strong>{formatCurrency(invoice.total_cgst)}</strong></div>
                  <div>• State GST (SGST): <strong>{formatCurrency(invoice.total_sgst)}</strong></div>
                </>
              )}
            </div>

            <div style={{ marginTop: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Invoice Amount in Words
              </div>
              <div style={{ fontStyle: 'italic', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
                {invoice.grand_total_words}
              </div>
            </div>
          </div>

          {/* Right Column: Final Totals */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <span>Subtotal (Taxable):</span>
              <strong>{formatCurrency(invoice.total_taxable)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <span>Total Tax:</span>
              <strong>
                {formatCurrency(
                  parseFloat(String(invoice.total_cgst)) +
                    parseFloat(String(invoice.total_sgst)) +
                    parseFloat(String(invoice.total_igst))
                )}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <span>Round Off:</span>
              <span>{formatCurrency(invoice.round_off)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: '#f1f5f9',
                fontSize: '1rem',
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              <span>Grand Total:</span>
              <span style={{ color: '#4f46e5' }}>{formatCurrency(invoice.grand_total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <span>Amount Paid:</span>
              <span style={{ color: '#059669', fontWeight: 600 }}>{formatCurrency(invoice.amount_paid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', backgroundColor: '#fef2f2' }}>
              <span style={{ fontWeight: 600, color: '#991b1b' }}>Balance Due:</span>
              <strong style={{ color: '#dc2626' }}>{formatCurrency(invoice.balance_due)}</strong>
            </div>
          </div>
        </div>

        {/* Payment History if any payments recorded */}
        {payments.length > 0 && (
          <div style={{ marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
              Payment Transactions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {payments.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>
                    {formatDate(p.payment_date)} • <strong>{p.payment_mode}</strong>{' '}
                    {p.reference_number && `(${p.reference_number})`}
                  </span>
                  <strong style={{ color: '#059669' }}>{formatCurrency(p.amount)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terms and Authorized Signatory */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 0.6fr',
            gap: '20px',
            borderTop: '1px solid #cbd5e1',
            paddingTop: '16px',
            marginTop: '20px',
            fontSize: '0.78rem',
            color: '#475569',
          }}
        >
          <div>
            <strong>Terms & Conditions:</strong>
            <p style={{ whiteSpace: 'pre-line', marginTop: '4px', lineHeight: '1.4' }}>
              {company?.terms_and_conditions ||
                '1. Goods once sold will not be taken back without valid reason.\n2. Warranty is as per manufacturer terms.\n3. Subject to Coimbatore/Pollachi jurisdiction.'}
            </p>
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <p style={{ fontWeight: 600, color: '#0f172a' }}>For {company?.company_name || 'Thangamani Agencies'}</p>
            <div style={{ height: '40px' }}></div>
            <p style={{ fontWeight: 700, color: '#0f172a', borderTop: '1px solid #94a3b8', paddingTop: '4px' }}>
              Authorized Signatory
            </p>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Payment for Invoice"
      >
        <form onSubmit={handleRecordPayment}>
          <div className="form-group">
            <label className="form-label">Balance Due</label>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626' }}>
              {formatCurrency(invoice.balance_due)}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={parseFloat(String(invoice.balance_due))}
              className="form-control"
              value={payAmount}
              onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Mode *</label>
            <select
              className="form-control"
              value={payMode}
              onChange={(e) => setPayMode(e.target.value)}
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI / GPay / PhonePe</option>
              <option value="Card">Debit / Credit Card</option>
              <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Reference Number (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. UPI Ref / Txn ID / Cheque No"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="Payment remarks"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ margin: '20px -24px -24px -24px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowPaymentModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-success"
              disabled={paymentSubmitting || payAmount <= 0}
            >
              {paymentSubmitting ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Invoice Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Invoice Confirmation"
      >
        <div>
          <p style={{ color: '#991b1b', marginBottom: '12px', fontWeight: 600 }}>
            Are you sure you want to cancel invoice <strong>{invoice.invoice_number}</strong>?
          </p>
          <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '20px' }}>
            Cancelling will mark this invoice as CANCELLED and will{' '}
            <strong>automatically restore the appliance stock</strong> back to the inventory in a single atomic database transaction.
            This action cannot be undone.
          </p>

          <div className="modal-footer" style={{ margin: '20px -24px -24px -24px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowCancelModal(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={cancelSubmitting}
              onClick={handleCancelInvoice}
            >
              {cancelSubmitting ? 'Cancelling...' : 'Confirm & Cancel Invoice'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
