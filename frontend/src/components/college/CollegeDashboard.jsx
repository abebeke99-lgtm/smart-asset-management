import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, CheckCircle2, ClipboardList, Package, Users, Wrench } from 'lucide-react';

const metricNames = [
  ['totalAssets', 'Total Assets'], ['activeAssets', 'Active Assets'], ['availableAssets', 'Available Assets'],
  ['underMaintenance', 'Under Maintenance'], ['pendingRequests', 'Pending Requests'], ['pendingApprovals', 'Pending Approvals'],
  ['totalDepartments', 'Departments'], ['totalStaff', 'Staff'], ['totalAssetValue', 'Total Asset Value']
];

const metricIcons = [Package, CheckCircle2, Package, Wrench, ClipboardList, CheckCircle2, BarChart3, Users, BarChart3];

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

  if (state.loading) return <div className="flex min-h-64 items-center justify-center rounded-2xl border border-sky-100 bg-white p-8 text-sky-700 shadow-sm">Loading college dashboard...</div>;
  if (state.error) return <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-red-800"><strong>Failed to load dashboard data.</strong><span className="text-sm">{state.error}</span><button className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white transition hover:bg-red-800" type="button" onClick={loadDashboard}>Retry</button></div>;
  if (!state.data) return <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-sky-200 bg-white p-8 text-slate-500">No college dashboard data is available.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metricNames.map(([key, label], index) => {
          const Icon = metricIcons[index];
          return <div className="group rounded-2xl border border-sky-100 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl" key={key}><div className="mb-4 flex items-center justify-between"><span className="rounded-xl bg-sky-100 p-2 text-sky-700"><Icon size={20} aria-hidden="true" /></span><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">College</span></div><strong className="block text-3xl font-extrabold text-sky-950">{key === 'totalAssetValue' ? Number(state.data[key] || 0).toLocaleString() : state.data[key] || 0}</strong><span className="mt-1 block text-sm font-medium text-slate-500">{label}</span></div>;
        })}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"><h3 className="mb-5 text-lg font-bold text-sky-950">Assets by Status</h3>{state.data.assetByStatus?.length ? state.data.assetByStatus.map((item) => <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3 text-sm last:mb-0 last:border-0" key={item.label}><span className="capitalize text-slate-600">{item.label}</span><strong className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">{item.value}</strong></div>) : <p className="text-sm text-slate-500">No asset status data.</p>}</section>
        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"><h3 className="mb-5 text-lg font-bold text-sky-950">Assets by Category</h3>{state.data.assetByCategory?.length ? state.data.assetByCategory.map((item) => <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3 text-sm last:mb-0 last:border-0" key={item.label}><span className="text-slate-600">{item.label}</span><strong className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-800">{item.value}</strong></div>) : <p className="text-sm text-slate-500">No asset category data.</p>}</section>
        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"><h3 className="mb-5 text-lg font-bold text-sky-950">Quick Actions</h3><div className="grid gap-2">{[['/college/requests', 'Create Request'], ['/college/approvals', 'Review Approvals'], ['/college/assets', 'View Assets'], ['/college/inventory', 'View Inventory'], ['/college/maintenance', 'View Maintenance'], ['/college/departments', 'View Departments']].map(([to, label]) => <Link className="flex items-center justify-between rounded-xl border border-sky-100 px-3 py-2.5 text-sm font-semibold text-sky-800 transition hover:border-sky-300 hover:bg-sky-50" key={to} to={to}>{label}<ArrowRight size={16} aria-hidden="true" /></Link>)}</div></section>
      </div>
    </div>
  );
};

export default CollegeDashboard;
