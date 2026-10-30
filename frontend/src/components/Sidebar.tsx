import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Package,
  BarChart3,
  Users,
  Settings,
  LogOut,
  ShoppingBag,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const role = user?.role;

  const canBill = role === 'admin' || role === 'billing_staff';
  const canManageInventory = role === 'admin' || role === 'inventory_manager';
  const isAdmin = role === 'admin';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <ShoppingBag size={20} />
        </div>
        <div className="sidebar-title">
          <h2>Thangamani Agencies</h2>
          <span>Retail & Appliances</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        {canBill && (
          <NavLink to="/billing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Receipt size={18} />
            <span>Create Invoice</span>
          </NavLink>
        )}

        <NavLink to="/invoices" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FileText size={18} />
          <span>Invoices List</span>
        </NavLink>

        <NavLink to="/products" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Package size={18} />
          <span>Products & Stock</span>
        </NavLink>

        {canManageInventory && (
          <NavLink to="/inventory-report" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <BarChart3 size={18} />
            <span>Inventory Report</span>
          </NavLink>
        )}

        <NavLink to="/customers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Users size={18} />
          <span>Customers</span>
        </NavLink>

        {isAdmin && (
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={18} />
            <span>Company Settings</span>
          </NavLink>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-badge">
          <div className="user-info">
            <span className="user-name">{user?.full_name || user?.username}</span>
            <span className="user-role-tag">{user?.role?.replace('_', ' ')}</span>
          </div>
          <button onClick={logout} className="btn-logout" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
