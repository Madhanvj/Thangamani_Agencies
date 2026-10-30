import React, { useEffect, useState } from 'react';
import { settingsApi } from '../api';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [terms, setTerms] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await settingsApi.getCompanySettings();
        setCompanyName(data.company_name);
        setGstin(data.gstin);
        setPhone(data.phone);
        setEmail(data.email);
        setAddress(data.address);
        setState(data.state || 'Tamil Nadu');
        setTerms(data.terms_and_conditions || '');
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setSaving(true);

    try {
      await settingsApi.updateCompanySettings({
        company_name: companyName.trim(),
        gstin: gstin.trim().toUpperCase(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        state: state.trim(),
        terms_and_conditions: terms.trim(),
      });
      setSuccessMsg('Company settings updated successfully! All future invoices will reflect these details.');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to update company settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <p>Loading company configuration...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          Company & Tax Settings
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Configure enterprise branding, GSTIN, default jurisdiction state, and invoice print terms
        </p>
      </div>

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#d1fae5',
            color: '#065f46',
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '0.9rem',
          }}
        >
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '0.9rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Company / Trade Name *</label>
            <input
              type="text"
              className="form-control"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={!isAdmin}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-col form-group">
              <label className="form-label">Company GSTIN *</label>
              <input
                type="text"
                className="form-control"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                disabled={!isAdmin}
                required
              />
            </div>
            <div className="form-col form-group">
              <label className="form-label">Home State (GST Origin) *</label>
              <select
                className="form-control"
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={!isAdmin}
              >
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Kerala">Kerala</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
                <option value="Maharashtra">Maharashtra</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-col form-group">
              <label className="form-label">Official Phone *</label>
              <input
                type="text"
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!isAdmin}
                required
              />
            </div>
            <div className="form-col form-group">
              <label className="form-label">Official Email *</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isAdmin}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Full Store Address *</label>
            <input
              type="text"
              className="form-control"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!isAdmin}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Terms & Conditions (Printed on Invoice bottom)</label>
            <textarea
              className="form-control"
              rows={4}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              disabled={!isAdmin}
            />
          </div>

          {isAdmin ? (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ marginTop: '12px' }}
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Update Settings'}
            </button>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '10px' }}>
              Only Admin users can modify company settings.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
