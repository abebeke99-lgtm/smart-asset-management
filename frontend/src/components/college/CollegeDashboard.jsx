import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const metricNames = [
  ['totalAssets', 'Total Assets'], ['activeAssets', 'Active Assets'], ['availableAssets', 'Available Assets'],
  ['underMaintenance', 'Under Maintenance'], ['pendingRequests', 'Pending Requests'], ['pendingApprovals', 'Pending Approvals'],
  ['totalDepartments', 'Departments'], ['totalStaff', 'Staff'], ['totalAssetValue', 'Total Asset Value']
];

const CollegeDashboard = () => {
  const [state, setState] = useState({ loading: true, error: '', data: null });

  const loadDashboard = async () => {
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const response = await axios.get('/api/college/dashboard');
      setState({ loading: false, error: '', data: response.data?.data || null });
    } catch (error) {
      console.error('College dashboard API failed', error);
      setState({ loading: false, error: error.response?.data?.message || error.message || 'Failed to load dashboard data', data: null });
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  if (state.loading) return <div className="college-page-state">Loading college dashboard...</div>;
  if (state.error) return <div className="college-page-state college-page-error"><strong>Failed to load dashboard data.</strong><span>{state.error}</span><button type="button" onClick={loadDashboard}>Retry</button></div>;
  if (!state.data) return <div className="college-page-state">No college dashboard data is available.</div>;

  return (
    <div className="college-dashboard">
      <div className="college-kpi-grid">
        {metricNames.map(([key, label]) => <div className="college-kpi" key={key}><strong>{key === 'totalAssetValue' ? Number(state.data[key] || 0).toLocaleString() : state.data[key] || 0}</strong><span>{label}</span></div>)}
      </div>
      <div className="college-dashboard-grid">
        <section className="college-panel"><h3>Assets by Status</h3>{state.data.assetByStatus?.length ? state.data.assetByStatus.map((item) => <div className="college-summary-row" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>) : <p>No asset status data.</p>}</section>
        <section className="college-panel"><h3>Assets by Category</h3>{state.data.assetByCategory?.length ? state.data.assetByCategory.map((item) => <div className="college-summary-row" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>) : <p>No asset category data.</p>}</section>
        <section className="college-panel"><h3>Quick Actions</h3><div className="college-actions">{[['/college/requests', 'Create Request'], ['/college/approvals', 'Review Approvals'], ['/college/assets', 'View Assets'], ['/college/inventory', 'View Inventory'], ['/college/maintenance', 'View Maintenance'], ['/college/departments', 'View Departments']].map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</div></section>
      </div>
    </div>
  );
};

export default CollegeDashboard;
