import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productsApi, inventoryApi } from '../api';
import type { Product, Category, StockMovement, MovementType } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Plus,
  ArrowUpDown,
  History,
  Edit2,
  Trash2,
  Package,
} from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';

export const Products: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(
    searchParams.get('low_stock') === 'true'
  );
  const [loading, setLoading] = useState(true);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<MovementType>('IN');
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustRef, setAdjustRef] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Product Form State
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCatId, setProdCatId] = useState<number>(1);
  const [prodBrand, setProdBrand] = useState('');
  const [prodModel, setProdModel] = useState('');
  const [prodHsn, setProdHsn] = useState('');
  const [prodPrice, setProdPrice] = useState<number>(0);
  const [prodGst, setProdGst] = useState<number>(18);
  const [prodPriceIncludesGst, setProdPriceIncludesGst] = useState<boolean>(true);
  const [prodStock, setProdStock] = useState<number>(0);
  const [prodReorder, setProdReorder] = useState<number>(5);
  const [prodSubmitting, setProdSubmitting] = useState(false);
  const [prodError, setProdError] = useState('');

  const canManage = user?.role === 'admin' || user?.role === 'inventory_manager';

  const fetchCategories = async () => {
    try {
      const data = await productsApi.getCategories();
      setCategories(data);
      if (data.length > 0 && !prodCatId) {
        setProdCatId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await productsApi.getProducts({
        page,
        limit,
        search: search.trim() || undefined,
        category_id: selectedCategory ? parseInt(selectedCategory) : undefined,
        is_low_stock: onlyLowStock ? true : undefined,
      });
      setProducts(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [page, selectedCategory, onlyLowStock]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdSku('');
    setProdCatId(categories[0]?.id || 1);
    setProdBrand('');
    setProdModel('');
    setProdHsn('');
    setProdPrice(0);
    setProdGst(18);
    setProdPriceIncludesGst(true);
    setProdStock(0);
    setProdReorder(5);
    setProdError('');
    setShowProductModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdSku(p.sku);
    setProdCatId(p.category_id);
    setProdBrand(p.brand);
    setProdModel(p.model);
    setProdHsn(p.hsn_code);
    setProdPrice(parseFloat(String(p.unit_price)));
    setProdGst(parseFloat(String(p.gst_rate)));
    setProdPriceIncludesGst(p.price_includes_gst !== false);
    setProdStock(p.current_stock);
    setProdReorder(p.reorder_level);
    setProdError('');
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdError('');
    setProdSubmitting(true);

    try {
      if (editingProduct) {
        await productsApi.updateProduct(editingProduct.id, {
          name: prodName.trim(),
          sku: prodSku.trim().toUpperCase(),
          category_id: prodCatId,
          brand: prodBrand.trim(),
          model: prodModel.trim(),
          hsn_code: prodHsn.trim(),
          unit_price: prodPrice,
          gst_rate: prodGst,
          price_includes_gst: prodPriceIncludesGst,
          reorder_level: prodReorder,
        });
      } else {
        await productsApi.createProduct({
          name: prodName.trim(),
          sku: prodSku.trim().toUpperCase(),
          category_id: prodCatId,
          brand: prodBrand.trim(),
          model: prodModel.trim(),
          hsn_code: prodHsn.trim(),
          unit_price: prodPrice,
          gst_rate: prodGst,
          price_includes_gst: prodPriceIncludesGst,
          current_stock: prodStock,
          reorder_level: prodReorder,
          is_active: true,
        });
      }
      setShowProductModal(false);
      await fetchProducts();
    } catch (err: any) {
      setProdError(err.response?.data?.detail || 'Failed to save product');
    } finally {
      setProdSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!window.confirm(`Deactivate product '${name}'?`)) return;
    try {
      await productsApi.deleteProduct(id);
      await fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to deactivate product');
    }
  };

  const openAdjustStockModal = (p: Product) => {
    setAdjustProduct(p);
    setAdjustType('IN');
    setAdjustQty(1);
    setAdjustRef('');
    setShowAdjustModal(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct) return;
    setAdjustLoading(true);

    try {
      await inventoryApi.adjustStock({
        product_id: adjustProduct.id,
        type: adjustType,
        quantity: adjustQty,
        reference: adjustRef.trim() || undefined,
      });
      setShowAdjustModal(false);
      await fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to adjust stock');
    } finally {
      setAdjustLoading(false);
    }
  };

  const openHistoryModal = async (p: Product) => {
    setHistoryProduct(p);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const data = await inventoryApi.getMovements(p.id);
      setMovements(data);
    } catch (err) {
      console.error('Failed to load history', err);
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
            Appliance Inventory
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Manage appliances catalog, live stock, pricing, and HSN codes
          </p>
        </div>

        {canManage && (
          <button onClick={openAddModal} className="btn btn-primary">
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            gap: '14px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
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
              placeholder="Search by name, brand, model, SKU, or HSN code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="form-control"
            style={{ width: '180px' }}
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: onlyLowStock ? '#dc2626' : 'var(--text-main)',
            }}
          >
            <input
              type="checkbox"
              checked={onlyLowStock}
              onChange={(e) => {
                setOnlyLowStock(e.target.checked);
                setPage(1);
              }}
            />
            <span>Low Stock Only</span>
          </label>

          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
      </div>

      {/* Products Table */}
      <div className="card">
        {loading ? (
          <p style={{ padding: '20px' }}>Loading appliances catalog...</p>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <Package size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontWeight: 600 }}>No products matched your criteria</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product & Model</th>
                  <th>SKU / HSN</th>
                  <th>Category</th>
                  <th className="text-right">MRP / Rate (₹)</th>
                  <th className="text-center">GST %</th>
                  <th className="text-center">Stock / Reorder</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isLow = p.current_stock <= p.reorder_level;
                  const isInclusive = p.price_includes_gst !== false;
                  return (
                    <tr key={p.id} className={isLow ? 'row-alert' : ''}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Brand: <strong>{p.brand}</strong> • Model: {p.model}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.82rem' }}>
                          {p.sku}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          HSN: {p.hsn_code}
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
                          {p.category?.name || 'Category'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {formatCurrency(p.unit_price)}
                        </div>
                        <div style={{ marginTop: '2px' }}>
                          {isInclusive ? (
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#ecfdf5',
                                color: '#065f46',
                                fontWeight: 600,
                              }}
                            >
                              Price incl. GST
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#eff6ff',
                                color: '#1e40af',
                                fontWeight: 600,
                              }}
                            >
                              Price excl. GST
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{p.gst_rate}%</span>
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge ${isLow ? 'badge-low-stock' : 'badge-paid'}`}
                          style={{ fontWeight: 700 }}
                        >
                          {p.current_stock} in stock
                        </span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Threshold: {p.reorder_level}
                        </div>
                      </td>
                      <td className="text-right">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {canManage && (
                            <button
                              onClick={() => openAdjustStockModal(p)}
                              className="btn btn-secondary btn-sm"
                              title="Adjust Stock (IN / OUT)"
                            >
                              <ArrowUpDown size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => openHistoryModal(p)}
                            className="btn btn-secondary btn-sm"
                            title="Movement History"
                          >
                            <History size={14} />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => openEditModal(p)}
                                className="btn btn-secondary btn-sm"
                                title="Edit Product"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                className="btn btn-secondary btn-sm"
                                style={{ color: '#ef4444' }}
                                title="Deactivate"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        title={editingProduct ? 'Edit Appliance Details' : 'Add New Appliance to Catalog'}
        size="lg"
      >
        <form onSubmit={handleSaveProduct}>
          {prodError && (
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
              {prodError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Sony Bravia 55-inch 4K Ultra HD Smart LED TV"
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-col form-group">
              <label className="form-label">SKU (Unique Code) *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. TV-SONY-55X74L"
                value={prodSku}
                onChange={(e) => setProdSku(e.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="form-col form-group">
              <label className="form-label">Category *</label>
              <select
                className="form-control"
                value={prodCatId}
                onChange={(e) => setProdCatId(parseInt(e.target.value))}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-col form-group">
              <label className="form-label">Brand *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Sony, LG, Samsung, Preethi"
                value={prodBrand}
                onChange={(e) => setProdBrand(e.target.value)}
                required
              />
            </div>
            <div className="form-col form-group">
              <label className="form-label">Model Number *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. KD-55X74L"
                value={prodModel}
                onChange={(e) => setProdModel(e.target.value)}
                required
              />
            </div>
            <div className="form-col form-group">
              <label className="form-label">HSN Code *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 8528"
                value={prodHsn}
                onChange={(e) => setProdHsn(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-col form-group">
              <label className="form-label">
                {prodPriceIncludesGst ? 'Final MRP / Price (₹ incl. GST) *' : 'Base Price (₹ excl. GST) *'}
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="form-control"
                value={prodPrice}
                onChange={(e) => setProdPrice(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div className="form-col form-group">
              <label className="form-label">GST Rate % *</label>
              <select
                className="form-control"
                value={prodGst}
                onChange={(e) => setProdGst(parseFloat(e.target.value))}
              >
                <option value={0}>0%</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
            </div>
            {!editingProduct && (
              <div className="form-col form-group">
                <label className="form-label">Initial Stock *</label>
                <input
                  type="number"
                  min={0}
                  className="form-control"
                  value={prodStock}
                  onChange={(e) => setProdStock(parseInt(e.target.value) || 0)}
                  required
                />
              </div>
            )}
            <div className="form-col form-group">
              <label className="form-label">Reorder Level (Threshold) *</label>
              <input
                type="number"
                min={0}
                className="form-control"
                value={prodReorder}
                onChange={(e) => setProdReorder(parseInt(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          {/* Price Includes GST Checkbox */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: 'var(--text-main)',
                backgroundColor: '#f8fafc',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            >
              <input
                type="checkbox"
                checked={prodPriceIncludesGst}
                onChange={(e) => setProdPriceIncludesGst(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
              />
              <span>Price includes GST (Entered price is the final MRP)</span>
            </label>
          </div>

          {/* Live GST Calculation Preview */}
          {(() => {
            const price = Number(prodPrice) || 0;
            const rate = Number(prodGst) || 0;
            let taxable = 0;
            let totalGst = 0;
            let cgst = 0;
            let sgst = 0;
            let finalPrice = 0;

            if (prodPriceIncludesGst) {
              taxable = Math.round((price / (1 + rate / 100)) * 100) / 100;
              totalGst = Math.round((price - taxable) * 100) / 100;
              cgst = Math.round((totalGst / 2) * 100) / 100;
              sgst = Math.round((totalGst - cgst) * 100) / 100;
              finalPrice = price;
            } else {
              taxable = price;
              totalGst = Math.round((taxable * (rate / 100)) * 100) / 100;
              cgst = Math.round((totalGst / 2) * 100) / 100;
              sgst = Math.round((totalGst - cgst) * 100) / 100;
              finalPrice = Math.round((taxable + totalGst) * 100) / 100;
            }

            return (
              <div
                style={{
                  backgroundColor: prodPriceIncludesGst ? '#f0fdf4' : '#eff6ff',
                  border: `1px solid ${prodPriceIncludesGst ? '#bbf7d0' : '#bfdbfe'}`,
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: prodPriceIncludesGst ? '#166534' : '#1e40af',
                    }}
                  >
                    Live Tax Preview ({prodPriceIncludesGst ? 'GST-Inclusive MRP' : 'GST-Exclusive'})
                  </span>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    GST Rate: {rate}%
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '10px',
                    fontSize: '0.84rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>
                      Taxable Value
                    </span>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      {formatCurrency(taxable)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>
                      Total GST
                    </span>
                    <strong style={{ color: '#059669', fontSize: '0.95rem' }}>
                      {formatCurrency(totalGst)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>
                      CGST + SGST (50/50)
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {formatCurrency(cgst)} + {formatCurrency(sgst)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>
                      Customer Final Price
                    </span>
                    <strong style={{ color: '#2563eb', fontSize: '1rem' }}>
                      {formatCurrency(finalPrice)}
                    </strong>
                  </div>
                </div>

                <div style={{ marginTop: '8px', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                  {prodPriceIncludesGst
                    ? '✓ Entered price is the final MRP already inclusive of GST. Taxable value and GST are back-calculated.'
                    : 'ℹ Entered price is exclusive of GST. Tax will be added on top during billing.'}
                </div>
              </div>
            );
          })()}

          <div className="modal-footer" style={{ margin: '20px -24px -24px -24px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowProductModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={prodSubmitting}
            >
              {prodSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title={`Adjust Stock: ${adjustProduct?.name}`}
      >
        <form onSubmit={handleAdjustSubmit}>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
            <div>Current Stock: <strong>{adjustProduct?.current_stock} units</strong></div>
            <div>SKU: <strong>{adjustProduct?.sku}</strong></div>
          </div>

          <div className="form-group">
            <label className="form-label">Adjustment Type *</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="adjType"
                  value="IN"
                  checked={adjustType === 'IN'}
                  onChange={() => setAdjustType('IN')}
                />
                <span style={{ fontWeight: 600, color: '#059669' }}>Stock IN (Restock / Purchase)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="adjType"
                  value="OUT"
                  checked={adjustType === 'OUT'}
                  onChange={() => setAdjustType('OUT')}
                />
                <span style={{ fontWeight: 600, color: '#dc2626' }}>Stock OUT (Damage / Manual Adj)</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Quantity to Adjust *</label>
            <input
              type="number"
              min={1}
              max={adjustType === 'OUT' ? adjustProduct?.current_stock : 10000}
              className="form-control"
              value={adjustQty}
              onChange={(e) => setAdjustQty(parseInt(e.target.value) || 1)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reference Note / Reason</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. PO-8821 LG Batch Delivery or Transit Damage"
              value={adjustRef}
              onChange={(e) => setAdjustRef(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ margin: '20px -24px -24px -24px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAdjustModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn ${adjustType === 'IN' ? 'btn-success' : 'btn-danger'}`}
              disabled={adjustLoading || adjustQty <= 0}
            >
              {adjustLoading ? 'Updating...' : `Confirm Stock ${adjustType}`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Movement History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={`Stock Movement History: ${historyProduct?.name}`}
        size="lg"
      >
        <div>
          {historyLoading ? (
            <p>Loading movements...</p>
          ) : movements.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No movements recorded for this product yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th className="text-center">Quantity</th>
                    <th>Reference / Note</th>
                    <th>Logged By</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatDate(m.date)}
                      </td>
                      <td>
                        <span
                          className={`badge ${m.type === 'IN' ? 'badge-paid' : 'badge-unpaid'}`}
                          style={{ fontWeight: 700 }}
                        >
                          STOCK {m.type}
                        </span>
                      </td>
                      <td className="text-center" style={{ fontWeight: 700 }}>
                        {m.type === 'IN' ? `+${m.quantity}` : `-${m.quantity}`}
                      </td>
                      <td>{m.reference || '-'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {m.created_by_name || 'System / Admin'}
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
