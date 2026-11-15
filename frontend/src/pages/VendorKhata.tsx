import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Pencil, Plus, RefreshCw, Search, Store, Wallet, TrendingUp } from 'lucide-react';
import './VendorKhata.css';
import { customersApi } from '../api';
import type { Customer, KhataSummary } from '../types';
import { formatCurrency, isValidPhone, isValidGSTIN } from '../utils/formatters';
import { Modal } from '../components/Modal';
import { VendorLedger } from '../components/VendorLedger';
import { Pagination } from '../components/Pagination';

const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [vendor, setVendor] = useState(emptyVendor);
  const [openingBalance, setOpeningBalance] = useState('');
  const [collecting, setCollecting] = useState<Customer | null>(null);
  const [payment, setPayment] = useState({ amount: '', payment_mode: 'Cash', date: today(), reference_number: '', notes: '' });
  const [selected, setSelected] = useState<Customer | null>(null);
  const [notice, setNotice] = useState('');
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true); setError('');
    try {
      const [list, totals] = await Promise.all([
        customersApi.getCustomers({ page, limit: 10, search, customer_type: 'VENDOR' }), customersApi.getKhataSummary(),
      ]);
      if (id !== requestId.current) return;
      setVendors(list.items); setPages(list.pages); setTotal(list.total); setSummary(totals);
    } catch (err) { if (id === requestId.current) setError(message(err)); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [page, search]);
  useEffect(() => { const timer = setTimeout(() => { void reload(); }, 250); return () => { clearTimeout(timer); requestId.current++; }; }, [reload]);
  const saveVendor = async (event: React.FormEvent) => {
    event.preventDefault(); setModalError('');
    const amount = Number(openingBalance || 0);
    if (!editing && (!Number.isFinite(amount) || amount < 0 || amount > 9999999999.99 || (openingBalance && !/^\d+(\.\d{1,2})?$/.test(openingBalance)))) {
      setModalError('Enter a valid opening balance with up to two decimal places, or leave it blank.'); return;
    }
    if (!vendor.name.trim() || !vendor.state.trim() || !isValidPhone(vendor.phone) || (vendor.gstin && !isValidGSTIN(vendor.gstin))) {
      setModalError('Enter a vendor name, state, valid 10-digit phone and GSTIN (if provided).'); return;
    }
    setBusy(true);
    try {
      const details = { ...vendor, name: vendor.name.trim(), shop_name: vendor.shop_name.trim(),
        phone: vendor.phone.trim(), address: vendor.address.trim(), state: vendor.state.trim(), gstin: vendor.gstin.trim().toUpperCase() };
      if (editing) await customersApi.updateCustomer(editing.id, details);
      else await customersApi.createCustomer({ ...details, opening_balance: openingBalance || '0', customer_type: 'VENDOR' });
      setAdding(false); setNotice(editing ? 'Vendor updated successfully.' : 'Vendor added successfully.');
      setEditing(null); await reload();
    }
    catch (err) { setModalError(message(err)); } finally { setBusy(false); }
  };
  const collect = async (event: React.FormEvent) => {
    event.preventDefault(); if (!collecting) return;
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(collecting.balance_due) || !payment.date || payment.date > today()) {
      setModalError('Enter an amount within the outstanding balance and a date up to today.'); return;
    }
    setBusy(true); setModalError('');
    try {
      await customersApi.collectPayment(collecting.id, {
        amount: Number(payment.amount), payment_mode: payment.payment_mode,
        payment_date: new Date(`${payment.date}T${payment.date === today() ? new Date().toTimeString().slice(0, 8) : '23:59:59'}`).toISOString(),
        reference_number: payment.reference_number, notes: payment.notes,
      });
      setCollecting(null); setNotice(`Payment of ${formatCurrency(payment.amount)} recorded for ${collecting.name}.`); await reload();
    } catch (err) { setModalError(message(err)); } finally { setBusy(false); }
  };
  return <div className="page-container vendor-khata">
    <header className="khata-heading"><div><h1>Vendor Khata</h1><p>Balances and collections</p></div><div className="khata-actions"><button className="btn btn-secondary" disabled={loading} onClick={() => void reload()}><RefreshCw size={16} />Refresh</button><button className="btn btn-primary" onClick={() => { setEditing(null); setVendor(emptyVendor); setOpeningBalance(''); setModalError(''); setAdding(true); }}><Plus size={18} />Add Vendor</button></div></header>
    <div className="khata-kpis">
      <div className="card khata-metric"><Store size={24} /><p>Total vendors</p><h2>{summary?.total_vendors ?? '-'}</h2></div>
      <div className="card khata-metric khata-metric-due"><Wallet size={24} /><p>Total outstanding</p><h2>{summary ? formatCurrency(summary.total_receivables) : '-'}</h2></div>
      <div className="card khata-metric khata-metric-paid"><TrendingUp size={24} /><p>Collected this month</p><h2>{summary ? formatCurrency(summary.collected_this_month) : '-'}</h2></div>
    </div>
    {notice && <div className="khata-notice" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}>x</button></div>}
    {error && <p role="alert" className="khata-error">{error} <button className="btn btn-secondary btn-sm" onClick={() => void reload()}>Try again</button></p>}
    <div className="card khata-directory" aria-busy={loading}>
      <div className="khata-toolbar"><div><h2>Vendor accounts <span className="khata-count">{total}</span></h2></div><div className="khata-search"><Search size={18} /><input id="vendor-search" aria-label="Search vendors" className="form-control" placeholder="Name, shop, phone or GSTIN" value={search} onChange={e => { requestId.current++; setLoading(true); setSearch(e.target.value); setPage(1); }} />{search && <button aria-label="Clear search" onClick={() => { setSearch(''); setPage(1); }}>x</button>}</div></div>
      {loading ? <div className="khata-empty" role="status">Loading vendor accounts...</div> : error ? <div className="khata-empty">Could not load vendor accounts. Please try again.</div> : vendors.length === 0 ? <div className="khata-empty"><Store size={32} /><h3>{search ? 'No matching vendors' : 'Your vendor book starts here'}</h3><p>{search ? 'Try another name, shop or phone number.' : 'Add your first vendor to start tracking their account.'}</p></div> : <div className="khata-account-grid">{vendors.map(v => <article className="khata-account" key={v.id} aria-label={`Account for ${v.name}`}>
        <div className="khata-account-heading"><span className="khata-avatar" aria-hidden="true">{v.name.trim().slice(0, 2).toUpperCase()}</span><div><h3>{v.name}</h3><p>{v.shop_name || 'Vendor account'}</p></div><div className="khata-card-tools"><span className={`khata-account-status ${Number(v.balance_due) > 0 ? 'is-pending' : 'is-settled'}`}>{Number(v.balance_due) > 0 ? 'Payment due' : 'Settled'}</span><button type="button" className="khata-edit" aria-label={`Edit vendor ${v.name}`} title="Edit vendor" onClick={() => { setEditing(v); setVendor({ name: v.name, shop_name: v.shop_name || '', phone: v.phone, gstin: v.gstin || '', address: v.address || '', state: v.state }); setOpeningBalance(String(v.opening_balance ?? 0)); setModalError(''); setAdding(true); }}><Pencil size={14} /></button></div></div>
        <div className="khata-account-contact"><a href={`tel:${v.phone}`}>{v.phone}</a>{v.gstin && <span>GSTIN: {v.gstin}</span>}</div>
        <div className={`khata-account-balance ${Number(v.balance_due) > 0 ? '' : 'is-settled'}`}><span>Outstanding</span><strong>{formatCurrency(v.balance_due ?? 0)}</strong>{Number(v.opening_balance) > 0 && <small>Opening balance: {formatCurrency(v.opening_balance ?? 0)}</small>}</div>
        <dl className="khata-account-totals"><div><dt>Charges</dt><dd>{formatCurrency(v.total_billed ?? 0)}</dd></div><div><dt>Paid</dt><dd className="khata-paid">{formatCurrency(v.total_paid ?? 0)}</dd></div></dl>
        <div className="khata-account-actions"><button className="btn btn-primary" disabled={Number(v.balance_due ?? 0) <= 0} onClick={() => { setCollecting(v); setModalError(''); setPayment({ amount: '', payment_mode: 'Cash', date: today(), reference_number: '', notes: '' }); }}><Wallet size={14} />Collect payment</button><button className="btn btn-secondary" onClick={() => { setSelected(v); }}><BookOpen size={14} />View ledger</button></div>
      </article>)}</div>}
      <div className="khata-pagination"><Pagination currentPage={page} totalPages={pages} totalItems={total} onPageChange={setPage} /></div>
    </div>
    <Modal isOpen={adding} onClose={() => { if (!busy) setAdding(false); }} title={editing ? 'Edit Vendor' : 'Add Vendor'}>
      <form className="khata-form" onSubmit={saveVendor}>{Object.entries(vendor).map(([key, value]) => <div className="form-group" key={key}><label className="form-label" htmlFor={`vendor-${key}`}>{{ name: 'Vendor name', shop_name: 'Shop name', phone: 'Phone number', gstin: 'GSTIN (optional)', address: 'Address', state: 'State' }[key]}</label><input id={`vendor-${key}`} className="form-control" value={value} maxLength={key === 'phone' ? 10 : key === 'gstin' ? 15 : undefined} inputMode={key === 'phone' ? 'tel' : undefined} required={['name', 'phone', 'state'].includes(key)} onChange={e => setVendor({ ...vendor, [key]: key === 'gstin' ? e.target.value.toUpperCase() : e.target.value })} /></div>)}
{!editing && <div className="form-group"><label className="form-label" htmlFor="vendor-opening-balance">Opening balance (optional)</label><input id="vendor-opening-balance" className="form-control" type="number" inputMode="decimal" min="0" max="9999999999.99" step="0.01" placeholder="0.00" aria-describedby="vendor-opening-help" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} /><p id="vendor-opening-help" className="khata-payment-hint">Amount this vendor already owes you. Leave blank for a new account with no existing dues.</p></div>}
        {editing && <p className="khata-payment-hint">Opening balance: {formatCurrency(editing.opening_balance ?? 0)}. Editing vendor details preserves balances and payment history.</p>}
        {modalError && <p role="alert" className="khata-error">{modalError}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Save Vendor'}</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setAdding(false)}>Cancel</button></form>
    </Modal>
    <Modal isOpen={!!collecting} onClose={() => { if (!busy) setCollecting(null); }} title={`Collect Payment - ${collecting?.name ?? ''}`}>
      <form className="khata-form" onSubmit={collect}><div className="khata-payment-summary"><span>Outstanding balance</span><strong>{formatCurrency(collecting?.balance_due ?? 0)}</strong><button type="button" onClick={() => setPayment({ ...payment, amount: String(collecting?.balance_due ?? 0) })}>Use full balance</button></div>
        <label className="form-label" htmlFor="pay-amount">Amount</label><input id="pay-amount" className="form-control" type="number" min="0.01" step="0.01" max={Number(collecting?.balance_due)} required value={payment.amount} onChange={e => setPayment({ ...payment, amount: e.target.value })} />
        <p className="khata-payment-hint">Remaining after payment: {formatCurrency(Math.max(0, Number(collecting?.balance_due ?? 0) - (Number(payment.amount) || 0)))}</p><label className="form-label" htmlFor="pay-mode">Payment Method</label><select id="pay-mode" className="form-control" value={payment.payment_mode} onChange={e => setPayment({ ...payment, payment_mode: e.target.value })}>{['Cash', 'UPI', 'Card', 'Bank Transfer'].map(mode => <option key={mode} value={mode}>{mode === 'Bank Transfer' ? 'Bank Transfer / NEFT' : mode}</option>)}</select>
        <label className="form-label" htmlFor="pay-date">Date</label><input id="pay-date" className="form-control" type="date" required max={today()} value={payment.date} onChange={e => setPayment({ ...payment, date: e.target.value })} />
        <label className="form-label" htmlFor="pay-ref">Reference Number</label><input id="pay-ref" className="form-control" maxLength={100} value={payment.reference_number} onChange={e => setPayment({ ...payment, reference_number: e.target.value })} />
        <label className="form-label" htmlFor="pay-notes">Notes</label><textarea id="pay-notes" className="form-control" value={payment.notes} onChange={e => setPayment({ ...payment, notes: e.target.value })} />
        {modalError && <p role="alert" className="khata-error">{modalError}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? 'Recording...' : 'Record Payment'}</button>
      </form>
    </Modal>
    {selected && <VendorLedger key={selected.id} customer={selected} onClose={() => setSelected(null)} />}
  </div>;
};

