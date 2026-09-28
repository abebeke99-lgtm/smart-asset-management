import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MaintReports from './MaintReports';
import MaintWorkOrders from './MaintWorkOrders';
import MaintPreventive from './MaintPreventive';
import { getMaintenance, getMaintenanceDashboard, getRepairHistory, getTechnicians } from '../../services/maintenanceApi';

jest.mock('../../contexts/UiContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../../services/maintenanceApi', () => ({
  getMaintenance: jest.fn(),
  getMaintenanceDashboard: jest.fn(),
  getRepairHistory: jest.fn(),
  getTechnicians: jest.fn(),
  getInventory: jest.fn(),
  getAssets: jest.fn(),
}));

beforeEach(() => {
  getMaintenance.mockResolvedValue([]);
  getMaintenanceDashboard.mockResolvedValue({});
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
  getMaintenance.mockResolvedValue([
    { id: 1, asset: 'Laptop A', title: 'Keyboard replacement', priority: 'High', status: 'In Progress', statusRaw: 'in-progress', assigned_to_name: 'Jane Doe', created: '2026-09-28T00:00:00Z' },
    { id: 2, asset: 'Projector B', title: 'Lamp check', priority: 'Medium', status: 'Testing', statusRaw: 'testing', assigned_to_name: 'John Smith', created: '2026-09-27T00:00:00Z' },
  ]);

  render(<MaintWorkOrders />);

  expect(await screen.findByText('Work Orders')).toBeInTheDocument();
  expect(screen.getByText('Keyboard replacement')).toBeInTheDocument();
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
  expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
  expect(screen.getByText('Generator')).toBeInTheDocument();
  expect(screen.queryByText(/There is no Maintenance-owned persisted/i)).not.toBeInTheDocument();
});