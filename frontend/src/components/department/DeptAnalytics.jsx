import React, { useCallback, useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip } from 'chart.js';
import { Activity, AlertTriangle, Boxes, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import apiClient, { getApiErrorMessage } from '../../services/apiClient';
import { useLanguage } from '../../contexts/UiContext';
import './DeptAnalytics.css';

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const EMPTY_ANALYTICS = {
  assetUtilization: { statuses: [], total: 0, assignments: [], activeAssignments: 0 },
  assetCondition: { conditions: [], discrepancies: 0 },
  inventory: { totalItems: 0, quantity: 0, available: 0, reserved: 0, damaged: 0, lowStock: 0 },
  approvals: [],
  service: { statuses: [], maintenanceStatuses: {} },
  ticketAging: { under24Hours: 0, from24To72Hours: 0, over72Hours: 0, escalated: 0, overdue: 0 },
  transfers: [],
  laboratories: 0,
};

const labels = (rows = []) => rows.map((row) => row.label);
const values = (rows = []) => rows.map((row) => Number(row.count || 0));

const DeptAnalytics = () => {
  const { theme } = useLanguage();
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/department-head/analytics');
      setAnalytics({ ...EMPTY_ANALYTICS, ...(response.data?.data || {}) });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load department analytics.'));
      setAnalytics(EMPTY_ANALYTICS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const palette = ['#124a72', '#2f82a4', '#36a889', '#e0aa44', '#d96666', '#7866b3', '#94a3b8'];
  const doughnutOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
  const chartData = (rows, title) => ({
    labels: labels(rows),
    datasets: [{ label: title, data: values(rows), backgroundColor: palette, borderWidth: 0 }],
  });

  return (
    <main className={`department-analytics${theme === 'dark' ? ' is-dark' : ''}`}>
      <header className="department-analytics__header">
        <div>
          <p>Department Head</p>
          <h1>Department Analytics</h1>
          <span>Utilization, asset condition, inventory, approvals, service performance and ticket age.</span>
        </div>
        <button type="button" onClick={loadAnalytics} disabled={loading} aria-label="Refresh analytics">
          <RefreshCw size={17} aria-hidden="true" /> Refresh
        </button>
      </header>

      {error && <div className="department-analytics__error" role="alert">{error}</div>}
      {loading ? (
        <div className="department-analytics__state" role="status">Loading department analytics...</div>
      ) : (
        <>
          <section className="department-analytics__metrics" aria-label="Analytics summary">
            <Metric icon={Boxes} label="Assets tracked" value={analytics.assetUtilization.total} />
            <Metric icon={Activity} label="Active assignments" value={analytics.assetUtilization.activeAssignments} />
            <Metric icon={AlertTriangle} label="Inventory low stock" value={analytics.inventory.lowStock} />
            <Metric icon={ShieldCheck} label="Verification discrepancies" value={analytics.assetCondition.discrepancies} />
            <Metric icon={Wrench} label="Tickets over 72 hours" value={analytics.ticketAging.over72Hours} />
          </section>
          <section className="department-analytics__charts">
            <Chart title="Asset utilization and status">
              <Doughnut data={chartData(analytics.assetUtilization.statuses, 'Assets')} options={doughnutOptions} />
            </Chart>
            <Chart title="Asset condition">
              <Doughnut data={chartData(analytics.assetCondition.conditions, 'Assets')} options={doughnutOptions} />
            </Chart>
            <Chart title="Service request status">
              <Bar data={chartData(analytics.service.statuses, 'Requests')} options={barOptions} />
            </Chart>
            <Chart title="Approval status">
              <Bar data={chartData(analytics.approvals, 'Approvals')} options={barOptions} />
            </Chart>
            <Chart title="Inventory quantities">
              <Bar
                data={{
                  labels: ['Total', 'Available', 'Reserved', 'Damaged', 'Low stock'],
                  datasets: [{
                    label: 'Inventory',
                    data: [
                      analytics.inventory.quantity,
                      analytics.inventory.available,
                      analytics.inventory.reserved,
                      analytics.inventory.damaged,
                      analytics.inventory.lowStock,
                    ],
                    backgroundColor: palette,
                    borderRadius: 4,
                  }],
                }}
                options={barOptions}
              />
            </Chart>
            <Chart title="Ticket aging">
              <Bar
                data={{
                  labels: ['Under 24 hours', '24–72 hours', 'Over 72 hours', 'Escalated', 'Overdue'],
                  datasets: [{
                    label: 'Tickets',
                    data: [
                      analytics.ticketAging.under24Hours,
                      analytics.ticketAging.from24To72Hours,
                      analytics.ticketAging.over72Hours,
                      analytics.ticketAging.escalated,
                      analytics.ticketAging.overdue,
                    ],
                    backgroundColor: palette,
                    borderRadius: 4,
                  }],
                }}
                options={barOptions}
              />
            </Chart>
          </section>
        </>
      )}
    </main>
  );
};

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  plugins: { legend: { display: false } },
};

const Metric = ({ icon: Icon, label, value }) => (
  <article className="department-analytics__metric">
    <Icon size={20} aria-hidden="true" />
    <span>{label}</span>
    <strong>{Number(value || 0).toLocaleString()}</strong>
  </article>
);

const Chart = ({ title, children }) => (
  <article className="department-analytics__chart">
    <h2>{title}</h2>
    <div>{children}</div>
  </article>
);

export default DeptAnalytics;
