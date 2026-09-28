import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MaintReports from './MaintReports';
import MaintWorkOrders from './MaintWorkOrders';
import MaintPreventive from './MaintPreventive';
import { getMaintenance, getMaintenanceDashboard, getMaintenanceCalendar, getRepairHistory, getTechnicians } from '../../services/maintenanceApi';
import apiClient from '../../services/apiClient';

jest.mock('../../contexts/UiContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../../services/maintenanceApi', () => ({
  getMaintenance: jest.fn(),
  getMaintenanceDashboard: jest.fn(),
  getMaintenanceCalendar: jest.fn(),
  getRepairHistory: jest.fn(),
  getTechnicians: jest.fn(),
  getInventory: jest.fn(),
  getAssets: jest.fn(),
}));
jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

beforeEach(() => {
  getMaintenance.mockResolvedValue([]);
  getMaintenanceDashboard.mockResolvedValue({});
  getMaintenanceCalendar.mockResolvedValue({ items: [] });
  getRepairHistory.mockResolvedValue({ records: [], stats: {} });
  getTechnicians.mockResolvedValue([]);
  jest.requireMock('../../services/maintenanceApi').getInventory.mockResolvedValue([]);
});

test('selected report period is sent to the persisted repair history API', async () => {
  render(<MaintReports />);

  await waitFor(() => expect(getRepairHistory).toHaveBeenCalled());
  fireEvent.change(await screen.findByRole('combobox'), { target: { value: '30days' } });

  await waitFor(() => expect(getRepairHistory).toHaveBeenLastCalledWith(expect.objectContaining({ period: '30days' })));
});

test('maintenance work orders are rendered from real maintenance records', async () => {
  apiClient.get.mockResolvedValue({
    data: {
      data: [
        { id: 1, assetName: 'Laptop A', title: 'Keyboard replacement', priority: 'High', status: 'In Progress', statusRaw: 'in-progress', technician: 'Jane Doe', createdAt: '2026-09-28T00:00:00Z' },
        { id: 2, assetName: 'Projector B', title: 'Lamp check', priority: 'Medium', status: 'Testing', statusRaw: 'testing', technician: 'John Smith', createdAt: '2026-09-27T00:00:00Z' },
      ],
      summary: { total: 2, open: 1, inProgress: 1, onHold: 0, completed: 0, overdue: 0 },
      pagination: { page: 1, pages: 1, total: 2, limit: 10 },
    },
  });

  render(<MaintWorkOrders />);

  expect(await screen.findByText('Work Orders')).toBeInTheDocument();
  expect(await screen.findByText('Laptop A')).toBeInTheDocument();
  expect(screen.getByText('Projector B')).toBeInTheDocument();
  expect(screen.queryByText(/No Maintenance-owned persisted/i)).not.toBeInTheDocument();
});

test('preventive maintenance is derived from actual maintenance records and not placeholder text', async () => {
  getMaintenance.mockResolvedValue([
    { id: 3, asset: 'Server Rack', title: 'Inspection cycle', priority: 'Medium', status: 'Completed', statusRaw: 'completed', created: '2026-09-20T00:00:00Z', updated: '2026-09-22T00:00:00Z' },
    { id: 4, asset: 'Generator', title: 'Service check', priority: 'Critical', status: 'Pending', statusRaw: 'pending', created: '2026-09-15T00:00:00Z', updated: '2026-09-15T00:00:00Z' },
  ]);

  render(<MaintPreventive />);

  expect(await screen.findByText('Preventive Maintenance')).toBeInTheDocument();
  expect(await screen.findByText('Generator')).toBeInTheDocument();
  expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
  expect(screen.queryByText(/There is no Maintenance-owned persisted/i)).not.toBeInTheDocument();
});