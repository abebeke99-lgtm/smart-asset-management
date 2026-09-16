import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Building2, CheckCircle2, ClipboardCheck, ClipboardList, MapPin, Package, RefreshCw, RotateCcw, ShieldCheck, Truck, Users, Wrench } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './CollegeDashboard.css';

const quickActions = [
  ['/college/assets', 'Manage Assets', Package],
  ['/college/departments', 'Departments', Building2],
  ['/college/requests', 'Asset Requests', ClipboardList],
  ['/college/assignments', 'Assignments', ClipboardCheck],
  ['/college/transfers', 'Transfers', Truck],
  ['/college/verification', 'Verification', ShieldCheck],
];

const formatDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const normalizeLabel = (value = '') => String(value).replace(/[_-]+/g, ' ').trim() || 'Unknown';

const CollegeDashboard = () => {
  const [state, setState] = useState({ loading: true, error: '', data: null });

  const loadDashboard = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const response = await apiClient.get('/api/college/dashboard');
      setState({ loading: false, error: '', data: response.data?.data || null });
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to load college dashboard';
      setState({ loading: false, error: message, data: null });
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const data = state.data || {};
  const college = data.college || {};
  const summary = data.summary || {};
  const assetStatus = data.assetStatus || [];
  const departmentDistribution = data.departmentDistribution || [];
  const pendingRequests = data.pendingRequests || [];
  const recentAssignments = data.recentAssignments || [];
  const recentTransfers = data.recentTransfers || [];
  const recentReturns = data.recentReturns || [];
  const maintenance = data.maintenance || {};
  const verification = data.verification || {};
  const recentActivity = data.recentActivity || [];

  const metrics = useMemo(() => [
    ['totalAssets', 'Total Assets', 'Assets registered for this college.', Package, 'blue', '/college/assets'],
    ['availableAssets', 'Available Assets', 'Currently available and ready for issue.', CheckCircle2, 'green', '/college/assets'],
    ['assignedAssets', 'Assigned Assets', 'Assets currently assigned to users or departments.', Users, 'cyan', '/college/assignments'],
    ['maintenanceAssets', 'Under Maintenance', 'Assets currently flagged for repair or maintenance.', Wrench, 'orange', '/college/maintenance'],
    ['departments', 'Departments', 'Departments in this college.', Building2, 'navy', '/college/departments'],
    ['staff', 'Staff', 'Active staff in this college.', Users, 'teal', '/college/staff'],
    ['pendingRequests', 'Pending Requests', 'Requests awaiting approval or action.', ClipboardList, 'amber', '/college/requests'],
    ['verificationRequired', 'Verification Required', 'Assets needing verification review.', ShieldCheck, 'orange', '/college/verification'],
  ], []);

  const maxStatusValue = Math.max(1, ...assetStatus.map((item) => Number(item.value) || 0));

  if (state.loading) {
    return (
      <div className="college-dashboard" aria-live="polite" aria-busy="true">
        <div className="college-dashboard-hero college-dashboard-hero--loading">
          <div>
            <span className="college-eyebrow">Loading</span>
            <h1>College Manager Dashboard</h1>
            <p>Collecting the latest college metrics and activity.</p>
          </div>
        </div>
        <div className="college-dashboard-kpis">
          {Array.from({ length: 8 }).map((_, index) => <div className="college-kpi-card college-skeleton-card" key={`kpi-${index}`} />)}
        </div>
        <div className="college-dashboard-charts">
          <div className="college-dashboard-card college-skeleton-card" />
          <div className="college-dashboard-card college-skeleton-card" />
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="college-dashboard-state college-dashboard-state--error" role="alert">
        <strong>Unable to load college dashboard</strong>
        <span>{state.error}</span>
        <button type="button" onClick={loadDashboard}>Retry</button>
      </div>
    );
  }

  if (!data || !Object.keys(data).length) {
    return <div className="college-dashboard-state">No college dashboard data is available.</div>;
  }

  return (
    <div className="college-dashboard">
      <div className="college-dashboard-hero">
        <div>
          <span className="college-eyebrow">College Manager</span>
          <h1>College Manager</h1>
          <p>{college.name ? `${college.name}` : 'Monitor and manage assets, departments, and operations across your college.'}</p>
          <p className="college-hero-subtitle">Monitor and manage assets, departments, and operations across your college.</p>
        </div>
        <div className="college-college-badge">
          <Building2 size={20} />
          <strong>{college.name || 'College'}</strong>
          <span>{college.code || 'No code available'}</span>
        </div>
      </div>

      <div className="college-dashboard-kpis">
        {metrics.map(([key, label, description, Icon, tone, to]) => (
          <Link className="college-kpi-card" key={key} to={to}>
            <div className={`college-kpi-icon college-kpi-icon--${tone}`}>
              <Icon size={21} aria-hidden="true" />
            </div>
            <strong className="college-kpi-value">{Number(summary[key] || 0).toLocaleString()}</strong>
            <span className="college-kpi-label">{label}</span>
            <small>{description}</small>
          </Link>
        ))}
      </div>

      <div className="college-dashboard-charts">
        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>Asset Status Overview</h2>
              <p>Current status distribution for this college.</p>
            </div>
            <BarChart3 size={20} />
          </div>
          {assetStatus.length ? (
            <div className="college-chart-list">
              {assetStatus.map((item) => (
                <div className="college-chart-row" key={`${item.label}-${item.value}`}>
                  <div className="college-chart-row-label">
                    <span>{normalizeLabel(item.label)}</span>
                    <strong>{item.value}</strong>
                  </div>
                  <div className="college-chart-track">
                    <span className="college-chart-bar--status" style={{ width: `${((Number(item.value) || 0) / maxStatusValue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="college-empty-state">No asset status data available</p>
          )}
        </section>

        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>Requests Requiring Attention</h2>
              <p>Open requests that need review.</p>
            </div>
            <ClipboardList size={20} />
          </div>
          {pendingRequests.length ? (
            <div className="college-mini-list">
              {pendingRequests.map((request) => (
                <div className="college-mini-row" key={request.id}>
                  <div>
                    <strong>{request.item}</strong>
                    <small>{request.department}</small>
                  </div>
                  <span>{request.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="college-empty-state">No pending requests</p>
          )}
          <Link className="college-primary-link" to="/college/requests">
            View requests <ArrowRight size={16} />
          </Link>
        </section>
      </div>

      <section className="college-dashboard-card college-table-section">
        <div className="college-section-heading">
          <div>
            <h2>Assets by Department</h2>
            <p>Department-level distribution within this college.</p>
          </div>
          <Building2 size={20} />
        </div>
        {departmentDistribution.length ? (
          <div className="college-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Assets</th>
                  <th>Available</th>
                  <th>Assigned</th>
                  <th>Maintenance</th>
                  <th>Missing</th>
                </tr>
              </thead>
              <tbody>
                {departmentDistribution.map((row) => (
                  <tr key={row.id || row.name}>
                    <td>{row.name}</td>
                    <td>{row.totalAssets || 0}</td>
                    <td>{row.available || 0}</td>
                    <td>{row.assigned || 0}</td>
                    <td>{row.maintenance || 0}</td>
                    <td>{row.missing || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="college-empty-state">No asset distribution data available</p>
        )}
      </section>

      <div className="college-dashboard-lower">
        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>Recent Assignments</h2>
              <p>Latest assigned assets in the college.</p>
            </div>
            <ClipboardCheck size={20} />
          </div>
          {recentAssignments.length ? (
            <div className="college-mini-list">
              {recentAssignments.map((item) => (
                <div className="college-mini-row" key={item.id}>
                  <div>
                    <strong>{item.asset}</strong>
                    <small>{item.assignedTo}</small>
                  </div>
                  <span>{item.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="college-empty-state">No recent assignments</p>
          )}
        </section>

        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>Recent Transfers</h2>
              <p>Latest movement between departments.</p>
            </div>
            <Truck size={20} />
          </div>
          {recentTransfers.length ? (
            <div className="college-mini-list">
              {recentTransfers.map((item) => (
                <div className="college-mini-row" key={item.id}>
                  <div>
                    <strong>{item.asset}</strong>
                    <small>{item.fromDepartment} → {item.toDepartment}</small>
                  </div>
                  <span>{item.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="college-empty-state">No recent transfers</p>
          )}
        </section>
      </div>

      <div className="college-dashboard-lower">
        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>Recent Returns</h2>
              <p>Returned assets and status updates.</p>
            </div>
            <RotateCcw size={20} />
          </div>
          {recentReturns.length ? (
            <div className="college-mini-list">
              {recentReturns.map((item) => (
                <div className="college-mini-row" key={item.id}>
                  <div>
                    <strong>{item.asset}</strong>
                    <small>{item.returnedBy}</small>
                  </div>
                  <span>{item.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="college-empty-state">No recent returns</p>
          )}
        </section>

        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>Maintenance Overview</h2>
              <p>Maintenance activity within the college.</p>
            </div>
            <Wrench size={20} />
          </div>
          {maintenance && (maintenance.total || maintenance.open || maintenance.completed) ? (
            <div className="college-stats-grid">
              <div><strong>{maintenance.total || 0}</strong><span>Total</span></div>
              <div><strong>{maintenance.open || 0}</strong><span>Open</span></div>
              <div><strong>{maintenance.completed || 0}</strong><span>Completed</span></div>
            </div>
          ) : (
            <p className="college-empty-state">No maintenance data available</p>
          )}
        </section>
      </div>

      <div className="college-dashboard-lower">
        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>Asset Verification</h2>
              <p>Verification summary for this college.</p>
            </div>
            <ShieldCheck size={20} />
          </div>
          {verification && (verification.total || verification.pending || verification.verified) ? (
            <div className="college-stats-grid">
              <div><strong>{verification.total || 0}</strong><span>Total</span></div>
              <div><strong>{verification.pending || 0}</strong><span>Pending</span></div>
              <div><strong>{verification.verified || 0}</strong><span>Verified</span></div>
            </div>
          ) : (
            <p className="college-empty-state">No verification records available</p>
          )}
        </section>

        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>College Overview</h2>
              <p>Authorized college details.</p>
            </div>
            <MapPin size={20} />
          </div>
          <dl className="college-overview-list">
            <dt>College</dt><dd>{college.name || 'Not available'}</dd>
            <dt>Code</dt><dd>{college.code || 'Not available'}</dd>
            <dt>Manager</dt><dd>{college.manager || 'Not available'}</dd>
            <dt>Departments</dt><dd>{summary.departments ?? 0}</dd>
            <dt>Staff</dt><dd>{summary.staff ?? 0}</dd>
            <dt>Assets</dt><dd>{summary.totalAssets ?? 0}</dd>
          </dl>
        </section>
      </div>

      <section className="college-dashboard-card">
        <div className="college-section-heading">
          <div>
            <h2>Recent Activity</h2>
            <p>Latest college events and records.</p>
          </div>
          <RefreshCw size={20} />
        </div>
        {recentActivity.length ? (
          <div className="college-activity-list">
            {recentActivity.map((item, index) => (
              <div className="college-activity-row" key={`${item.type}-${item.timestamp || index}`}>
                <span className="college-activity-dot" />
                <div>
                  <strong>{item.type}</strong>
                  <p>{item.description}</p>
                  <small>{item.actor || 'System'} · {formatDate(item.timestamp)}{item.status ? ` · ${item.status}` : ''}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="college-empty-state">No recent activity</p>
        )}
      </section>

      <section className="college-dashboard-card college-actions-section">
        <div className="college-section-heading">
          <div>
            <h2>Quick Actions</h2>
            <p>Common college workflows.</p>
          </div>
          <ArrowRight size={20} />
        </div>
        <div className="college-actions-grid">
          {quickActions.map(([to, label, Icon]) => (
            <Link className="college-action-card" key={to} to={to}>
              <span className="college-action-icon"><Icon size={19} /></span>
              <span className="college-action-copy">
                <strong>{label}</strong>
                <small>Open {label.toLowerCase()}</small>
              </span>
              <ArrowRight className="college-action-arrow" size={18} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CollegeDashboard;
