import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, ChevronLeft, ChevronRight, Edit3, Eye, Plus, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import apiClient from '../../services/api';

const emptyForm = {
  supplierCode: '',
  supplierName: '',
  legalName: '',
  vendorType: 'Other',
  registrationNumber: '',
  taxIdentificationNumber: '',
  contactPerson: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  city: '',
  country: '',
  status: 'active',
};

const statusColor = {
  active: { bg: '#dcfce7', text: '#166534' },
  inactive: { bg: '#e2e8f0', text: '#334155' },
  suspended: { bg: '#fef3c7', text: '#92400e' },
};

const toReadable = (value) => value ? String(value).replace(/([A-Z])/g, ' $1').trim() : 'Other';

const formatListValue = (value) => value ? String(value) : '—';

export default function MaintVendors() {
  const [vendors, setVendors] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, suspended: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [vendorType, setVendorType] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadVendors = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/maintenance/vendors', {
        params: { search, status, vendorType, page, limit: 20 },
      });
      setVendors(response.data.data || []);
      setSummary(response.data.summary || { total: 0, active: 0, inactive: 0, suspended: 0 });
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Unable to load vendors.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVendors(); }, [search, status, vendorType, page]);

  const vendorTypeOptions = useMemo(() => {
    const seen = new Set();
    return ['Spare Parts Supplier', 'Equipment Supplier', 'Maintenance Service Provider', 'Contractor', 'Technical Consultant', 'Other']
      .filter((option) => {
        if (seen.has(option)) return false;
        seen.add(option);
        return true;
      });
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setModal('create');
    setError('');
  };

  const openEdit = async (vendor) => {
    try {
      const response = await apiClient.get(`/api/maintenance/vendors/${vendor.id}`);
      setForm({ ...emptyForm, ...(response.data.data?.vendor || vendor) });
      setModal('edit');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load vendor details.');
    }
  };

  const saveVendor = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        supplierCode: form.supplierCode || `VND-${Date.now().toString().slice(-6)}`,
      };

      const response = modal === 'create'
        ? await apiClient.post('/api/maintenance/vendors', payload)
        : await apiClient.put(`/api/maintenance/vendors/${form.id}`, payload);
      setNotice(response.data.message || 'Vendor saved successfully.');
      setModal(null);
      await loadVendors();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save vendor.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (vendor) => {
    const nextStatus = vendor.status === 'active' ? 'inactive' : 'active';
    try {
      const response = await apiClient.patch(`/api/maintenance/vendors/${vendor.id}/status`, { status: nextStatus });
      setNotice(response.data.message || 'Vendor status updated.');
      await loadVendors();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update vendor status.');
    }
  };

  return (
    <main style={{ padding: 24, background: '#f5f7fb', minHeight: '100%' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#0f766e', fontWeight: 700, fontSize: 12 }}>Resources</p>
          <h1 style={{ margin: '8px 0 8px', fontSize: '2.2rem' }}>Vendors</h1>
          <p style={{ margin: 0, color: '#475569', maxWidth: 760 }}>Manage maintenance suppliers, service providers, supplied parts, contracts, and vendor activity.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={openCreate} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={16} /> Add Vendor
          </button>
          <button type="button" onClick={loadVendors} style={{ background: '#fff', color: '#0f172a', border: '1px solid #dbe4ee', borderRadius: 10, padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      {notice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#dcfce7', color: '#166534', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }} role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }} role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 }}>
        {[
          ['Total Vendors', summary.total],
          ['Active Vendors', summary.active],
          ['Inactive', summary.inactive],
          ['Suspended', summary.suspended],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #dfeaf4', borderRadius: 12, padding: 18 }}>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfeaf4', borderRadius: 12, padding: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search vendors..." aria-label="Search vendors" style={{ width: '100%', border: '1px solid #dbe4ee', borderRadius: 10, padding: '10px 12px 10px 36px' }} />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ border: '1px solid #dbe4ee', borderRadius: 10, padding: '10px 12px', minWidth: 150 }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          <select value={vendorType} onChange={(e) => { setVendorType(e.target.value); setPage(1); }} style={{ border: '1px solid #dbe4ee', borderRadius: 10, padding: '10px 12px', minWidth: 190 }}>
            <option value="">All vendor types</option>
            {vendorTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfeaf4', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Building2 size={18} /><strong>{pagination.total}</strong><span style={{ color: '#64748b' }}>records</span></div>
          <button type="button" onClick={loadVendors} style={{ background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}><RefreshCw size={15} /></button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40, color: '#475569' }}>
            <RefreshCw size={18} className="spin" />
            Loading vendors...
          </div>
        ) : vendors.length === 0 ? (
          <div style={{ display: 'grid', gap: 10, placeItems: 'center', padding: 40, color: '#475569' }}>
            <Building2 size={34} />
            <strong>No Vendors Found</strong>
            <span>No maintenance vendors or suppliers are currently registered.</span>
            <button type="button" onClick={openCreate} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>Add Vendor</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: '#475569' }}>Vendor</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: '#475569' }}>Type</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: '#475569' }}>Contact</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: '#475569' }}>Phone</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: '#475569' }}>Email</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: '#475569' }}>Location</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: '#475569' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: '#475569' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id} style={{ borderTop: '1px solid #edf2f7' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700 }}>{vendor.supplierName}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{vendor.supplierCode}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>{toReadable(vendor.vendorType)}</td>
                    <td style={{ padding: '12px 14px' }}>{formatListValue(vendor.contactPerson)}</td>
                    <td style={{ padding: '12px 14px' }}>{formatListValue(vendor.phone)}</td>
                    <td style={{ padding: '12px 14px' }}>{formatListValue(vendor.email)}</td>
                    <td style={{ padding: '12px 14px' }}>{formatListValue(vendor.city || vendor.country || vendor.address)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: statusColor[vendor.status]?.bg || '#e2e8f0', color: statusColor[vendor.status]?.text || '#334155', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>
                        {vendor.status || 'active'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => openEdit(vendor)} style={{ background: '#e0f2fe', border: 'none', color: '#075985', borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }} title="Edit vendor"><Edit3 size={14} /></button>
                        <button type="button" onClick={() => changeStatus(vendor)} style={{ background: '#ecfdf5', border: 'none', color: '#166534', borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }} title="Toggle vendor status"><ShieldCheck size={14} /></button>
                        <button type="button" onClick={() => openEdit(vendor)} style={{ background: '#f1f5f9', border: 'none', color: '#0f172a', borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }} title="View vendor"><Eye size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: '1px solid #edf2f7', color: '#475569' }}>
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} style={{ border: '1px solid #dbe4ee', background: '#fff', borderRadius: 8, padding: '8px 10px', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>
            <ChevronLeft size={15} />
          </button>
          <span>Page {pagination.page} of {pagination.pages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))} disabled={page >= pagination.pages} style={{ border: '1px solid #dbe4ee', background: '#fff', borderRadius: 8, padding: '8px 10px', cursor: page >= pagination.pages ? 'not-allowed' : 'pointer', opacity: page >= pagination.pages ? 0.5 : 1 }}>
            <ChevronRight size={15} />
          </button>
        </div>
      </section>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ width: 'min(800px, 100%)', background: '#fff', borderRadius: 16, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0 }}>{modal === 'create' ? 'Add Vendor' : 'Edit Vendor'}</h2>
              <button type="button" onClick={() => setModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveVendor} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 14 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Supplier Code</span>
                <input value={form.supplierCode} onChange={(e) => setForm({ ...form, supplierCode: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Vendor Name *</span>
                <input value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} required style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Legal Name</span>
                <input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Vendor Type</span>
                <select value={form.vendorType} onChange={(e) => setForm({ ...form, vendorType: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }}>
                  <option value="Spare Parts Supplier">Spare Parts Supplier</option>
                  <option value="Equipment Supplier">Equipment Supplier</option>
                  <option value="Maintenance Service Provider">Maintenance Service Provider</option>
                  <option value="Contractor">Contractor</option>
                  <option value="Technical Consultant">Technical Consultant</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Registration Number</span>
                <input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Tax ID</span>
                <input value={form.taxIdentificationNumber} onChange={(e) => setForm({ ...form, taxIdentificationNumber: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Contact Person</span>
                <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Phone</span>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                <span>Email</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Website</span>
                <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Status</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                <span>Address</span>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>City</span>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Country</span>
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={{ border: '1px solid #dbe4ee', borderRadius: 8, padding: '10px 12px' }} />
              </label>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setModal(null)} style={{ border: '1px solid #dbe4ee', background: '#fff', padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving...' : 'Save Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
