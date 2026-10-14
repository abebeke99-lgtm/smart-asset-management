import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
      filters: { categories: ['Supplies'], locations: ['Main Store'] },
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      ...overrides,
    },
  },
});

const CurrentLocation = () => {
  const location = useLocation();
  return <span data-testid="current-location">{`${location.pathname}${location.search}`}</span>;
};

const renderPage = (entry = '/store/low-stock') => render(
  <MemoryRouter initialEntries={[entry]}>
    <>
      <StoreLowStock />
      <CurrentLocation />
    </>
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
  expect(apiClient.get).toHaveBeenCalledWith('/api/store/low-stock', expect.objectContaining({
    params: expect.objectContaining({ page: 1, pageSize: 25, sortBy: 'severity' }),
  }));
});

test('accepts supported low-stock response envelope variants', async () => {
  apiClient.get.mockResolvedValue({
    data: {
      items: [alertItem],
      summary: { lowStock: 1 },
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    },
  });
  renderPage();

  expect(await screen.findByText('Medical Gloves')).toBeInTheDocument();
  expect(screen.queryByText('The low-stock response did not include an item list.')).not.toBeInTheDocument();
});

test('uses the matching cached page when the low-stock server responds with 304', async () => {
  apiClient.get
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce({ status: 304, data: undefined });
  renderPage();

  expect(await screen.findByText('Medical Gloves')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  expect(await screen.findByText('Medical Gloves')).toBeInTheDocument();
  expect(screen.queryByText('The server returned 304 without a matching cached low-stock response.')).not.toBeInTheDocument();
  expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/low-stock', expect.objectContaining({
    validateStatus: expect.any(Function),
  }));
});

test('retries an uncached 304 response before showing a load error', async () => {
  apiClient.get
    .mockResolvedValueOnce({ status: 304, data: undefined })
    .mockResolvedValueOnce(response());
  renderPage();

  expect(await screen.findByText('Medical Gloves')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledTimes(2);
  expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/low-stock', expect.objectContaining({
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  }));
  expect(screen.queryByText(/304 without a matching cached/i)).not.toBeInTheDocument();
});

test('shows a loading state until the low-stock API responds', () => {
  let resolveLowStock;
  const pendingPromise = new Promise((resolve) => { resolveLowStock = resolve; });
  apiClient.get.mockReturnValue(pendingPromise);

  renderPage();

  expect(screen.getByText('Loading low-stock alerts...')).toBeInTheDocument();
  resolveLowStock({ data: { success: true, data: [] } });
});

test('filters and sorts through the scoped API, including dashboard out-of-stock links', async () => {
  renderPage('/store/low-stock?severity=out_of_stock');
  await screen.findByText('Medical Gloves');
  expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/low-stock', expect.objectContaining({
    params: expect.objectContaining({ severity: 'out_of_stock' }),
  }));

  fireEvent.change(screen.getByRole('textbox', { name: 'Search items, tags, serials...' }), { target: { value: 'gloves' } });
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/low-stock', expect.objectContaining({
    params: expect.objectContaining({ search: 'gloves', severity: 'out_of_stock' }),
  })));
  expect(await screen.findByText('Medical Gloves')).toBeInTheDocument();

  fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'available:asc' } });
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/low-stock', expect.objectContaining({
    params: expect.objectContaining({ sortBy: 'available', sortOrder: 'asc' }),
  })));
});

test('paginates using the server total and page metadata', async () => {
  apiClient.get.mockImplementation((_url, config) => Promise.resolve(response({
    pagination: { page: config.params.page, pageSize: 25, total: 26, totalPages: 2 },
  })));
  renderPage();

  await screen.findByText('Medical Gloves');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));

  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/low-stock', expect.objectContaining({
    params: expect.objectContaining({ page: 2, pageSize: 25 }),
  })));
  expect(await screen.findByText('2 / 2')).toBeInTheDocument();
});

test('updates the item reorder level using the scoped API and reloads authoritative data', async () => {
  renderPage();
  await screen.findByText('Medical Gloves');
  fireEvent.click(screen.getByRole('button', { name: /Set Reorder Level/ }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Reorder Level' }), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/api/store/inventory/7/reorder-level', { reorderLevel: 8 }));
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Reorder level updated.')).toBeInTheDocument();
});

test('uses server-wide category and effective-location choices instead of current-page values', async () => {
  apiClient.get.mockResolvedValue(response({
    filters: { categories: ['Equipment', 'Supplies'], locations: ['Main Store', 'Warehouse B'] },
  }));
  renderPage();

  await screen.findByText('Medical Gloves');
  fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'Equipment' } });
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/low-stock', expect.objectContaining({
    params: expect.objectContaining({ category: 'Equipment' }),
  })));
  fireEvent.change(await screen.findByRole('combobox', { name: 'Location' }), { target: { value: 'Warehouse B' } });
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/low-stock', expect.objectContaining({
    params: expect.objectContaining({ category: 'Equipment', location: 'Warehouse B' }),
  })));
});

test('opens the existing inventory detail view from a low-stock row', async () => {
  renderPage();

  await screen.findByText('Medical Gloves');
  fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

  expect(screen.getByTestId('current-location')).toHaveTextContent('/store/inventory?details=7&assetId=17');
});

test('shows API failures instead of presenting empty or fake stock values', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 500, data: { message: 'Inventory database is unavailable' } } });
  renderPage();
  expect(await screen.findByText('Inventory database is unavailable')).toBeInTheDocument();
  expect(screen.queryByText('No low-stock items')).not.toBeInTheDocument();
});

test('retries a failed Low Stock request and renders the recovered API data', async () => {
  apiClient.get
    .mockRejectedValueOnce({ response: { status: 503, data: { message: 'Inventory temporarily unavailable' } } })
    .mockResolvedValueOnce(response());
  renderPage();

  expect(await screen.findByText('Inventory temporarily unavailable')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('Medical Gloves')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledTimes(2);
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
