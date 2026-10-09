import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, BarChart3, Building2, CheckCircle2, ClipboardCheck, ClipboardList, MapPin, Package, RotateCcw, ShieldCheck, Truck, Wrench } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useTranslation } from '../../contexts/UiContext';
import './CollegeDashboard.css';

const quickActions = [
  ['/college/assets', 'manageAssets', Package],
  ['/college/departments', 'departments', Building2],
  ['/college/requests', 'assetRequests', ClipboardList],
  ['/college/assignments', 'assignments', ClipboardCheck],
  ['/college/transfers', 'transfers', Truck],
  ['/college/verification', 'verification', ShieldCheck],
];
const collegeQuickActions = [
  ['/college/assets', 'collegeAssets', Package],
  ['/college/requests', 'collegeRequests', ClipboardList],
  ['/college/assignments', 'assignments', ClipboardCheck],
  ['/college/history', 'collegeActivity', Activity],
];

const normalizeLabel = (value = '') => String(value).replace(/[_-]+/g, ' ').trim();

const CollegeDashboard = ({ audience = 'manager' }) => {
  const { t } = useTranslation();
  const tr = (key, fallback, values) => t(`dashboard.collegeHome.${key}`, fallback, values);
  const isManager = audience === 'manager';
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
  const assetCondition = data.assetCondition || data.conditionDistribution || [];
  const departmentDistribution = data.departmentDistribution || [];
  const pendingRequests = data.pendingRequests || [];
  const recentAssignments = data.recentAssignments || [];
  const recentTransfers = data.recentTransfers || [];
  const recentReturns = data.recentReturns || [];
  const maintenance = data.maintenance || {};
  const verification = data.verification || {};

  const metrics = useMemo(() => [
    ['totalAssets', 'totalAssets', 'totalAssetsDescription', Package, 'blue', '/college/assets'],
    ['activeAssets', 'activeAssets', 'activeAssetsDescription', CheckCircle2, 'green', '/college/assets'],
    ['damagedAssets', 'damagedAssets', 'damagedAssetsDescription', ShieldCheck, 'orange', '/college/assets'],
    ['underMaintenance', 'underMaintenance', 'underMaintenanceDescription', Wrench, 'amber', '/college/maintenance'],
    ['pendingRequests', 'pendingRequests', 'pendingRequestsDescription', ClipboardList, 'amber', '/college/requests'],
    ['pendingApprovals', 'pendingApprovals', 'pendingApprovalsDescription', ClipboardCheck, 'cyan', '/college/approvals'],
    ['openMaintenance', 'openMaintenance', 'openMaintenanceDescription', Wrench, 'red', '/college/maintenance'],
    ['verificationProgress', 'verificationProgress', null, ShieldCheck, 'teal', '/college/verification'],
  ], []);
  const visibleMetrics = isManager ? metrics : metrics.filter(([key]) => ['totalAssets', 'activeAssets', 'pendingRequests'].includes(key));

  const maxStatusValue = Math.max(1, ...assetStatus.map((item) => Number(item.value) || 0));
  const maxConditionValue = Math.max(1, ...assetCondition.map((item) => Number(item.value) || 0));
  const verificationProgressValue = summary.verificationProgress || (verification.total ? `${verification.verified || 0} / ${verification.total}` : '0 / 0');
  const displayedError = state.error === 'Unable to load college dashboard'
    ? tr('loadError')
    : state.error;

  if (state.loading) {
    return (
      <div className="college-dashboard" aria-live="polite" aria-busy="true">
        <div className="college-dashboard-hero college-dashboard-hero--loading">
          <div>
            <span className="college-eyebrow">{tr(isManager ? 'managerRole' : 'collegeRole')}</span>
            <h1>{tr(isManager ? 'managerTitle' : 'title')}</h1>
            <p>{tr('loadingDescription')}</p>
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
        <strong>{tr('loadError')}</strong>
        <span>{displayedError}</span>
        <button type="button" onClick={loadDashboard}>{tr('retry')}</button>
      </div>
    );
  }

  if (!data || !Object.keys(data).length) {
    return <div className="college-dashboard-state">{tr('noData')}</div>;
  }

  return (
    <div className="college-dashboard">
      <div className="college-dashboard-hero">
        <div>
          <span className="college-eyebrow">{tr(isManager ? 'managerRole' : 'collegeRole')}</span>
          <h1>{tr(isManager ? 'managerTitle' : 'title')}</h1>
          <p>{tr(isManager ? 'managerDescription' : 'collegeDescription')}</p>
          <p className="college-hero-subtitle">{tr('authorizedCollege')} {college.name || tr('currentCollege')}</p>
        </div>
        <div className="college-college-badge">
          <Building2 size={20} />
          <strong>{college.name || tr('collegeRole')}</strong>
          <span>{college.code || tr('noCode')}</span>
        </div>
      </div>

      <div className="college-dashboard-kpis">
        {visibleMetrics.map(([key, labelKey, descriptionKey, Icon, tone, to]) => {
          const value = key === 'verificationProgress'
            ? verificationProgressValue
            : Number(summary[key] || 0).toLocaleString();

          return (
            <Link className="college-kpi-card" key={key} to={to}>
              <div className={`college-kpi-icon college-kpi-icon--${tone}`}>
                <Icon size={21} aria-hidden="true" />
              </div>
              <strong className="college-kpi-value">{value}</strong>
              <span className="college-kpi-label">{tr(`metrics.${labelKey}`)}</span>
              {descriptionKey && <small>{tr(`metrics.${descriptionKey}`)}</small>}
            </Link>
          );
        })}
      </div>

      <div className="college-dashboard-charts">
        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>{tr('assetStatus')}</h2>
              <p>{tr('assetStatusDescription')}</p>
            </div>
            <BarChart3 size={20} />
          </div>
          {assetStatus.length ? (
            <div className="college-chart-list">
              {assetStatus.map((item) => (
                <div className="college-chart-row" key={`${item.label}-${item.value}`}>
                  <div className="college-chart-row-label">
                    <span>{normalizeLabel(item.label) || tr('unknown')}</span>
                    <strong>{item.value}</strong>
                  </div>
                  <div className="college-chart-track">
                    <span className="college-chart-bar--status" style={{ width: `${((Number(item.value) || 0) / maxStatusValue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="college-empty-state">{tr('noAssetStatus')}</p>
          )}
        </section>

        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>{tr('assetCondition')}</h2>
              <p>{tr('assetConditionDescription')}</p>
            </div>
            <ShieldCheck size={20} />
          </div>
          {assetCondition.length ? (
            <div className="college-chart-list">
              {assetCondition.map((item) => (
                <div className="college-chart-row" key={`${item.label}-${item.value}`}>
                  <div className="college-chart-row-label">
                    <span>{normalizeLabel(item.label) || tr('unknown')}</span>
                    <strong>{item.value}</strong>
                  </div>
                  <div className="college-chart-track">
                    <span className="college-chart-bar--status" style={{ width: `${((Number(item.value) || 0) / maxConditionValue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="college-empty-state">{tr('noAssetCondition')}</p>
          )}
        </section>

        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>{tr('requestsAttention')}</h2>
              <p>{tr('requestsAttentionDescription')}</p>
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
            <p className="college-empty-state">{tr('noPendingRequests')}</p>
          )}
          <Link className="college-primary-link" to="/college/requests">
            {tr('viewRequests')} <ArrowRight size={16} />
          </Link>
        </section>
      </div>

      <section className="college-dashboard-card college-table-section">
        <div className="college-section-heading">
          <div>
            <h2>{tr('assetsByDepartment')}</h2>
            <p>{tr('departmentDistributionDescription')}</p>
          </div>
          <Building2 size={20} />
        </div>
        {departmentDistribution.length ? (
          <div className="college-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr('department')}</th>
                  <th>{tr('assets')}</th>
                  <th>{tr('available')}</th>
                  <th>{tr('assigned')}</th>
                  <th>{tr('maintenance')}</th>
                  <th>{tr('missing')}</th>
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
          <p className="college-empty-state">{tr('noDistribution')}</p>
        )}
      </section>

      <div className="college-dashboard-lower">
        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>{tr('recentAssignments')}</h2>
              <p>{tr('recentAssignmentsDescription')}</p>
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
            <p className="college-empty-state">{tr('noRecentAssignments')}</p>
          )}
        </section>

        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>{tr('recentTransfers')}</h2>
              <p>{tr('recentTransfersDescription')}</p>
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
            <p className="college-empty-state">{tr('noRecentTransfers')}</p>
          )}
        </section>
      </div>

      <div className="college-dashboard-lower">
        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>{tr('recentReturns')}</h2>
              <p>{tr('recentReturnsDescription')}</p>
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
            <p className="college-empty-state">{tr('noRecentReturns')}</p>
          )}
        </section>

        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>{tr('maintenanceOverview')}</h2>
              <p>{tr('maintenanceOverviewDescription')}</p>
            </div>
            <Wrench size={20} />
          </div>
          {maintenance && (maintenance.total || maintenance.open || maintenance.completed) ? (
            <div className="college-stats-grid">
              <div><strong>{maintenance.total || 0}</strong><span>{tr('total')}</span></div>
              <div><strong>{maintenance.open || 0}</strong><span>{tr('open')}</span></div>
              <div><strong>{maintenance.completed || 0}</strong><span>{tr('completed')}</span></div>
            </div>
          ) : (
            <p className="college-empty-state">{tr('noMaintenance')}</p>
          )}
        </section>
      </div>

      <div className="college-dashboard-lower">
        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>{tr('verification')}</h2>
              <p>{tr('verificationDescription')}</p>
            </div>
            <ShieldCheck size={20} />
          </div>
          {verification && (verification.total || verification.pending || verification.verified) ? (
            <div className="college-stats-grid">
              <div><strong>{verification.total || 0}</strong><span>{tr('total')}</span></div>
              <div><strong>{verification.pending || 0}</strong><span>{tr('pending')}</span></div>
              <div><strong>{verification.verified || 0}</strong><span>{tr('verified')}</span></div>
            </div>
          ) : (
            <p className="college-empty-state">{tr('noVerification')}</p>
          )}
        </section>

        <section className="college-dashboard-card">
          <div className="college-section-heading">
            <div>
              <h2>{tr('collegeOverview')}</h2>
              <p>{tr('collegeDetails')}</p>
            </div>
            <MapPin size={20} />
          </div>
          <dl className="college-overview-list">
            <dt>{tr('collegeLabel')}</dt><dd>{college.name || tr('notAvailable')}</dd>
            <dt>{tr('code')}</dt><dd>{college.code || tr('notAvailable')}</dd>
            <dt>{tr('managerLabel')}</dt><dd>{college.manager || tr('notAvailable')}</dd>
            <dt>{tr('departments')}</dt><dd>{summary.departments ?? 0}</dd>
            <dt>{tr('staff')}</dt><dd>{summary.staff ?? 0}</dd>
            <dt>{tr('assets')}</dt><dd>{summary.totalAssets ?? 0}</dd>
          </dl>
        </section>
      </div>

      <section className="college-dashboard-card college-actions-section">
        <div className="college-section-heading">
          <div>
            <h2>{tr('quickActions')}</h2>
            <p>{tr('quickActionsDescription')}</p>
          </div>
          <ArrowRight size={20} />
        </div>
        <div className="college-actions-grid">
          {(isManager ? quickActions : collegeQuickActions).map(([to, actionKey, Icon]) => {
            const label = tr(`actions.${actionKey}`);
            return (
            <Link className="college-action-card" key={to} to={to}>
              <span className="college-action-icon"><Icon size={19} /></span>
              <span className="college-action-copy">
                <strong>{label}</strong>
                <small>{tr('openAction', undefined, { action: label })}</small>
              </span>
              <ArrowRight className="college-action-arrow" size={18} />
            </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default CollegeDashboard;
