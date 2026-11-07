import React, { useEffect, useState } from 'react';
import { customersApi } from '../api';
import type { Customer, LedgerStatement, KhataSummary } from '../types';
import { formatCurrency, formatDate, isValidPhone, isValidGSTIN } from '../utils/formatters';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';

const today = () => new Date().toLocaleDateString('en-CA');
const emptyVendor = { name: '', shop_name: '', phone: '', gstin: '', address: '', state: 'Tamil Nadu' };
const message = (error: unknown) => {
  const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
  return typeof detail === 'string' ? detail : 'Unable to complete request. Please try again.';
};

export const VendorKhata: React.FC = () => {
  const [vendors, setVendors] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<KhataSummary | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [vendor, setVendor] = useState(emptyVendor);
  const [collecting, setCollecting] = useState<Customer | null>(null);
  const [payment, setPayment] = useState({ amount: '', payment_mode: 'Cash', date: today(), reference_number: '', notes: '' });
  const [selected, setSelected] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerStatement | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const range = { start_date: startDate || undefined, end_date: endDate || undefined };

  const reload = async () => {
    setLoading(true); setError('');
    try {
      const [list, totals] = await Promise.all([
        customersApi.getCustomers({ page, limit: 10, search, customer_type: 'VENDOR' }), customersApi.getKhataSummary(),
      ]);
      setVendors(list.items); setPages(list.pages); setTotal(list.total); setSummary(totals);
    } catch (err) { setError(message(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { const timer = setTimeout(() => { void reload(); }, 250); return () => clearTimeout(timer); }, [page, search]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setLedger(null); setLedgerLoading(true); setModalError('');
    customersApi.getStatement(selected.id, range).then(data => { if (active) setLedger(data); })
      .catch(err => { if (active) setModalError(message(err)); })
      .finally(() => { if (active) setLedgerLoading(false); });
    return () => { active = false; };
  }, [selected, startDate, endDate]);

  const saveVendor = async (event: React.FormEvent) => {
    event.preventDefault(); setModalError('');
    if (!isValidPhone(vendor.phone) || (vendor.gstin && !isValidGSTIN(vendor.gstin))) {
      setModalError('Enter a valid 10-digit phone and GSTIN (if provided).'); return;
    }
    setBusy(true);
    try { await customersApi.createCustomer({ ...vendor, customer_type: 'VENDOR' }); setAdding(false); await reload(); }
    catch (err) { setModalError(message(err)); } finally { setBusy(false); }
  };
  const collect = async (event: React.FormEvent) => {
    event.preventDefault(); if (!collecting) return;
    setBusy(true); setModalError('');
    try {
      await customersApi.collectPayment(collecting.id, {
        amount: Number(payment.amount), payment_mode: payment.payment_mode,
        payment_date: new Date(`${payment.date}T${payment.date === today() ? new Date().toTimeString().slice(0, 8) : '23:59:59'}`).toISOString(),
        reference_number: payment.reference_number, notes: payment.notes,
      });
      setCollecting(null); await reload();
    } catch (err) { setModalError(message(err)); } finally { setBusy(false); }
  };
  return <div className="page-container">
    <div className="card-header"><h2>Vendor Khata</h2><button className="btn btn-primary" onClick={() => { setVendor(emptyVendor); setModalError(''); setAdding(true); }}>Add Vendor</button></div>
    <div className="khata-kpis">
      {[[ 'Total Vendors', summary?.total_vendors ?? 0 ], ['Total Receivables', formatCurrency(summary?.total_receivables ?? 0)], ['Total Collected This Month', formatCurrency(summary?.collected_this_month ?? 0)]].map(([label, value]) => <div className="card" key={label}><p>{label}</p><h2>{value}</h2></div>)}
    </div>
    {error && <p role="alert" className="khata-error">{error}</p>}
    <div className="card">
      <label className="form-label" htmlFor="vendor-search">Search vendors</label>
      <input id="vendor-search" className="form-control" placeholder="Name, shop, phone or GSTIN" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      <div className="table-responsive"><table><thead><tr>{['Vendor Name', 'Shop Name', 'Phone', 'Total Billed', 'Total Paid', 'Outstanding Balance', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={7}>Loading vendors...</td></tr> : vendors.length === 0 ? <tr><td colSpan={7}>No vendors found. Add a vendor to begin.</td></tr> : vendors.map(v => <tr key={v.id}>
          <td>{v.name}</td><td>{v.shop_name || '-'}</td><td>{v.phone}</td><td>{formatCurrency(v.total_billed ?? 0)}</td><td>{formatCurrency(v.total_paid ?? 0)}</td>
          <td><span className={`badge ${Number(v.balance_due) > 0 ? 'badge-unpaid' : 'badge-paid'}`}>{formatCurrency(v.balance_due ?? 0)}</span></td>
          <td><div className="khata-actions"><button className="btn btn-secondary" disabled={!Number(v.balance_due)} onClick={() => { setCollecting(v); setModalError(''); setPayment({ amount: '', payment_mode: 'Cash', date: today(), reference_number: '', notes: '' }); }}>Collect Payment</button>
            <button className="btn btn-secondary" onClick={() => { setSelected(v); setStartDate(''); setEndDate(''); }}>Ledger</button></div></td>
        </tr>)}</tbody></table></div>
      <Pagination currentPage={page} totalPages={pages} totalItems={total} onPageChange={setPage} />
    </div>
    <Modal isOpen={adding} onClose={() => { if (!busy) setAdding(false); }} title="Add Vendor">
      <form onSubmit={saveVendor}>{Object.entries(vendor).map(([key, value]) => <div className="form-group" key={key}><label className="form-label" htmlFor={`vendor-${key}`}>{key.replace('_', ' ').toUpperCase()}</label><input id={`vendor-${key}`} className="form-control" value={value} required={['name', 'phone', 'state'].includes(key)} onChange={e => setVendor({ ...vendor, [key]: e.target.value })} /></div>)}
        {modalError && <p role="alert" className="khata-error">{modalError}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save Vendor'}</button></form>
    </Modal>
    <Modal isOpen={!!collecting} onClose={() => { if (!busy) setCollecting(null); }} title={`Collect Payment - ${collecting?.name ?? ''}`}>
      <form onSubmit={collect}><p>Outstanding: {formatCurrency(collecting?.balance_due ?? 0)}</p>
        <label className="form-label" htmlFor="pay-amount">Amount</label><input id="pay-amount" className="form-control" type="number" min="0.01" step="0.01" max={Number(collecting?.balance_due)} required value={payment.amount} onChange={e => setPayment({ ...payment, amount: e.target.value })} />
        <label className="form-label" htmlFor="pay-mode">Payment Method</label><select id="pay-mode" className="form-control" value={payment.payment_mode} onChange={e => setPayment({ ...payment, payment_mode: e.target.value })}>{['Cash', 'UPI', 'Card', 'Bank Transfer'].map(mode => <option key={mode} value={mode}>{mode === 'Bank Transfer' ? 'Bank Transfer / NEFT' : mode}</option>)}</select>
        <label className="form-label" htmlFor="pay-date">Date</label><input id="pay-date" className="form-control" type="date" required max={today()} value={payment.date} onChange={e => setPayment({ ...payment, date: e.target.value })} />
        <label className="form-label" htmlFor="pay-ref">Reference Number</label><input id="pay-ref" className="form-control" maxLength={100} value={payment.reference_number} onChange={e => setPayment({ ...payment, reference_number: e.target.value })} />
        <label className="form-label" htmlFor="pay-notes">Notes</label><textarea id="pay-notes" className="form-control" value={payment.notes} onChange={e => setPayment({ ...payment, notes: e.target.value })} />
        {modalError && <p role="alert" className="khata-error">{modalError}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? 'Recording...' : 'Record Payment'}</button>
      </form>
    </Modal>
    <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`Ledger - ${selected?.name ?? ''}`} size="lg">
      <div className="khata-actions"><label>From <input aria-label="Statement start date" className="form-control" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label><label>To <input aria-label="Statement end date" className="form-control" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
        <button className="btn btn-primary" disabled={!ledger || busy || ledgerLoading} onClick={async () => { if (!selected) return; setBusy(true); try { await customersApi.downloadStatement(selected.id, range); } catch (err) { setModalError(message(err)); } finally { setBusy(false); } }}>Download Statement PDF</button></div>
      {modalError && <p role="alert" className="khata-error">{modalError}</p>}{ledgerLoading && <p>Loading ledger...</p>}
      {ledger && <><p>Opening Balance: {formatCurrency(ledger.opening_balance)}</p><div className="table-responsive"><table><thead><tr>{['Date', 'Transaction', 'Debit', 'Credit', 'Running Balance'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{ledger.transactions.map(row => <tr key={`${row.type}-${row.id}`}><td>{formatDate(row.date)}</td><td>{row.description}{row.reference_number && <small><br />{row.reference_number}</small>}{row.notes && <small><br />{row.notes}</small>}</td><td>{formatCurrency(row.debit)}</td><td>{formatCurrency(row.credit)}</td><td>{formatCurrency(row.balance)}</td></tr>)}{!ledger.transactions.length && <tr><td colSpan={5}>No transactions in this period.</td></tr>}</tbody></table></div><h3>Net Outstanding: {formatCurrency(ledger.balance_due)}</h3></>}
    </Modal>
  </div>;
};

