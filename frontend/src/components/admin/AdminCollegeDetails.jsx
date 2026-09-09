import React, { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowLeft, Building2, Edit2, MapPin, Package, Power, PowerOff, UserRound, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';

const tabs = ['overview', 'departments', 'staff', 'assets', 'locations', 'activity'];
const displayValue = (value) => value === null || value === undefined || value === '' ? 'Not available' : value;

const AdminCollegeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get(`/api/admin/colleges/${id}`);
      setData(response?.data?.data || null);
    } catch (requestError) {
      setError(requestError?.response?.status === 403 ? 'Access denied.' : "We couldn't retrieve college information. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  const toggleStatus = async () => {
    try {
      const status = data.college?.status === 'active' ? 'inactive' : 'active';
      await apiClient.patch(`/api/admin/colleges/${id}/status`, { status });
      toast.success(`College ${status === 'active' ? 'activated' : 'deactivated'}`);
      await fetchDetails();
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || 'Unable to update college status');
    }
  };

  if (loading) return <section className="admin-workspace-page"><div className="admin-card admin-empty-state">Loading college details...</div></section>;
  if (error || !data) return <section className="admin-workspace-page"><div className="admin-error-state"><span>{error || 'College not found.'}</span><button className="admin-secondary-button" onClick={fetchDetails}>Retry</button></div></section>;

  const college = data.college || data;
  const statistics = data.statistics || {};
  const stats = [
    ['Departments', data.departments?.length ?? college.departmentCount ?? 0, Building2],
    ['Staff', data.staff?.length ?? college.staffCount ?? 0, Users],
    ['Assets', data.assets?.length ?? college.assetCount ?? 0, Package],
    ['Locations', data.locations?.length ?? college.locationCount ?? 0, MapPin],
  ];

  return (
    <section className="admin-workspace-page" aria-labelledby="college-details-title">
      <div className="admin-breadcrumb"><button className="icon-button" onClick={() => navigate('/admin/colleges')}><ArrowLeft size={16} /></button> Organization / Colleges / {college.collegeName || college.name}</div>
      <div className="admin-page-header">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}><Building2 size={34} color="#2563EB" /><div><h1 id="college-details-title" className="admin-page-title">{college.collegeName || college.name}</h1><p className="admin-page-subtitle">{college.collegeCode || college.code} <span className={`admin-status-badge ${college.status === 'active' ? 'active' : 'inactive'}`}>{college.status}</span></p></div></div>
        <div style={{ display: 'flex', gap: 8 }}><button className="admin-secondary-button" onClick={() => navigate(`/admin/colleges?edit=${id}`)}><Edit2 size={16} /> Edit College</button><button className="admin-primary-button" onClick={toggleStatus}>{college.status === 'active' ? <PowerOff size={16} /> : <Power size={16} />} {college.status === 'active' ? 'Deactivate' : 'Activate'}</button></div>
      </div>

      <div className="admin-tabs" role="tablist">{tabs.map((item) => <button key={item} className={`admin-tab ${tab === item ? 'active' : ''}`} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}</div>

      {tab === 'overview' && <>
        <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>{stats.map(([label, value, Icon]) => <div className="admin-card" key={label}><Icon size={18} color="#2563EB" /><span>{label}</span><strong>{value}</strong></div>)}</div>
        <div className="admin-analytics-grid"><div className="admin-card"><h2>College information</h2><p>{displayValue(college.description)}</p><p>Established: {displayValue(college.establishedDate)}</p><p>Address: {displayValue(college.address || college.location)}</p></div><div className="admin-card"><h2><UserRound size={18} /> College Manager</h2><p>{college.manager?.name || 'Unassigned'}</p><p>{college.manager?.email || 'No email available'}</p></div><div className="admin-card"><h2><Activity size={18} /> Asset summary</h2><p>Available: {statistics.availableAssets ?? 'Not available'}</p><p>Assigned: {statistics.assignedAssets ?? 'Not available'}</p><p>Maintenance: {statistics.maintenanceAssets ?? 'Not available'}</p><p>Missing: {statistics.missingAssets ?? 'Not available'}</p><p>Damaged: {statistics.damagedAssets ?? 'Not available'}</p></div></div>
      </>}

      {tab === 'departments' && <DetailsTable headers={['Department', 'Head', 'Staff', 'Assets', 'Status']} rows={(data.departments || []).map((row) => [row.name, row.Head?.fullName || row.Head?.username || 'Unassigned', row.staffCount ?? 0, row.assetCount ?? 0, row.status])} />}
      {tab === 'staff' && <DetailsTable headers={['Name', 'Username', 'Email', 'Role', 'Department', 'Status']} rows={(data.staff || []).map((row) => [row.fullName || row.username, row.username, row.email, row.role, row.department || 'Unassigned', row.active ? 'active' : 'inactive'])} />}
      {tab === 'assets' && <DetailsTable headers={['Asset', 'Code', 'Category', 'Department', 'Location', 'Status', 'Condition', 'Value']} rows={(data.assets || []).map((row) => [row.name, row.assetCode, row.category, row.department || 'Unassigned', row.location || 'Unassigned', row.status, row.condition, row.currentValue || row.purchasePrice || 0])} />}
      {tab === 'locations' && <DetailsTable headers={['Location', 'Status']} rows={(data.locations || []).map((row) => [row.name, row.status])} />}
      {tab === 'activity' && <DetailsTable headers={['Action', 'Entity', 'Actor', 'Timestamp']} rows={(data.activity || []).map((row) => [row.action, row.entity, row.userId || 'System', new Date(row.createdAt).toLocaleString()])} />}
    </section>
  );
};

const DetailsTable = ({ headers, rows }) => <div className="admin-table-card"><div className="admin-table-scroll"><table className="admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{displayValue(cell)}</td>)}</tr>) : <tr><td colSpan={headers.length}>No data available for this college.</td></tr>}</tbody></table></div></div>;

export default AdminCollegeDetails;
