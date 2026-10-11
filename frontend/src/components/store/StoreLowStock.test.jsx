import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StoreLowStock from './StoreLowStock';
import { apiClient } from '../../utils/api';

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

const alertItem = {
  id: 7,
  assetId: 17,
  item: 'Medical Gloves',
  assetCode: 'SUP-17',
  category: 'Supplies',
  unit: 'box',
  onHand: 12,
  available: 2,
  reserved: 1,
  assigned: 9,
  reorderLevel: 5,
  thresholdSource: 'system_default',
  shortage: 3,
  severity: 'CRITICAL',
  college: 'Mekdela Amba University',
  department: 'Nursing',
  location: 'Main Store',
  lastUpdated: '2026-10-01T12:00:00.000Z',
  dataIntegrityError: false,
};

const response = (overrides = {}) => ({
  data: {
    success: true,
    data: {
      items: [alertItem],
      total: 1,
      summary: { lowStock: 1, critical: 1, outOfStock: 0, totalShortage: 3, categoriesAffected: 1, locationsAffected: 1, dataIntegrityErrors: 0 },
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      ...overrides,
    },
  },
});

const renderPage = (entry = '/store/low-stock') => render(
  <MemoryRouter initialEntries={[entry]}>
    <StoreLowStock />
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockResolvedValue(response());
  apiClient.patch.mockResolvedValue({ data: { success: true } });
});

test('renders API-backed stock balances and threshold values', async () => {
  renderPage();
  expect(await screen.findByText('Medical Gloves')).toBeInTheDocument();
  expect(screen.getByText('12 box')).toBeInTheDocument();
  expect(screen.getByText('2 box')).toBeInTheDocument();
  expect(screen.getByText('5 box *')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/store/low-stock', {
    params: expect.objectContaining({ page: 1, pageSize: 25, sortBy: 'severity' }),
  });
});

test('shows a loading state until the low-stock API responds', () => {
  apiClient.get.mockReturnValue(new Promise(() => {}));

  renderPage();

  expect(screen.getByText('Loading low-stock alerts...')).toBeInTheDocument();
});

test('filters and sorts through the scoped API, including dashboard out-of-stock links', async () => {
  renderPage('/store/low-stock?severity=out_of_stock');
  await screen.findByText('Medical Gloves');
  expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/low-stock', {
    params: expect.objectContaining({ severity: 'out_of_stock' }),
  });

  fireEvent.change(screen.getByRole('textbox', { name: 'Search items, tags, serials...' }), { target: { value: 'gloves' } });
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/low-stock', {
    params: expect.objectContaining({ search: 'gloves', severity: 'out_of_stock' }),
  }));
  expect(await screen.findByText('Medical Gloves')).toBeInTheDocument();

  fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'available:asc' } });
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/low-stock', {
    params: expect.objectContaining({ sortBy: 'available', sortOrder: 'asc' }),
  }));
});

test('updates the item reorder level using the scoped API and reloads authoritative data', async () => {
  renderPage();
  await screen.findByText('Medical Gloves');
  fireEvent.click(screen.getByRole('button', { name: /Set Reorder Level/ }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Reorder Level' }), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/api/store/inventory/7/reorder-level', { reorderLevel: 8 }));
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
});

test('shows API failures instead of presenting empty or fake stock values', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 500, data: { message: 'Inventory database is unavailable' } } });
  renderPage();
  expect(await screen.findByText('Inventory database is unavailable')).toBeInTheDocument();
  expect(screen.queryByText('No low-stock items')).not.toBeInTheDocument();
});

test('renders the empty state when the API returns no low-stock items', async () => {
  apiClient.get.mockResolvedValue(response({
    items: [],
    total: 0,
    summary: { lowStock: 0, critical: 0, outOfStock: 0, totalShortage: 0, categoriesAffected: 0, locationsAffected: 0, dataIntegrityErrors: 0 },
    pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
  }));

  renderPage();

  expect(await screen.findByText('No low-stock items')).toBeInTheDocument();
  expect(screen.getByText('All monitored inventory is currently above its reorder threshold.')).toBeInTheDocument();
});

test('does not display missing or invalid quantities as zero', async () => {
  apiClient.get.mockResolvedValue(response({
    items: [{ ...alertItem, onHand: null, available: 'invalid', reserved: undefined, assigned: '', reorderLevel: null, shortage: 'NaN' }],
  }));

  renderPage();

  expect(await screen.findByText('Medical Gloves')).toBeInTheDocument();
  expect(screen.getAllByText('-')).toHaveLength(5);
  expect(screen.getByText('- *')).toBeInTheDocument();
});
