import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Building2, CheckCircle2, ClipboardList, DollarSign, Package, Users, Wrench } from 'lucide-react';
import './CollegeDashboard.css';

const metricNames = [
  { key: 'totalAssets', label: 'Total Assets', icon: Package, tone: 'blue' },
  { key: 'activeAssets', label: 'Active Assets', icon: CheckCircle2, tone: 'green' },
  { key: 'availableAssets', label: 'Available Assets', icon: Package, tone: 'cyan' },
  { key: 'underMaintenance', label: 'Under Maintenance', icon: Wrench, tone: 'orange' },
  { key: 'pendingRequests', label: 'Pending Requests', icon: ClipboardList, tone: 'amber' },
  { key: 'pendingApprovals', label: 'Pending Approvals', icon: CheckCircle2, tone: 'purple' },
  { key: 'totalDepartments', label: 'Departments', icon: Building2, tone: 'navy' },
  { key: 'totalStaff', label: 'Staff', icon: Users, tone: 'teal' },
  { key: 'totalAssetValue', label: 'Total Asset Value', icon: DollarSign, tone: 'green' }
];

const quickActions = [
  ['/college/requests', 'Create Request', ClipboardList],
  ['/college/approvals', 'Review Approvals', CheckCircle2],
  ['/college/assets', 'View Assets', Package],
  ['/college/inventory', 'View Inventory', BarChart3],
  ['/college/maintenance', 'View Maintenance', Wrench],
  ['/college/departments', 'View Departments', Building2]
];

const maxValue = (items = []) => Math.max(...items.map((item) => Number(item.value) || 0), 1);

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

  if (state.loading) return <div className="college-dashboard-state" role="status">Loading college dashboard...</div>;
  if (state.error) return <div className="college-dashboard-state college-dashboard-state--error"><strong>Failed to load dashboard data.</strong><span>{state.error}</span><button type="button" onClick={loadDashboard}>Retry</button></div>;
  if (!state.data) return <div className="college-dashboard-state">No college dashboard data is available.</div>;

  return (
    <div className="college-dashboard">
      <div className="college-dashboard-kpis">
        {metricNames.map(({ key, label, icon: Icon, tone }) => <article className="college-kpi-card" key={key}><div className={`college-kpi-icon college-kpi-icon--${tone}`}><Icon size={21} aria-hidden="true" /></div><strong className="college-kpi-value">{key === 'totalAssetValue' ? Number(state.data[key] ?? 0).toLocaleString() : Number(state.data[key] ?? 0).toLocaleString()}</strong><span className="college-kpi-label">{label}</span></article>)}
      </div>
      <div className="college-dashboard-charts">
        {[
          ['Assets by Status', state.data.assetByStatus, 'college-chart-bar--status', 'No asset status data.'],
          ['Assets by Category', state.data.assetByCategory, 'college-chart-bar--category', 'No asset category data.']
        ].map(([title, items, tone, emptyMessage]) => <section className="college-dashboard-card" key={title}><div className="college-section-heading"><div><h2>{title}</h2><p>Current distribution from the college asset overview.</p></div><BarChart3 size={20} aria-hidden="true" /></div>{items?.length ? <div className="college-chart-list">{items.map((item) => <div className="college-chart-row" key={item.label}><div className="college-chart-row-label"><span>{item.label}</span><strong>{Number(item.value) || 0}</strong></div><div className="college-chart-track"><span className={tone} style={{ width: `${((Number(item.value) || 0) / maxValue(items)) * 100}%` }} /></div></div>)}</div> : <p className="college-empty-state">{emptyMessage}</p>}</section>)}
      </div>
      <section className="college-dashboard-card college-actions-section"><div className="college-section-heading"><div><h2>Quick Actions</h2><p>Common college asset management workflows.</p></div><ArrowRight size={20} aria-hidden="true" /></div><div className="college-actions-grid">{quickActions.map(([to, label, Icon]) => <Link className="college-action-card" key={to} to={to}><span className="college-action-icon"><Icon size={19} aria-hidden="true" /></span><span className="college-action-copy"><strong>{label}</strong><small>Open {label.toLowerCase()}</small></span><ArrowRight className="college-action-arrow" size={18} aria-hidden="true" /></Link>)}</div></section>
    </div>
  );
};

export default CollegeDashboard;
