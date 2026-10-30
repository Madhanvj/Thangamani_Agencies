import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { customersApi } from '../api';
import type { Customer, Invoice } from '../types';
import { formatCurrency, formatDate, isValidPhone, isValidGSTIN } from '../utils/formatters';
import {
  Search,
  Plus,
  Eye,
  Edit2,
  Users,
  FileText,
  Phone,
  Mail,
} from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [gstin, setGstin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Purchase History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customersApi.getCustomers({
        page,
        limit,
        search: search.trim() || undefined,
      });
      setCustomers(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setState('Tamil Nadu');
    setGstin('');
    setModalError('');
    setShowModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email || '');
    setAddress(c.address || '');
    setState(c.state || 'Tamil Nadu');
    setGstin(c.gstin || '');
    setModalError('');
    setShowModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!isValidPhone(phone)) {
      setModalError('Please enter a valid 10-digit phone number.');
      return;
    }

    if (gstin && !isValidGSTIN(gstin)) {
      setModalError('Please enter a valid 15-character GSTIN or leave blank.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCustomer) {
        await customersApi.updateCustomer(editingCustomer.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          address: address.trim() || null,
          state: state.trim(),
          gstin: gstin.trim().toUpperCase() || null,
        });
      } else {
        await customersApi.createCustomer({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          address: address.trim() || null,
          state: state.trim(),
          gstin: gstin.trim().toUpperCase() || null,
        });
      }
      setShowModal(false);
      await fetchCustomers();
    } catch (err: any) {
      setModalError(err.response?.data?.detail || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  const openPurchaseHistory = async (c: Customer) => {
    setSelectedCustomer(c);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const data = await customersApi.getCustomerInvoices(c.id);
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load customer purchase history', err);
    } finally {
      setHistoryLoading(false);
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Customer Directory
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Customer records, billing states, GSTIN details, and cumulative purchase history
          </p>
        </div>

        <button onClick={openAddModal} className="btn btn-primary">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '14px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
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
              placeholder="Search by customer name, phone number, email, or GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
      </div>

      {/* Customers Table */}
      <div className="card">
        {loading ? (
          <p style={{ padding: '20px' }}>Loading customers...</p>
        ) : customers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontWeight: 600 }}>No customers found</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Contact Info</th>
                  <th>State & Address</th>
                  <th>GSTIN</th>
                  <th className="text-center">Total Invoices</th>
                  <th className="text-right">Total Spent</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Registered: {formatDate(c.created_at)}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <Phone size={13} color="var(--text-muted)" />
                        <strong>{c.phone}</strong>
                      </div>
                      {c.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          <Mail size={13} />
                          <span>{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.state}</div>
                      {c.address && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '220px' }}>
                          {c.address}
                        </div>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {c.gstin ? (
                        <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}>
                          {c.gstin}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>Consumer</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="badge badge-paid" style={{ fontWeight: 700 }}>
                        {c.total_invoices || 0}
                      </span>
                    </td>
                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {formatCurrency(c.total_spent || 0)}
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => openPurchaseHistory(c)}
                          className="btn btn-secondary btn-sm"
                          title="View Purchase History"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          onClick={() => openEditModal(c)}
                          className="btn btn-secondary btn-sm"
                          title="Edit Customer"
                        >
                          <Edit2 size={14} />
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

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCustomer ? 'Edit Customer Details' : 'Add New Customer'}
      >
        <form onSubmit={handleSaveCustomer}>
          {modalError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '0.85rem',
              }}
            >
              {modalError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Customer / Enterprise Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Murugesan Palanisamy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-col form-group">
              <label className="form-label">Mobile Number * (10 Digits)</label>
              <input
                type="tel"
                className="form-control"
                placeholder="e.g. 9842112345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={10}
                required
              />
            </div>
            <div className="form-col form-group">
              <label className="form-label">Email Address (Optional)</label>
              <input
                type="email"
                className="form-control"
                placeholder="customer@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              type="text"
              className="form-control"
              placeholder="Street, Locality, City, Pincode"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-col form-group">
              <label className="form-label">State *</label>
              <select
                className="form-control"
                value={state}
                onChange={(e) => setState(e.target.value)}
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
            <div className="form-col form-group">
              <label className="form-label">GSTIN (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="15-character GSTIN"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                maxLength={15}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ margin: '20px -24px -24px -24px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Purchase History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={`Purchase History: ${selectedCustomer?.name}`}
        size="lg"
      >
        <div>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
            <div>Phone: <strong>{selectedCustomer?.phone}</strong> • State: <strong>{selectedCustomer?.state}</strong></div>
            {selectedCustomer?.address && <div>Address: {selectedCustomer.address}</div>}
          </div>

          {historyLoading ? (
            <p>Loading purchase history...</p>
          ) : invoices.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No purchases recorded yet for this customer.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th className="text-right">Grand Total</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Balance Due</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {inv.invoice_number}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{formatDate(inv.invoice_date)}</td>
                      <td className="text-right" style={{ fontWeight: 700 }}>
                        {formatCurrency(inv.grand_total)}
                      </td>
                      <td className="text-right" style={{ color: '#059669', fontWeight: 600 }}>
                        {formatCurrency(inv.amount_paid)}
                      </td>
                      <td className="text-right" style={{ color: parseFloat(String(inv.balance_due)) > 0 ? '#dc2626' : 'var(--text-muted)' }}>
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
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          <Eye size={14} /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
