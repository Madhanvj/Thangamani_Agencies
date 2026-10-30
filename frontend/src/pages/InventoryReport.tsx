import React, { useEffect, useState } from 'react';
import { inventoryApi } from '../api';
import type { InventoryReport } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  Printer,
  PackageCheck,
  Coins,
  AlertTriangle,
  Layers,
} from 'lucide-react';

export const InventoryReportPage: React.FC = () => {
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await inventoryApi.getReport();
        setReport(data);
      } catch (err) {
        console.error('Failed to load inventory report', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="page-container">
        <p>Calculating inventory stock valuation...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div
        className="no-print"
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
            Inventory Valuation & Stock Report
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Comprehensive analysis of appliance stock levels, holding value, and turnover counts
          </p>
        </div>

        <button onClick={handlePrint} className="btn btn-secondary">
          <Printer size={16} /> Print Report
        </button>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              TOTAL CATALOG PRODUCTS
            </span>
            <div style={{ color: 'var(--primary)' }}>
              <Layers size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px' }}>
            {report?.total_products || 0}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              TOTAL STOCK QUANTITY
            </span>
            <div style={{ color: '#059669' }}>
              <PackageCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px' }}>
            {report?.total_stock_units || 0} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>units</span>
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              TOTAL STOCK VALUE (₹)
            </span>
            <div style={{ color: 'var(--primary)' }}>
              <Coins size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: 'var(--primary)' }}>
            {formatCurrency(report?.total_stock_value)}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              LOW-STOCK ITEMS
            </span>
            <div style={{ color: '#dc2626' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#b91c1c' }}>
            {report?.low_stock_count || 0}
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Per-Product Valuation Breakdown</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Valued at selling unit price excluding GST
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Description</th>
                <th>SKU</th>
                <th>Category</th>
                <th className="text-right">Unit Rate (₹)</th>
                <th className="text-center">Current Stock</th>
                <th className="text-right">Total Stock Value (₹)</th>
                <th className="text-center">Movements Logged</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {report?.items.map((item) => (
                <tr key={item.product_id} className={item.is_low_stock ? 'row-alert' : ''}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.brand}</div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{item.sku}</td>
                  <td>{item.category_name}</td>
                  <td className="text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="text-center" style={{ fontWeight: 700 }}>
                    {item.current_stock}
                  </td>
                  <td className="text-right" style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {formatCurrency(item.stock_value)}
                  </td>
                  <td className="text-center" style={{ fontSize: '0.8rem' }}>
                    {item.recent_movements_count}
                  </td>
                  <td className="text-center">
                    <span
                      className={`badge ${item.is_low_stock ? 'badge-low-stock' : 'badge-paid'}`}
                      style={{ fontWeight: 700 }}
                    >
                      {item.is_low_stock ? 'LOW STOCK' : 'IN STOCK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
