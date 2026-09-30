import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MaintDashboard from './MaintDashboard';
import { getMaintenanceDashboard } from '../../services/maintenanceApi';

jest.mock('../../services/maintenanceApi', () => ({ getMaintenanceDashboard: jest.fn() }));

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
  getMaintenanceDashboard.mockReset();
  getMaintenanceDashboard.mockResolvedValue(dashboardData);
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
  getMaintenanceDashboard.mockRejectedValue(new Error('database offline'));

  render(<MemoryRouter><MaintDashboard /></MemoryRouter>);

  expect(await screen.findByRole('alert')).toHaveTextContent('database offline');
  expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
});