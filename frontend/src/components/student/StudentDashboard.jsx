import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Package, RefreshCw, Wrench } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './StudentDashboard.css';

const emptyData = { summary: {}, assets: [], requests: [] };

const normalizeDashboard = (response) => {
  const data = response?.data?.data;
  if (!data || typeof data !== 'object'
    || !data.summary || typeof data.summary !== 'object'
    || !Array.isArray(data.assets) || !Array.isArray(data.requests)) {
    throw new Error('Student dashboard response was incomplete.');
  }
  return data;
};

export default function StudentDashboard() {
  const [state, setState] = useState({ loading: true, error: '', data: emptyData });

  const loadDashboard = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await apiClient.get('/api/student/dashboard');
      setState({ loading: false, error: '', data: normalizeDashboard(response) });
    } catch (error) {
      console.error('Student dashboard request failed:', {
        status: error.response?.status || 0,
        message: error.message,
      });
      setState((current) => ({
        ...current,
        loading: false,
        error: error.response?.data?.message || error.message || 'Unable to load your dashboard.',
      }));
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (state.loading && !state.data.summary.assignedAssets && !state.data.summary.totalRequests) {
    return <main className="student-dashboard" aria-busy="true"><p role="status">Loading your dashboard...</p></main>;
  }

  if (state.error && !state.data.assets.length && !state.data.requests.length) {
    return (
      <main className="student-dashboard">
        <section className="student-dashboard-message" role="alert">
          <AlertTriangle size={22} aria-hidden="true" />
          <p>{state.error}</p>
          <button type="button" onClick={loadDashboard} disabled={state.loading}>
            <RefreshCw size={16} aria-hidden="true" /> Retry
          </button>
        </section>
      </main>
    );
  }

  const summary = state.data.summary;
  return (
    <main className="student-dashboard">
      <header className="student-dashboard-header">
        <div>
          <span className="student-dashboard-eyebrow">Student</span>
          <h1>My Dashboard</h1>
          <p>Your assigned university assets and submitted requests.</p>
        </div>
        <button type="button" onClick={loadDashboard} disabled={state.loading} aria-label="Refresh dashboard">
          <RefreshCw size={17} aria-hidden="true" /> Refresh
        </button>
      </header>

      {state.error && <p className="student-dashboard-inline-error" role="alert">{state.error}</p>}

      <section className="student-dashboard-kpis" aria-label="My activity summary">
        <article><Package size={20} aria-hidden="true" /><strong>{summary.assignedAssets}</strong><span>Assigned Assets</span></article>
        <article><Wrench size={20} aria-hidden="true" /><strong>{summary.totalRequests}</strong><span>My Requests</span></article>
        <article><AlertTriangle size={20} aria-hidden="true" /><strong>{summary.openRequests}</strong><span>Open Requests</span></article>
      </section>

      <div className="student-dashboard-tables">
        <section className="student-dashboard-card">
          <h2>My Assigned Assets</h2>
          {state.data.assets.length ? (
            <div className="student-dashboard-table-scroll">
              <table>
                <thead><tr><th>Asset</th><th>Category</th><th>Status</th><th>Location</th></tr></thead>
                <tbody>{state.data.assets.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.asset?.name || assignment.asset?.assetCode || 'Asset'}</td>
                    <td>{assignment.asset?.category || '—'}</td>
                    <td>{assignment.asset?.status || assignment.status || '—'}</td>
                    <td>{assignment.asset?.location || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="student-dashboard-empty">No assets are currently assigned to you.</p>}
        </section>

        <section className="student-dashboard-card">
          <h2>My Requests</h2>
          {state.data.requests.length ? (
            <div className="student-dashboard-table-scroll">
              <table>
                <thead><tr><th>Request</th><th>Type</th><th>Status</th><th>Submitted</th></tr></thead>
                <tbody>{state.data.requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.title || request.requestCode}</td>
                    <td>{request.requestType || '—'}</td>
                    <td>{request.status || '—'}</td>
                    <td>{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="student-dashboard-empty">You have not submitted any requests.</p>}
        </section>
      </div>
    </main>
  );
}
