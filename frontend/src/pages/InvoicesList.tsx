import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoicesApi } from '../api';
import type { Invoice, InvoiceStatus } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  Search,
  Eye,
  Download,
  Receipt,
  Filter,
} from 'lucide-react';
import { Pagination } from '../components/Pagination';

export const InvoicesList: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [loading, setLoading] = useState(true);

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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
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
    </div>
  );
};
