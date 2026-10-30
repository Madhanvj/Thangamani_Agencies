import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Billing } from './pages/Billing';
import { InvoicesList } from './pages/InvoicesList';
import { InvoiceView } from './pages/InvoiceView';
import { Products } from './pages/Products';
import { InventoryReportPage } from './pages/InventoryReport';
import { Customers } from './pages/Customers';
import { SettingsPage } from './pages/Settings';
import './styles/global.css';

// Layout with persistent Sidebar and header
const AppLayout: React.FC = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Authenticated routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/invoices" element={<InvoicesList />} />
              <Route path="/invoices/:id" element={<InvoiceView />} />
              <Route path="/products" element={<Products />} />
              <Route path="/customers" element={<Customers />} />

              {/* Role-specific routes */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['admin', 'billing_staff']} />
                }
              >
                <Route path="/billing" element={<Billing />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute allowedRoles={['admin', 'inventory_manager']} />
                }
              >
                <Route path="/inventory-report" element={<InventoryReportPage />} />
              </Route>

              <Route
                element={<ProtectedRoute allowedRoles={['admin']} />}
              >
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
