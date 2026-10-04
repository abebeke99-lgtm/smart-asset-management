import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ICTNetworkEquipment from './ICTNetworkEquipment';
import apiClient from '../../services/apiClient';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  getApiErrorMessage: (error, fallback) => error?.response?.data?.message || fallback,
}));

const options = {
  types: ['Switch', 'Router', 'Firewall', 'Access Point', 'Network Rack', 'Modem', 'Server', 'Other Network Equipment'],
  statuses: ['active', 'available', 'assigned', 'maintenance', 'repair', 'inactive', 'retired'],
  conditions: ['excellent', 'good', 'fair', 'poor', 'damaged'],
  users: [{ id: 7, label: 'Network Technician' }],
};

const response = (data = []) => ({
  data: {
    success: true,
    data,
    summary: { total: data.length, active: data.length, assigned: 0, maintenance: 0, repair: 0 },
    options,
    pagination: { page: 1, limit: 20, total: data.length, totalPages: 1 },
  },
});

const existingEquipment = {
  id: 11,
  name: 'Core Switch',
  assetTag: 'NET-11',
  serialNumber: 'SW-11',
  type: 'Switch',
  ipAddress: '192.168.10.2',
  macAddress: '00:1A:2B:3C:4D:5E',
  status: 'active',
  condition: 'good',
  assignedToId: null,
  assignment: 'Unassigned',
  campus: 'Main Campus',
  building: 'ICT Block',
  room: 'Server Room',
  location: 'Rack 1',
  purchaseDate: '2024-01-10',
  warrantyExpiry: '2027-01-10',
  description: 'Core switch',
};

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockResolvedValue(response());
});

test('loads database-backed network equipment and creates a validated device record', async () => {
  render(<ICTNetworkEquipment />);
  expect(await screen.findByText('No network equipment yet')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/ict/equipment/network', expect.objectContaining({
    params: expect.objectContaining({ page: 1, limit: 20 }),
  }));

  fireEvent.click(screen.getAllByRole('button', { name: /add network equipment/i })[0]);
  fireEvent.change(screen.getByLabelText(/equipment name/i), { target: { value: 'Edge Switch' } });
  fireEvent.change(screen.getByLabelText(/^type/i), { target: { value: 'Switch' } });
  fireEvent.change(screen.getByLabelText(/ip address/i), { target: { value: '192.168.10.3' } });
  fireEvent.change(screen.getByLabelText(/mac address/i), { target: { value: '00:1A:2B:3C:4D:5F' } });
  fireEvent.change(screen.getByLabelText(/campus/i), { target: { value: 'Main Campus' } });
  fireEvent.change(screen.getByLabelText(/building/i), { target: { value: 'ICT Block' } });
  fireEvent.change(screen.getByLabelText(/room/i), { target: { value: 'Room 2' } });
  apiClient.post.mockResolvedValue({ data: { success: true } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Equipment' }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/ict/equipment/network', expect.objectContaining({
    name: 'Edge Switch',
    type: 'Switch',
    ipAddress: '192.168.10.3',
    macAddress: '00:1A:2B:3C:4D:5F',
    campus: 'Main Campus',
  })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('edits and deletes an existing network equipment record', async () => {
  apiClient.get.mockResolvedValue(response([existingEquipment]));
  render(<ICTNetworkEquipment />);
  expect(await screen.findByText('NET-11')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Edit Core Switch' }));
  fireEvent.change(screen.getByLabelText(/equipment name/i), { target: { value: 'Core Switch Updated' } });
  apiClient.put.mockResolvedValue({ data: { success: true } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(
    '/api/ict/equipment/network/11',
    expect.objectContaining({ name: 'Core Switch Updated', type: 'Switch' }),
  ));
  expect(await screen.findByRole('button', { name: 'Delete Core Switch' })).toBeInTheDocument();

  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  apiClient.delete.mockResolvedValue({ data: { success: true } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete Core Switch' }));
  await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/api/ict/equipment/network/11'));
  expect(confirm).toHaveBeenCalled();
  confirm.mockRestore();
});
