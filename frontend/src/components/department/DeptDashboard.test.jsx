import React, { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeptDashboard from './DeptDashboard';
import apiClient from '../../services/apiClient';

let mockLanguage = 'en';

jest.mock('../../services/apiClient', () => ({ get: jest.fn() }));
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { fullName: 'Department Head' } }),
}));
jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: mockLanguage }),
}));
jest.mock('react-chartjs-2', () => ({
  Doughnut: ({ data }) => <div data-testid="doughnut-chart">{data.datasets[0].data.join(',')}</div>,
  Pie: ({ data }) => <div data-testid="pie-chart">{data.datasets[0].data.join(',')}</div>,
}));

const emptyDashboard = {
  department: { id: 4, name: 'Engineering', code: 'ENG' },
  totalAssets: 0,
  activeAssets: 0,
  damagedAssets: 0,
  underMaintenance: 0,
  availableAssets: 0,
  assignedAssets: 0,
  pendingAcquisitionRequests: 0,
  pendingApprovals: 0,
  openServiceRequests: 0,
  overdueTickets: 0,
  escalatedTickets: 0,
  laboratories: 0,
  assetByStatus: [],
  assetByCategory: [],
  serviceRequestStatus: [],
  acquisitionRequestStatus: [],
  recentActivities: [],
};

const successfulResponse = (dashboard = emptyDashboard) => ({ data: { success: true, data: dashboard } });

beforeEach(() => {
  mockLanguage = 'en';
  apiClient.get.mockReset();
});

test('shows an accessible dashboard skeleton while the API request is pending', () => {
  apiClient.get.mockReturnValue(new Promise(() => {}));
  render(<StrictMode><DeptDashboard /></StrictMode>);
  expect(screen.getByRole('main', { name: 'Loading department dashboard' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Loading department dashboard');
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(apiClient.get).toHaveBeenCalledWith('/department/dashboard');
});

test('renders authorized department, actual KPI values, and valid empty states', async () => {
  apiClient.get.mockResolvedValue(successfulResponse());
  render(<DeptDashboard />);

  expect(await screen.findByText(/Engineering/)).toBeInTheDocument();
  expect(screen.getByText('This department has no assets or recent activities yet.')).toBeInTheDocument();
  expect(screen.getAllByText('No data available for this chart.')).toHaveLength(4);
  expect(screen.getByText('No recent department activities.')).toBeInTheDocument();
  expect(screen.getAllByText('0')).toHaveLength(12);
});

test('shows a server error and retries without converting the failure to empty KPI values', async () => {
  apiClient.get
    .mockRejectedValueOnce({ response: { status: 500 } })
    .mockResolvedValueOnce(successfulResponse());
  render(<DeptDashboard />);

  expect(await screen.findByRole('alert')).toHaveTextContent('server error');
  expect(screen.queryByText('This department has no assets or recent activities yet.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('This department has no assets or recent activities yet.')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledTimes(2);
});

test('provides specific authentication, authorization, not-found, and network error states', async () => {
  const failures = [
    [{ response: { status: 401 } }, 'session has expired', 'Sign in'],
    [{ response: { status: 403 } }, 'not authorized', null],
    [{ response: { status: 404 } }, 'could not be found', 'Retry'],
    [{ isAxiosError: true }, 'Check your connection', 'Retry'],
    [{ isAxiosError: true, code: 'ECONNABORTED', message: 'timeout exceeded' }, 'Check your connection', 'Retry'],
  ];

  for (const [failure, message, action] of failures) {
    apiClient.get.mockRejectedValueOnce(failure);
    const view = render(<DeptDashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    if (action) expect(screen.getByRole('button', { name: action })).toBeInTheDocument();
    else expect(screen.queryByRole('button')).not.toBeInTheDocument();
    view.unmount();
  }
});

test('renders dashboard labels in Amharic', async () => {
  mockLanguage = 'am';
  apiClient.get.mockResolvedValue(successfulResponse());
  render(<DeptDashboard />);
  expect(await screen.findByRole('heading', { name: 'የዲፓርትመንት ኃላፊ ዳሽቦርድ' })).toBeInTheDocument();
  expect(screen.getByText('ያለ ምደባ የሚገኙ ንብረቶች')).toBeInTheDocument();
});

test('refreshes once and prevents another request while the refresh is in flight', async () => {
  apiClient.get.mockResolvedValueOnce(successfulResponse());
  render(<DeptDashboard />);
  await screen.findByText('This department has no assets or recent activities yet.');

  const updatedDashboard = {
    ...emptyDashboard,
    totalAssets: 5,
    activeAssets: 5,
    assetByStatus: [{ label: 'Active', value: 5 }],
    assetByCategory: [{ label: 'Computing', value: 5 }],
    recentActivities: [{
      id: 'activity-1',
      user: 'Asset Officer',
      action: 'Asset assignment',
      entity: 'Laptop-5',
      status: 'Assigned',
      date: '2026-10-05T10:00:00Z',
    }],
  };
  let resolveRefresh;
  apiClient.get.mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = () => resolve(successfulResponse(updatedDashboard)); }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button', { name: 'Refresh dashboard' })).toBeDisabled();

  resolveRefresh();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh dashboard' })).toBeEnabled());
  expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('Asset Officer')).toBeInTheDocument();
  expect(screen.getAllByTestId('doughnut-chart')[0]).toHaveTextContent('5');
});

test('searches recent activity fields and paginates the results', async () => {
  const activities = Array.from({ length: 7 }, (_, index) => ({
    id: `activity-${index + 1}`,
    user: index === 6 ? 'Unique Officer' : `Officer ${index + 1}`,
    action: 'Asset assignment',
    entity: `Laptop-${index + 1}`,
    status: 'Assigned',
    date: `2026-10-0${index + 1}T10:00:00Z`,
  }));
  apiClient.get.mockResolvedValue(successfulResponse({
    ...emptyDashboard,
    totalAssets: 7,
    recentActivities: activities,
  }));
  render(<DeptDashboard />);

  expect(await screen.findByText('Unique Officer')).toBeInTheDocument();
  expect(screen.getByText('Laptop-7')).toBeInTheDocument();
  expect(screen.queryByText('Laptop-2')).not.toBeInTheDocument();
  const paginationStartedAt = performance.now();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(performance.now() - paginationStartedAt).toBeLessThan(500);
  expect(screen.getByText('Laptop-2')).toBeInTheDocument();
  expect(screen.getByText('Officer 2')).toBeInTheDocument();

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search activities' }), { target: { value: 'officer 1' } });
  expect(screen.getByText('Officer 1')).toBeInTheDocument();
  expect(screen.queryByText('Officer 2')).not.toBeInTheDocument();
  expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
});

test('filters recent activities and sorts the filtered results', async () => {
  apiClient.get.mockResolvedValue(successfulResponse({
    ...emptyDashboard,
    totalAssets: 2,
    recentActivities: [
      { id: 'older', user: 'Zed', action: 'Asset assignment', entity: 'Laptop-1', status: 'Assigned', date: '2026-10-04T10:00:00Z' },
      { id: 'newer', user: 'Ada', action: 'Asset transfer', entity: 'Laptop-2', status: 'Completed', date: '2026-10-05T10:00:00Z' },
    ],
  }));
  render(<DeptDashboard />);

  expect(await screen.findByText('Ada')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'user' } });
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Zed');
  fireEvent.click(screen.getByRole('button', { name: 'Ascending' }));
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Ada');

  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by action' }), { target: { value: 'Asset assignment' } });
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Laptop-1');
  expect(screen.queryByText('Laptop-2')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by action' }), { target: { value: '' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), { target: { value: 'Completed' } });
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Laptop-2');
});

test('renders each chart series and the accessible recent-activity table', async () => {
  apiClient.get.mockResolvedValue(successfulResponse({
    ...emptyDashboard,
    totalAssets: 3,
    assetByStatus: [{ label: 'Active', value: 2 }, { label: 'Damaged', value: 1 }],
    assetByCategory: [{ label: 'Computing', value: 3 }],
    serviceRequestStatus: [{ label: 'Submitted', value: 1 }],
    acquisitionRequestStatus: [{ label: 'Under Review', value: 2 }],
    recentActivities: [{
      id: 'activity-1',
      user: 'Asset Officer',
      action: 'Asset assignment',
      entity: 'Laptop-5',
      status: 'Assigned',
      date: '2026-10-05T10:00:00Z',
    }],
  }));
  render(<DeptDashboard />);

  expect(await screen.findByRole('heading', { name: 'Department Head Dashboard' })).toBeInTheDocument();
  expect(screen.getAllByTestId('doughnut-chart').map((chart) => chart.textContent)).toEqual(['2,1', '1', '2']);
  expect(screen.getByTestId('pie-chart')).toHaveTextContent('3');
  const table = screen.getByRole('table', { name: 'Recent Activities' });
  expect(table).toHaveAccessibleName();
  expect(screen.getByRole('columnheader', { name: 'User' })).toBeInTheDocument();
  expect(screen.getByRole('row', { name: /Asset Officer Asset assignment Laptop-5 Assigned/ })).toBeInTheDocument();
});

test('meets the dashboard initial-render budget with an available API response', async () => {
  apiClient.get.mockResolvedValue(successfulResponse());
  const startedAt = performance.now();
  render(<DeptDashboard />);

  expect(await screen.findByText('This department has no assets or recent activities yet.')).toBeInTheDocument();
  expect(performance.now() - startedAt).toBeLessThan(2000);
});

test('keeps the KPI grid and activity table usable at mobile breakpoints', () => {
  const fs = require('fs');
  const path = require('path');
  const styles = fs.readFileSync(path.resolve(__dirname, 'DeptDashboard.css'), 'utf8');

  expect(styles).toMatch(/@media\s*\(max-width:\s*760px\)/);
  expect(styles).toMatch(/\.dept-dashboard__stats\s*\{[^}]*grid-template-columns:\s*1fr/s);
  expect(styles).toMatch(/\.dept-dashboard__charts\s*\{[^}]*grid-template-columns:\s*1fr/s);
  expect(styles).toMatch(/\.dept-dashboard__activity-table\s*,[^}]*display:\s*block/s);
});
