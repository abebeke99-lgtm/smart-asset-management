import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MaintWorkOrders from './MaintWorkOrders';
import apiClient from '../../services/apiClient';

jest.mock('../../contexts/UiContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const options = {
  assets: [{ id: 6, name: 'Lecture Hall Projector', assetCode: 'AV-006' }],
  technicians: [{ id: 9, fullName: 'Aster Technician' }],
  maintenanceRequests: [{ id: 21, assetId: 6, title: 'Projector lamp failure', status: 'Pending', asset: { id: 6, name: 'Lecture Hall Projector', assetCode: 'AV-006' } }],
};

beforeEach(() => {
  apiClient.get.mockReset();
  apiClient.post.mockReset();
  apiClient.get.mockImplementation((path) => Promise.resolve({
    data: path.endsWith('/options')
      ? { success: true, data: options }
      : { success: true, data: [], summary: {}, pagination: { page: 1, pages: 1, total: 0, limit: 10 } },
  }));
  apiClient.post.mockResolvedValue({ data: { success: true, data: { id: 31 } } });
});

test('New Work Order opens a request-linked form and creates through the API', async () => {
  render(<MaintWorkOrders />);

  fireEvent.click(await screen.findByRole('button', { name: 'New Work Order' }));
  const dialog = await screen.findByRole('dialog', { name: 'New Work Order' });
  expect(await screen.findByText(/Lecture Hall Projector \(AV-006\)/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Problem Description/), { target: { value: 'Replace the lamp' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Work Order' }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/maintenance/work-orders', expect.objectContaining({
    maintenanceId: 21,
    assetId: 6,
    problemDescription: 'Replace the lamp',
    status: 'open',
  })));
  expect(dialog).toBeInTheDocument();
});

test('New Work Order explains when no linked maintenance requests are available', async () => {
  apiClient.get.mockImplementation((path) => Promise.resolve({
    data: path.endsWith('/options')
      ? { success: true, data: { assets: [], technicians: [], maintenanceRequests: [] } }
      : { success: true, data: [], summary: {}, pagination: { page: 1, pages: 1, total: 0, limit: 10 } },
  }));

  render(<MaintWorkOrders />);
  fireEvent.click(await screen.findByRole('button', { name: 'New Work Order' }));

  expect(await screen.findByText('No assets or maintenance requests are available in the database.')).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
});