import React, { useCallback, useEffect, useState } from 'react';
import { Activity, BarChart3, Building2, CheckCircle2, Eye, Filter, Package, RefreshCw, Search, Users, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';
import './CollegeDepartmentOverview.css';

const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '-';
const formatNumber = (value) => Number(value || 0).toLocaleString();

const CollegeDepartmentOverview = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const amharic = language === 'am';
  const labels = amharic ? {
    title: 'የዲፓርትመንት አጠቃላይ እይታ', subtitle: 'በእርስዎ ኮሌጅ ውስጥ ያሉ ዲፓርትመንቶች የቅርብ ጊዜ እይታ', total: 'ጠቅላላ ዲፓርትመንቶች', active: 'ንቁ ዲፓርትመንቶች', inactive: 'ዝግ ዲፓርትመንቶች', staff: 'ጠቅላላ ሰራተኞች', assets: 'ጠቅላላ ንብረቶች', withAssets: 'ንብረት ያላቸው', withoutAssets: 'ንብረት የሌላቸው', table: 'የዲፓርትመንት ማጠቃለያ', assetChart: 'የንብረት ስርጭት', staffChart: 'የሰራተኛ ስርጭት', activity: 'የቅርብ ጊዜ እንቅስቃሴ', search: 'በስም፣ ኮድ ወይም ኃላፊ ፈልግ', all: 'ሁሉም ሁኔታዎች', activeFilter: 'ንቁ', inactiveFilter: 'ዝግ', department: 'ዲፓርትመንት', head: 'ኃላፊ', status: 'ሁኔታ', updated: 'የተሻሻለበት', actions: 'እርምጃ', view: 'ዝርዝር እይታ', retry: 'እንደገና ሞክር', empty: 'ምንም የዲፓርትመንት መረጃ የለም', noChart: 'የስርጭት መረጃ የለም', noActivity: 'ምንም ተዛማጅ እንቅስቃሴ የለም'
  } : {
    title: 'Department Overview', subtitle: 'A real-time overview of departments within your college.', total: 'Total Departments', active: 'Active Departments', inactive: 'Inactive Departments', staff: 'Total Department Staff', assets: 'Total Department Assets', withAssets: 'Departments With Assets', withoutAssets: 'Departments Without Assets', table: 'Department Summary', assetChart: 'Asset Distribution', staffChart: 'Staff Distribution', activity: 'Recent Department Activity', search: 'Search by name, code, or head', all: 'All statuses', activeFilter: 'Active', inactiveFilter: 'Inactive', department: 'Department', head: 'Head', status: 'Status', updated: 'Last Updated', actions: 'Actions', view: 'View details', retry: 'Retry', empty: 'No departments were found for this college.', noChart: 'No distribution data available.', noActivity: 'No relevant department activity has been recorded.'
  };
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [state, setState] = useState({ loading: true, error: '', data: null });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await apiClient.get('/api/college/department-overview', { params: filters });
      setState({ loading: false, error: '', data: response.data?.data || null });
    } catch (error) {
      setState({ loading: false, error: error.response?.data?.message || 'Unable to load department overview.', data: null });
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  if (state.loading) return <div className="college-department-overview-state" aria-busy="true"><RefreshCw className="college-overview-spin" size={20} /> Loading department overview...</div>;
  if (state.error) return <div className="college-department-overview-state college-department-overview-error" role="alert"><strong>Unable to load department overview</strong><span>{state.error}</span><button type="button" onClick={load}><RefreshCw size={16} /> {labels.retry}</button></div>;

  const data = state.data || {};
  const summary = data.summary || {};
  const departments = data.departments || [];
  const assetDistribution = data.assetDistribution || [];
  const staffDistribution = data.staffDistribution || [];
  const statusDistribution = data.statusDistribution || {};
  const activity = data.recentActivity || [];
  const maxAssets = Math.max(1, ...assetDistribution.map((item) => Number(item.count || 0)));
  const maxStaff = Math.max(1, ...staffDistribution.map((item) => Number(item.count || 0)));
  const metrics = [
    [labels.total, summary.totalDepartments, Building2, 'blue'], [labels.active, summary.activeDepartments, CheckCircle2, 'green'], [labels.inactive, summary.inactiveDepartments, XCircle, 'orange'],
    [labels.staff, summary.totalStaff, Users, 'teal'], [labels.assets, summary.totalAssets, Package, 'cyan'], [labels.withAssets, summary.departmentsWithAssets, BarChart3, 'amber'], [labels.withoutAssets, summary.departmentsWithoutAssets, Building2, 'navy'],
  ];

  return <div className="college-department-overview">
    <header className="college-department-overview-header">
      <div><span className="college-eyebrow">{data.college?.name || 'College Manager'}</span><h1>{labels.title}</h1><p>{labels.subtitle}</p></div>
      <button type="button" className="college-department-overview-refresh" onClick={load} aria-label="Refresh department overview" title="Refresh"><RefreshCw size={17} /></button>
    </header>
    <div className="college-dashboard-kpis">{metrics.map(([label, value, Icon, tone]) => <div className="college-kpi-card" key={label}><div className={`college-kpi-icon college-kpi-icon--${tone}`}><Icon size={21} /></div><strong className="college-kpi-value">{formatNumber(value)}</strong><span className="college-kpi-label">{label}</span></div>)}</div>
    <section className="college-overview-toolbar" aria-label="Department filters"><div className="college-overview-search"><Search size={17} /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder={labels.search} aria-label={labels.search} /></div><div className="college-overview-filter"><Filter size={16} /><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label={labels.status}><option value="">{labels.all}</option><option value="active">{labels.activeFilter}</option><option value="inactive">{labels.inactiveFilter}</option></select></div></section>
    <div className="college-overview-grid">
      <section className="college-dashboard-card college-overview-chart-card"><div className="college-section-heading"><div><h2>{labels.assetChart}</h2><p>{labels.assets}</p></div><Package size={20} /></div>{assetDistribution.some((item) => item.count > 0) ? assetDistribution.map((item) => <div className="college-overview-bar-row" key={item.id}><div><span>{item.name}</span><strong>{formatNumber(item.count)}</strong></div><div className="college-overview-track"><span style={{ width: `${(Number(item.count || 0) / maxAssets) * 100}%` }} /></div></div>) : <p className="college-empty-state">{labels.noChart}</p>}</section>
      <section className="college-dashboard-card college-overview-chart-card"><div className="college-section-heading"><div><h2>{labels.staffChart}</h2><p>{labels.staff}</p></div><Users size={20} /></div>{staffDistribution.some((item) => item.count > 0) ? staffDistribution.map((item) => <div className="college-overview-bar-row" key={item.id}><div><span>{item.name}</span><strong>{formatNumber(item.count)} ({item.percentage}%)</strong></div><div className="college-overview-track college-overview-track--staff"><span style={{ width: `${(Number(item.count || 0) / maxStaff) * 100}%` }} /></div></div>) : <p className="college-empty-state">{labels.noChart}</p>}</section>
    </div>
    <section className="college-dashboard-card college-overview-table-card"><div className="college-section-heading"><div><h2>{labels.table}</h2><p>{data.college?.code || ''}</p></div><Building2 size={20} /></div>{departments.length ? <div className="college-overview-table-wrap"><table><thead><tr><th>{labels.department}</th><th>{labels.head}</th><th>{labels.staff}</th><th>{labels.assets}</th><th>{labels.status}</th><th>{labels.updated}</th><th>{labels.actions}</th></tr></thead><tbody>{departments.map((department) => <tr key={department.id}><td><strong>{department.name}</strong><small>{department.code || '-'}</small></td><td>{department.head?.fullName || department.head?.username || '-'}</td><td>{formatNumber(department.staffCount)}</td><td>{formatNumber(department.assetCount)}</td><td><span className={`college-overview-status college-overview-status--${department.status}`}>{department.status}</span></td><td>{formatDate(department.updatedAt)}</td><td><button type="button" className="college-overview-view" onClick={() => navigate(`/college/departments/${department.id}`)} title={labels.view}><Eye size={16} /> <span>{labels.view}</span></button></td></tr>)}</tbody></table></div> : <div className="college-empty-state"><Building2 size={26} /><p>{labels.empty}</p></div>}</section>
    <div className="college-overview-grid">
      <section className="college-dashboard-card college-overview-status-card"><div className="college-section-heading"><div><h2>{labels.status}</h2><p>{labels.total}</p></div><CheckCircle2 size={20} /></div><div className="college-overview-status-list">{Object.entries(statusDistribution).map(([status, count]) => <div key={status}><span className={`college-overview-status college-overview-status--${status}`}>{status}</span><strong>{formatNumber(count)}</strong></div>)}</div></section>
      <section className="college-dashboard-card college-overview-activity-card"><div className="college-section-heading"><div><h2>{labels.activity}</h2></div><Activity size={20} /></div>{activity.length ? <ul>{activity.map((item) => <li key={item.id}><span>{item.action.replaceAll('_', ' ')}</span><strong>{item.actor}</strong><time dateTime={item.timestamp}>{formatDate(item.timestamp)}</time></li>)}</ul> : <p className="college-empty-state">{labels.noActivity}</p>}</section>
    </div>
  </div>;
};

export default CollegeDepartmentOverview;
