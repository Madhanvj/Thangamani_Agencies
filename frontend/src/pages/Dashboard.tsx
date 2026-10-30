import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api';
import type { DashboardMetrics } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  IndianRupee,
  FileCheck,
  Clock,
  AlertTriangle,
  TrendingUp,
  Receipt,
  Package,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await dashboardApi.getMetrics();
        setMetrics(data);
      } catch (err) {
        console.error('Failed to load metrics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <p>Loading dashboard analytics...</p>
      </div>
    );
  }

  const chartData = metrics?.sales_trend_30_days.map((item) => ({
    name: item.date,
    Sales: parseFloat(String(item.sales)),
    Invoices: item.invoices,
  })) || [];

  return (
    <div className="page-container">
      {/* Welcome & Quick Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Store Overview
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Real-time sales, tax billing, and appliance inventory metrics
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/billing" className="btn btn-primary">
            <Receipt size={16} /> Create Invoice
          </Link>
          <Link to="/products" className="btn btn-secondary">
            <Package size={16} /> Manage Inventory
          </Link>
        </div>
      </div>

      {/* Low Stock Warning Banner if any */}
      {metrics && metrics.low_stock_items_count > 0 && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#ef4444' }}>
              <AlertTriangle size={22} />
            </span>
            <div>
              <strong style={{ color: '#991b1b', fontSize: '0.9rem' }}>
                Attention: {metrics.low_stock_items_count} appliance(s) at or below reorder level!
              </strong>
              <p style={{ fontSize: '0.8rem', color: '#b91c1c', margin: 0 }}>
                Restock these items to prevent stockout during active billing.
              </p>
            </div>
          </div>
          <Link
            to="/products?low_stock=true"
            className="btn btn-secondary btn-sm"
            style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
          >
            Review Low Stock <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              TODAY'S REVENUE
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IndianRupee size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-main)' }}>
            {formatCurrency(metrics?.today_sales)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            From <strong>{metrics?.today_invoices_count || 0}</strong> invoices today
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              THIS MONTH'S SALES
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--success-light)',
                color: 'var(--success-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-main)' }}>
            {formatCurrency(metrics?.this_month_sales)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Cumulative revenue this calendar month
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              TOTAL INVOICES
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--info-light)',
                color: 'var(--info-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-main)' }}>
            {metrics?.total_invoices_count || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Processed tax invoices
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              PENDING PAYMENTS
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--warning-light)',
                color: 'var(--warning-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '8px', color: '#b45309' }}>
            {formatCurrency(metrics?.pending_payments_amount)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Unpaid or partial balances due
          </div>
        </div>
      </div>

      {/* Chart & Top Products Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '24px',
        }}
      >
        {/* 30-Day Sales Trend Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">30-Day Sales Trend</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Daily Gross Revenue</span>
          </div>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(val: any) => [`₹${parseFloat(val).toLocaleString('en-IN')}`, 'Sales']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                  }}
                />
                <Area type="monotone" dataKey="Sales" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Appliances */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#eab308" />
              <h3 className="card-title">Top Selling Appliances</h3>
            </div>
            <Link to="/invoices" style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none' }}>
              View all sales
            </Link>
          </div>

          {metrics?.top_selling_products && metrics.top_selling_products.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-center">Units Sold</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.top_selling_products.map((item) => (
                    <tr key={item.product_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {item.brand} • {item.sku}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="badge badge-paid" style={{ fontWeight: 700 }}>
                          {item.units_sold}
                        </span>
                      </td>
                      <td className="text-right" style={{ fontWeight: 700 }}>
                        {formatCurrency(item.total_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <p>No sales recorded yet. Invoices will automatically generate top-seller statistics!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
