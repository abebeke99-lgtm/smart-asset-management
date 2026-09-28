import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminChemicalQuarantine from './AdminChemicalQuarantine';
import { apiClient } from '../../utils/api';

jest.mock('../../utils/api', () => ({
  apiClient: { get: jest.fn(), put: jest.fn() },
}));

const record = {
  id: 42,
  name: 'Acetic acid',
  chemicalCode: 'CHEM-042',
  casNumber: '64-19-7',
  quantity: 4,
  unit: 'L',
  quarantineReason: 'Damaged container',
  updatedAt: '2026-09-20T10:00:00.000Z',
};

const responseWith = (data) => ({
  data: {
    data,
    total: data.length,
    pagination: { page: 1, limit: 50, total: data.length, pages: 1 },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
});

test('loads quarantine records from the admin chemical API', async () => {
  apiClient.get.mockResolvedValue(responseWith([record]));

  render(<AdminChemicalQuarantine />);

  expect(await screen.findByText('Acetic acid')).toBeInTheDocument();
  expect(screen.getByText('Damaged container')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/admin/inventory/quarantine', {
    params: { page: 1, limit: 50 },
  });
});

test('sends quarantine search terms to the backend query', async () => {
  apiClient.get.mockResolvedValue(responseWith([]));

  render(<AdminChemicalQuarantine />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search quarantine records' }), { target: { value: 'CHEM-042' } });

  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/admin/inventory/quarantine', {
    params: { page: 1, limit: 50, search: 'CHEM-042' },
  }));
});

test('releases a record with the existing remove_quarantine contract', async () => {
  apiClient.get
    .mockResolvedValueOnce(responseWith([record]))
    .mockResolvedValueOnce(responseWith([]));
  apiClient.put.mockResolvedValue({ data: { success: true } });

  render(<AdminChemicalQuarantine />);
  fireEvent.click(await screen.findByRole('button', { name: 'Release' }));

  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/admin/inventory/42', { remove_quarantine: true }));
  expect(await screen.findByText('No chemicals are currently quarantined.')).toBeInTheDocument();
});

test('shows backend authorization failures without exposing response internals', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 403, data: { message: 'internal detail' } } });

  render(<AdminChemicalQuarantine />);

  expect(await screen.findByText('You are not authorized to manage chemical quarantine.')).toBeInTheDocument();
  expect(screen.queryByText('internal detail')).not.toBeInTheDocument();
});
