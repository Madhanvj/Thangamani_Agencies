import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, BookOpen, Download, RefreshCw, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { customersApi } from '../api';
import type { Customer, LedgerStatement } from '../types';
import { formatCurrency, formatDateOnly } from '../utils/formatters';
import { Modal } from './Modal';
import './VendorLedger.css';

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const errorMessage = (error: unknown) => {
  const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
  return typeof detail === 'string' ? detail : 'Unable to load the statement. Please try again.';
};

export function VendorLedger({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ledger, setLedger] = useState<LedgerStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [revision, setRevision] = useState(0);
  const invalidRange = !!(startDate && endDate && startDate > endDate);
  // Hide a prior period immediately when its filters change, including before the effect runs.
  const [loadedRange, setLoadedRange] = useState('');
  const rangeKey = `${startDate}/${endDate}/${revision}`;
  const ready = !invalidRange && !loading && !error && loadedRange === rangeKey && !!ledger;

  useEffect(() => {
    if (startDate && endDate && startDate > endDate) return;
    let active = true;
    setLoading(true); setError(''); setDownloadError('');
    customersApi.getStatement(customer.id, { start_date: startDate || undefined, end_date: endDate || undefined })
      .then(data => { if (active) { setLedger(data); setLoadedRange(`${startDate}/${endDate}/${revision}`); } })
      .catch(err => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customer.id, startDate, endDate, revision]);

  const preset = (period: 'all' | 'month' | '30days') => {
    if (period === 'all') { setStartDate(''); setEndDate(''); return; }
    const end = new Date();
    const start = new Date(end);
    if (period === 'month') start.setDate(1);
    else start.setDate(start.getDate() - 29);
    setStartDate(localDate(start)); setEndDate(localDate(end));
  };
  const download = async () => {
    if (!ready || downloading) return;
    setDownloading(true); setDownloadError('');
    try { await customersApi.downloadStatement(customer.id, { start_date: startDate || undefined, end_date: endDate || undefined }); }
    catch (err) { setDownloadError(errorMessage(err)); }
    finally { setDownloading(false); }
  };
  const charged = ledger?.transactions.reduce((sum, row) => sum + Math.round(Number(row.debit) * 100), 0) ?? 0;
  const paid = ledger?.transactions.reduce((sum, row) => sum + Math.round(Number(row.credit) * 100), 0) ?? 0;
  const period = !startDate && !endDate ? 'Complete account history' : `${startDate ? formatDateOnly(`${startDate}T00:00:00`) : 'First transaction'} to ${endDate ? formatDateOnly(`${endDate}T00:00:00`) : 'Present'}`;

  return <Modal isOpen onClose={onClose} title="Vendor ledger" size="lg" className="vendor-ledger-modal">
    <div className="vendor-ledger">
      <header className="vl-header"><div className="vl-vendor"><span className="vl-avatar"><Store size={26} /></span><div><h2>{customer.name}</h2><p>{customer.shop_name || 'Vendor account'} <span aria-hidden="true">/</span> <a href={`tel:${customer.phone}`}>{customer.phone}</a></p>{customer.gstin && <p>GSTIN: {customer.gstin}</p>}</div></div><button className="btn btn-primary" disabled={!ready || downloading} onClick={() => void download()}><Download size={18} />{downloading ? 'Downloading...' : 'Download PDF'}</button></header>
      <section className="vl-filters" aria-label="Statement period">
        <div className="vl-filter-title"><div><h3>Statement period</h3><p>Choose the dates to review your account activity.</p></div><div className="vl-presets"><button onClick={() => preset('all')} aria-pressed={!startDate && !endDate}>All time</button><button onClick={() => preset('month')}>This month</button><button onClick={() => preset('30days')}>Last 30 days</button></div></div>
        <div className="vl-date-fields"><label htmlFor="ledger-start">From date<input id="ledger-start" className="form-control" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label><label htmlFor="ledger-end">To date<input id="ledger-end" className="form-control" type="date" min={startDate || undefined} value={endDate} onChange={e => setEndDate(e.target.value)} /></label><button className="btn btn-secondary" disabled={loading || invalidRange} onClick={() => setRevision(value => value + 1)}><RefreshCw size={17} />Refresh</button></div>
      </section>
      {invalidRange && <p className="khata-error" role="alert">From date must be on or before To date.</p>}
      {downloadError && <p className="khata-error" role="alert">{downloadError}</p>}
      {!invalidRange && error && <div className="khata-error" role="alert">{error} <button className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Try again</button></div>}
      {!invalidRange && !error && !ready && <div className="vl-loading" role="status"><BookOpen size={28} /><p>Loading account statement...</p></div>}
      {ready && ledger && <>
        <div className="vl-period"><span>{period}</span><span>{ledger.transactions.length} transaction{ledger.transactions.length === 1 ? '' : 's'}</span></div>
        <dl className="vl-summary"><div><dt>Opening balance</dt><dd>{formatCurrency(ledger.opening_balance)}</dd><small>Before this period</small></div><div><dt><ArrowUpRight size={16} />Charges</dt><dd>{formatCurrency(charged / 100)}</dd><small>Added in this period</small></div><div className="vl-paid"><dt><ArrowDownLeft size={16} />Payments received</dt><dd>{formatCurrency(paid / 100)}</dd><small>Collected in this period</small></div><div className="vl-closing"><dt>Closing balance</dt><dd>{formatCurrency(ledger.balance_due)}</dd><small>At the end of this period</small></div></dl>
        <section className="vl-transactions" aria-label="Ledger transactions"><div className="vl-table-title"><h3>Transaction history</h3><p>Charges increase your balance. Payments reduce it.</p></div><div className="vl-table-scroll"><table><caption className="vl-sr-only">Vendor transactions for {customer.name}: {period}</caption><thead><tr><th scope="col">Date</th><th scope="col">Transaction</th><th scope="col">Charges</th><th scope="col">Payments</th><th scope="col">Balance</th></tr></thead><tbody>{ledger.transactions.map(row => <tr key={`${row.type}-${row.id}`}><td>{formatDateOnly(row.date)}</td><td><span className={`vl-type ${row.type === 'PAYMENT' ? 'vl-type-payment' : ''}`}>{row.type === 'INVOICE' ? 'Invoice' : row.type === 'PAYMENT' ? 'Payment' : 'Opening dues'}</span>{row.type === 'INVOICE' ? <Link className="vl-description" to={`/invoices/${row.id}`}>{row.description}</Link> : <strong className="vl-description">{row.description}</strong>}{row.reference_number && <small className="vl-row-detail">Reference: {row.reference_number}</small>}{row.notes && <small className="vl-row-detail">{row.notes}</small>}</td><td>{Number(row.debit) ? formatCurrency(row.debit) : '-'}</td><td className="vl-paid">{Number(row.credit) ? formatCurrency(row.credit) : '-'}</td><td><strong>{formatCurrency(row.balance)}</strong></td></tr>)}{!ledger.transactions.length && <tr><td colSpan={5}><div className="vl-empty"><BookOpen size={30} /><h3>No transactions in this period</h3><p>Choose another date range or view the complete account history.</p><button className="btn btn-secondary" onClick={() => preset('all')}>View all time</button></div></td></tr>}</tbody><tfoot><tr><th scope="row" colSpan={2}>Closing balance</th><td>{formatCurrency(charged / 100)}</td><td className="vl-paid">{formatCurrency(paid / 100)}</td><td>{formatCurrency(ledger.balance_due)}</td></tr></tfoot></table></div></section>
        <p className="vl-footnote">Opening balance + charges - payments = closing balance. Your PDF uses the selected date range.</p>
      </>}
    </div>
  </Modal>;
}
