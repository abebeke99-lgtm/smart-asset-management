import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../../utils/api';

const tabs = ['overview', 'staff', 'assets', 'requests', 'assignments', 'transfers', 'returns', 'maintenance', 'performance', 'history'];

const DepartmentDetails = () => {
  const { departmentId } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [department, setDepartment] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const endpoint = activeTab === 'staff' ? 'staff' : activeTab === 'assets' ? 'assets' : '';
      const response = await apiClient.get(`/api/college/departments/${departmentId}${endpoint ? `/${endpoint}` : ''}`, { params: { page: 1, limit: 50 } });
      if (activeTab === 'overview') setDepartment(response.data?.data || null);
      else setRows(response.data?.data || []);
    } catch (loadError) { setError(loadError.response?.data?.message || 'Unable to load department data.'); setRows([]); }
    finally { setLoading(false); }
  }, [activeTab, departmentId]);

  useEffect(() => { load(); }, [load]);

  return <section className="college-workspace-page"><header><div><div className="college-breadcrumb">College / Departments / Details</div><h1>{department?.name || 'Department Details'}</h1><p>{department?.code || 'Scoped department workspace'}</p></div></header><nav className="college-tabs" aria-label="Department detail tabs">{tabs.map((tab) => <button type="button" key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</nav>{error && <div role="alert" className="college-error">{error}</div>}{loading ? <div className="college-state">Loading department data...</div> : activeTab === 'overview' && department ? <div className="college-summary-grid"><Summary label="Department" value={department.name} /><Summary label="Code" value={department.code} /><Summary label="Staff" value={department.staffCount} /><Summary label="Assets" value={department.assetCount} /><Summary label="Asset Value" value={department.assetValue} /><Summary label="Status" value={department.status} /></div> : activeTab === 'overview' ? <div className="college-state">No department data found.</div> : rows.length === 0 ? <div className="college-state">No {activeTab} records found.</div> : <div className="college-table-wrap"><table><thead><tr>{Object.keys(rows[0]).filter((key) => !['password', 'resetTokenHash', 'resetTokenExpiresAt', 'sessionVersion'].includes(key)).slice(0, 8).map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{Object.entries(row).filter(([key]) => !['password', 'resetTokenHash', 'resetTokenExpiresAt', 'sessionVersion'].includes(key)).slice(0, 8).map(([key, value]) => <td key={key}>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}</td>)}</tr>)}</tbody></table></div>}</section>;
};

const Summary = ({ label, value }) => <div className="college-summary-card"><span>{label}</span><strong>{value ?? '-'}</strong></div>;
export default DepartmentDetails;
