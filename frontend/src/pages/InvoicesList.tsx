import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoicesApi } from '../api';
import type { Invoice, InvoiceStatus } from '../types';
import { formatCurrency, formatDate, sendWhatsAppInvoice } from '../utils/formatters';
import {
  Search,
  Eye,
  Download,
  Receipt,
  Filter,
  Trash2,
  AlertTriangle,
  MessageCircle,
} from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { useAuth } from '../context/AuthContext';

export const InvoicesList: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [loading, setLoading] = useState(true);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await invoicesApi.getInvoices({
        page,
        limit,
        search: search.trim() || undefined,
        status_filter: (statusFilter as InvoiceStatus) || undefined,
      });
      setInvoices(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  };

  const handleDeleteClick = (inv: Invoice) => {
    setDeleteTarget(inv);
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await invoicesApi.deleteInvoice(deleteTarget.id);
      setDeleteTarget(null);
      if (invoices.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        await fetchInvoices();
      }
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete invoice. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page-container">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Tax Invoices
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Search, view, print, and track payments across all generated bills
          </p>
        </div>

        <Link to="/billing" className="btn btn-primary">
          <Receipt size={16} /> Create Invoice
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-light)',
              }}
            >
              <Search size={18} />
            </span>
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '40px' }}
              placeholder="Search by invoice number, customer name, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-control"
              style={{ width: '160px' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as InvoiceStatus | '');
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="PAID">PAID</option>
              <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
              <option value="UNPAID">UNPAID</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
      </div>

      {/* Invoices Table */}
      <div className="card">
        {loading ? (
          <p style={{ padding: '20px' }}>Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <Receipt size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontWeight: 600 }}>No invoices found</p>
            <p style={{ fontSize: '0.85rem' }}>Create a new sale invoice to see it listed here.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>State</th>
                  <th className="text-right">Grand Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance Due</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link
                        to={`/invoices/${inv.id}`}
                        style={{
                          fontWeight: 700,
                          color: 'var(--primary)',
                          textDecoration: 'none',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {formatDate(inv.invoice_date)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inv.customer?.name || 'Walk-in'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {inv.customer?.phone || '-'}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem' }}>{inv.customer_state}</span>
                    </td>
                    <td className="text-right" style={{ fontWeight: 700 }}>
                      {formatCurrency(inv.grand_total)}
                    </td>
                    <td className="text-right" style={{ color: '#059669', fontWeight: 600 }}>
                      {formatCurrency(inv.amount_paid)}
                    </td>
                    <td
                      className="text-right"
                      style={{
                        fontWeight: 700,
                        color: parseFloat(String(inv.balance_due)) > 0 ? '#dc2626' : 'var(--text-muted)',
                      }}
                    >
                      {formatCurrency(inv.balance_due)}
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge ${
                          inv.status === 'CANCELLED'
                            ? 'badge-cancelled'
                            : inv.status === 'PAID'
                            ? 'badge-paid'
                            : inv.status === 'PARTIALLY_PAID'
                            ? 'badge-partial'
                            : 'badge-unpaid'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="btn btn-secondary btn-sm"
                          title="View & Print"
                        >
                          <Eye size={14} />
                        </Link>
                        <button
                          onClick={() => invoicesApi.downloadPdf(inv.id, inv.invoice_number)}
                          className="btn btn-secondary btn-sm"
                          title="Download PDF"
                        >
                          <Download size={14} />
                        </button>
                        {inv.customer?.phone && (
                          <button
                            onClick={() =>
                              sendWhatsAppInvoice({
                                invoiceId: inv.id,
                                invoiceNumber: inv.invoice_number,
                                phone: inv.customer!.phone,
                                customerName: inv.customer?.name || 'Customer',
                                grandTotal: inv.grand_total,
                                balanceDue: inv.balance_due,
                                fetchPdfBlob: invoicesApi.getPdfBlob,
                              })
                            }
                            className="btn btn-sm"
                            title="Send PDF via WhatsApp"
                            style={{
                              background: '#dcfce7',
                              color: '#16a34a',
                              border: '1px solid #86efac',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <MessageCircle size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteClick(inv)}
                            className="btn btn-sm"
                            title="Delete Invoice"
                            style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fca5a5',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={pages}
          totalItems={total}
          onPageChange={(p) => setPage(p)}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={(e) => { if (!deleting && e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111' }}>
                  Delete Invoice?
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Invoice details */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Invoice No</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: '#4f46e5' }}>
                  {deleteTarget.invoice_number}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Customer</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  {deleteTarget.customer?.name || 'Walk-in'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Grand Total</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dc2626' }}>
                  {formatCurrency(deleteTarget.grand_total)}
                </span>
              </div>
            </div>

            {/* Warning note */}
            <p style={{ fontSize: '0.82rem', color: '#92400e', background: '#fef3c7', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
              ⚠️ Stock will be <strong>restored</strong> for all items in this invoice (if not already cancelled).
            </p>

            {/* Error */}
            {deleteError && (
              <p style={{ fontSize: '0.82rem', color: '#dc2626', marginBottom: '12px', background: '#fee2e2', padding: '10px 14px', borderRadius: '8px' }}>
                {deleteError}
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                style={{
                  background: deleting ? '#fca5a5' : '#dc2626',
                  color: '#fff',
                  border: 'none',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                <Trash2 size={15} />
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
