import React, { useCallback, useEffect, useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Search, RefreshCw, Calendar, Building2, Tag } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../../services/apiClient';
import './ICTWarranty.css';

const statusConfig = {
  active: { icon: ShieldCheck, label: 'Active', className: 'warranty-active' },
  expired: { icon: ShieldX, label: 'Expired', className: 'warranty-expired' },
  expiring: { icon: ShieldAlert, label: 'Expiring Soon', className: 'warranty-expiring' },
  no_warranty: { icon: Shield, label: 'No Warranty', className: 'warranty-none' },
};

export default function ICTWarranty() {
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const loadWarranties = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      const response = await apiClient.get('/api/ict/warranties', { params });
      setWarranties(response.data?.data || []);
      setPagination(response.data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      toast.error('Unable to load warranty data.');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus]);

  useEffect(() => { loadWarranties(); }, [loadWarranties]);

  const filteredWarranties = warranties.filter((w) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return w.name?.toLowerCase().includes(term) || w.assetCode?.toLowerCase().includes(term) || w.serialNumber?.toLowerCase().includes(term) || w.department?.toLowerCase().includes(term);
  });

  const stats = {
    total: warranties.length,
    active: warranties.filter((w) => w.warrantyStatus === 'active').length,
    expiring: warranties.filter((w) => w.warrantyStatus === 'expiring' || (w.daysUntilExpiry !== null && w.daysUntilExpiry > 0 && w.daysUntilExpiry <= 30)).length,
    expired: warranties.filter((w) => w.warrantyStatus === 'expired').length,
  };

  return (
    <main className="ict-warranty-page">
      <div className="ict-warranty-shell">
        <header className="warranty-header">
          <div className="warranty-title">
            <div className="warranty-mark"><Shield size={24} /></div>
            <div>
              <p className="warranty-eyebrow">ICT OPERATIONS</p>
              <h1>Warranty Management</h1>
              <p>Track and monitor ICT asset warranties, coverage, and expiration.</p>
            </div>
          </div>
          <div className="warranty-actions">
            <button className="warranty-button secondary" onClick={() => loadWarranties(pagination.page)}><RefreshCw size={16} /> Refresh</button>
          </div>
        </header>

        <section className="warranty-stats">
          <div className="warranty-stat"><span>Total Assets</span><strong>{stats.total}</strong></div>
          <div className="warranty-stat active"><span>Active</span><strong>{stats.active}</strong></div>
          <div className="warranty-stat expiring"><span>Expiring Soon</span><strong>{stats.expiring}</strong></div>
          <div className="warranty-stat expired"><span>Expired</span><strong>{stats.expired}</strong></div>
        </section>

        <section className="warranty-toolbar">
          <div className="warranty-search">
            <Search size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, code, serial, department..." />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="warranty-filter">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
        </section>

        <section className="warranty-table-wrap">
          {loading ? (
            <div className="warranty-loading">Loading warranty data...</div>
          ) : filteredWarranties.length === 0 ? (
            <div className="warranty-empty"><Shield size={40} /><h2>No warranty data found</h2><p>ICT assets with warranty information will appear here.</p></div>
          ) : (
            <table className="warranty-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Purchase Date</th>
                  <th>Warranty Expiry</th>
                  <th>Days Left</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarranties.map((w) => {
                  const config = statusConfig[w.warrantyStatus] || statusConfig.no_warranty;
                  const StatusIcon = config.icon;
                  return (
                    <tr key={w.id}>
                      <td>
                        <strong>{w.name}</strong>
                        <small>{w.assetCode || w.serialNumber || `ID: ${w.id}`}</small>
                      </td>
                      <td>{w.category || '—'}</td>
                      <td>{w.department || '—'}</td>
                      <td>{w.purchaseDate ? new Date(w.purchaseDate).toLocaleDateString() : '—'}</td>
                      <td>{w.warrantyExpiry ? new Date(w.warrantyExpiry).toLocaleDateString() : '—'}</td>
                      <td>{w.daysUntilExpiry !== null ? (w.daysUntilExpiry < 0 ? '—' : w.daysUntilExpiry) : '—'}</td>
                      <td>
                        <span className={`warranty-badge ${config.className}`}>
                          <StatusIcon size={13} /> {config.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {pagination.totalPages > 1 && (
          <footer className="warranty-pagination">
            <span>{pagination.total} records</span>
            <div>
              <button disabled={pagination.page <= 1} onClick={() => loadWarranties(pagination.page - 1)}>‹</button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <button disabled={pagination.page >= pagination.totalPages} onClick={() => loadWarranties(pagination.page + 1)}>›</button>
            </div>
          </footer>
        )}
      </div>
    </main>
  );
}
