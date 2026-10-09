import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MaintDashboard from './MaintDashboard';
import { getMaintenanceDashboard } from '../../services/maintenanceApi';
import { UiProvider, useLanguage } from '../../contexts/UiContext';

jest.mock('../../services/maintenanceApi', () => ({ getMaintenanceDashboard: jest.fn() }));
jest.mock('../../i18n/messages', () => ({
  translateMessage: (language, key, fallback) => {
    if (language !== 'am') return fallback || key;

    const amharic = {
      'dashboard.maintenanceHome.title': 'የጥገና ዳሽቦርድ',
      'dashboard.maintenanceHome.totalRequests': 'ጠቅላላ የጥገና ጥያቄዎች',
      'dashboard.maintenanceHome.quickActions': 'ፈጣን እርምጃዎች',
    };
    return amharic[key] || fallback || key;
  },
}));

function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <button type="button" onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}>
      Switch language
    </button>
  );
}

const dashboardData = {
  summary: {
    totalRequests: 4,
    pendingRequests: 1,
    inProgress: 1,
    completedRepairs: 2,
    overdueWorkOrders: 1,
    assetsUnderMaintenance: 1,
    waitingForParts: 1,
    inTesting: 1,
    assignedStaff: 1,
    technicianEfficiency: 50,
    criticalAlerts: 2,
    hasRecords: true,
  },
  statusDistribution: [{ status: 'in-progress', label: 'In Progress', count: 1 }],
  monthlyTrend: [{ period: '2026-09', requests: 4, completed: 2 }],
  workPhases: { completedJobs: 2, waitingForParts: 1, testing: 1 },
  technicianWorkload: [{ technicianId: 7, name: 'Aster Technician', assigned: 2, inProgress: 1, completed: 1 }],
  recentRequests: [{ id: 11, requestId: 'REQ-011', asset: 'Lecture Hall Projector', status: 'In Progress', priority: 'High', dueDate: null }],
  recentWorkOrders: [{ id: 19, workOrderNumber: 'WO-019', asset: 'Lecture Hall Projector', technician: 'Aster Technician', status: 'In Progress', assignedDate: '2026-09-28' }],
  nextScheduledMaintenance: { asset: 'Generator A', maintenanceType: 'Inspection', scheduledDate: '2026-10-05', technician: 'Aster Technician' },
};

beforeEach(() => {
  localStorage.setItem('language', 'en');
  getMaintenanceDashboard.mockReset();
  getMaintenanceDashboard.mockResolvedValue(dashboardData);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders backend dashboard metrics through the maintenance API service', async () => {
  render(<MemoryRouter><MaintDashboard /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Maintenance Dashboard' })).toBeInTheDocument();
  expect(screen.getByText('Total Maintenance Requests').closest('.maintenance-kpi-card')).toHaveTextContent('4');
  expect(screen.getAllByText('New Requests')[0].closest('.maintenance-kpi-card')).toHaveTextContent('1');
  expect(getMaintenanceDashboard).toHaveBeenCalledTimes(1);
});

test('renders zero-valued metrics when the database has no maintenance records', async () => {
  getMaintenanceDashboard.mockResolvedValue({
    summary: { totalRequests: 0, pendingRequests: 0, inProgress: 0, completedRepairs: 0, overdueWorkOrders: 0, assetsUnderMaintenance: 0, waitingForParts: 0, inTesting: 0, assignedStaff: 0, technicianEfficiency: null, criticalAlerts: 0, hasRecords: false },
    statusDistribution: [],
    monthlyTrend: [],
    workPhases: { completedJobs: 0, waitingForParts: 0, testing: 0 },
    technicianWorkload: [],
    recentRequests: [],
    recentWorkOrders: [],
    nextScheduledMaintenance: null,
  });

  render(<MemoryRouter><MaintDashboard /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Maintenance Dashboard' })).toBeInTheDocument();
  expect(screen.getByText('Total Maintenance Requests').closest('.maintenance-kpi-card')).toHaveTextContent('0');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows a connection error instead of presenting zero-valued metrics', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  getMaintenanceDashboard.mockRejectedValue(new Error('database offline'));

  render(<MemoryRouter><MaintDashboard /></MemoryRouter>);

  expect(await screen.findByRole('alert')).toHaveTextContent('database offline');
  expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  expect(errorLog).toHaveBeenCalledWith('Maintenance dashboard error:', expect.any(Error));
});

test('switches dashboard text to Amharic without requesting dashboard data again', async () => {
  render(
    <UiProvider>
      <MemoryRouter>
        <LanguageSwitch />
        <MaintDashboard />
      </MemoryRouter>
    </UiProvider>
  );

  expect(await screen.findByRole('heading', { name: 'Maintenance Dashboard' })).toBeInTheDocument();
  expect(screen.getByText('Total Maintenance Requests')).toBeInTheDocument();
  expect(getMaintenanceDashboard).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));

  expect(await screen.findByRole('heading', { name: 'የጥገና ዳሽቦርድ' })).toBeInTheDocument();
  expect(screen.getByText('ጠቅላላ የጥገና ጥያቄዎች')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'ፈጣን እርምጃዎች' })).toBeInTheDocument();
  expect(getMaintenanceDashboard).toHaveBeenCalledTimes(1);
});