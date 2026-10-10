import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import StoreInventory from './StoreInventory';
import { apiClient } from '../../utils/api';
import * as XLSX from 'xlsx';

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="inventory-chart" />,
}));

jest.mock('xlsx', () => ({
  utils: {
    json_to_sheet: jest.fn((rows) => rows),
    sheet_to_csv: jest.fn(() => 'Inventory ID,Quantity'),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  writeFile: jest.fn(),
}));

const item = {
  id: 5,
  asset_id: 17,
  item_id: 'INV-000005',
  asset_tag: 'ASSET-17',
  name: 'Projector',
  category: 'Electronics',
  quantity: 6,
  availableQuantity: 4,
  reservedQuantity: 1,
  issuedQuantity: 1,
  minimumQuantity: 2,
  assetStatus: 'available',
  location: 'Main Store',
  serial_number: 'SER-17',
};

const inventoryResponse = (overrides = {}) => ({
  data: {
    success: true,
    data: [item],
    summary: {
      total: 6,
      available: 4,
      reserved: 1,
      assigned: 1,
      damaged: 0,
      missing: 0,
      lowStock: 2,
      normalStock: 1,
      criticalStock: 1,
    },
    filters: { categories: ['Electronics'], locations: ['Main Store'], conditions: ['Good'] },
    pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 },
    ...overrides,
  },
});

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const CurrentPath = () => {
  const location = useLocation();
  return (
    <>
      <output data-testid="current-path">{location.pathname}</output>
      <output data-testid="location-state">{JSON.stringify(location.state || {})}</output>
    </>
  );
};

const renderInventory = (initialEntry = '/store/inventory') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <Routes>
      <Route path="/store/*" element={<><StoreInventory /><CurrentPath /></>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockImplementation((_url, config) => Promise.resolve(inventoryResponse(
    config?.params?.pageSize === 100 ? { pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } : {},
  )));
  apiClient.post.mockResolvedValue({ data: { success: true } });
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

test('loads one inventory table and server-backed inventory totals', async () => {
  renderInventory();

  expect(await screen.findByRole('heading', { name: 'Store Inventory', level: 1 })).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/store/inventory', {
    params: expect.objectContaining({ page: 1, pageSize: 20, sortBy: 'itemId', sortOrder: 'asc' }),
  });
  expect(screen.getAllByRole('table')).toHaveLength(1);
  expect(screen.getByRole('row', { name: /INV-000005/ })).toHaveTextContent('6');
  expect(screen.getByRole('row', { name: /INV-000005/ })).toHaveTextContent('Main Store');
  expect(document.querySelector('.stock-list')).toHaveTextContent('Normal1');
  expect(document.querySelector('.stock-list')).toHaveTextContent('Low Stock1');
  expect(document.querySelector('.stock-list')).toHaveTextContent('Critical1');
});

test('searches, sorts, and paginates using the Store inventory API', async () => {
  renderInventory();
  await screen.findByText('INV-000005');

  fireEvent.change(screen.getByRole('textbox', { name: 'Search by ID, name, serial, RFID...' }), {
    target: { value: 'projector' },
  });
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/inventory', {
    params: expect.objectContaining({ search: 'projector', page: 1 }),
  }));

  fireEvent.click(await screen.findByRole('button', { name: 'Sort by Name' }));
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/inventory', {
    params: expect.objectContaining({ search: 'projector', sortBy: 'name', sortOrder: 'asc' }),
  }));

  fireEvent.click(await screen.findByRole('button', { name: /Next/ }));
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/inventory', {
    params: expect.objectContaining({ search: 'projector', sortBy: 'name', page: 2 }),
  }));
});

test('loads details by inventory ID and movement history by asset ID including movement quantity', async () => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/store/inventory/5') {
      return Promise.resolve({ data: { data: { ...item, description: 'Ceiling-mounted projector' } } });
    }
    if (url === '/api/store/history') {
      return Promise.resolve({
        data: { data: { items: [{ id: 30, movementType: 'received', quantity: 2, createdAt: '2026-10-01T12:00:00.000Z' }] } },
      });
    }
    return Promise.resolve(inventoryResponse());
  });

  renderInventory();
  await screen.findByText('INV-000005');
  fireEvent.click(screen.getByRole('button', { name: 'View' }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(await screen.findByText('Ceiling-mounted projector')).toBeInTheDocument();
  expect(await screen.findByText(/2 ·/)).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/store/inventory/5');
  expect(apiClient.get).toHaveBeenCalledWith('/api/store/history', {
    params: { assetId: 17, pageSize: 100 },
  });
});

test('shows an explicit history error while retaining loaded item details', async () => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/store/inventory/5') {
      return Promise.resolve({ data: { data: { ...item, description: 'Details remain available' } } });
    }
    if (url === '/api/store/history') return Promise.reject(new Error('history unavailable'));
    return Promise.resolve(inventoryResponse());
  });

  renderInventory();
  await screen.findByText('INV-000005');
  fireEvent.click(screen.getByRole('button', { name: 'View' }));

  expect(await screen.findByText('Details remain available')).toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load stock history.');
});

test('inventory actions navigate to their existing Store workflows', async () => {
  renderInventory();
  await screen.findByText('INV-000005');

  for (const [action, route] of [
    ['Reserve', '/store/requests'],
    ['Receive', '/store/receive'],
    ['Issue', '/store/issue'],
    ['Return', '/store/returns'],
    ['Transfer', '/store/transfers'],
    ['Adjust', '/store/stock-adjustments'],
  ]) {
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByTestId('current-path')).toHaveTextContent(route);
    expect(screen.getByTestId('location-state')).toHaveTextContent('"assetId":17');
  }
});

test('Add Stock uses its own form and idempotent endpoint, then refreshes inventory', async () => {
  apiClient.get.mockImplementation((url, config) => {
    if (url === '/api/store/receive/suppliers') return Promise.resolve({ data: { data: [{ id: 8, supplierName: 'Campus Supplies' }] } });
    if (url === '/api/store/inventory' && config?.params?.pageSize === 100) {
      return Promise.resolve(inventoryResponse({ pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 } }));
    }
    return Promise.resolve(inventoryResponse());
  });
  let finishPost;
  apiClient.post.mockImplementation(() => new Promise((resolve) => { finishPost = resolve; }));

  renderInventory();
  await screen.findByText('INV-000005');
  fireEvent.click(screen.getByRole('button', { name: 'Add Stock' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(screen.getByLabelText('Inventory Item'), { target: { value: '17' } });
  fireEvent.change(screen.getByLabelText('Quantity to Add'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Unit Cost'), { target: { value: '12.5' } });
  fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: '8' } });
  fireEvent.change(screen.getByLabelText('Reference Number'), { target: { value: 'STOCK-REF-5' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Verified opening stock' } });

  const form = dialog.querySelector('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
  expect(apiClient.post).toHaveBeenCalledWith('/api/store/stock-additions', expect.objectContaining({
    asset_id: 17,
    quantity: 3,
    unit_price: 12.5,
    supplier_id: '8',
    reference: 'STOCK-REF-5',
    reason: 'Verified opening stock',
    adjustment_type: 'increase',
    submission_id: expect.stringMatching(/^add-\d+-[a-z0-9]+$/),
  }));

  finishPost({ data: { success: true } });
  expect(await screen.findByText('Stock added successfully.')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/store/inventory', {
    params: expect.objectContaining({ page: 1, pageSize: 20 }),
  });
});

test('invalid Add Stock quantities are rejected before posting', async () => {
  renderInventory();
  await screen.findByText('INV-000005');
  fireEvent.click(screen.getByRole('button', { name: 'Add Stock' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(screen.getByLabelText('Inventory Item'), { target: { value: '17' } });
  fireEvent.change(screen.getByLabelText('Quantity to Add'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Reference Number'), { target: { value: 'STOCK-REF-5' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Verified opening stock' } });
  fireEvent.submit(dialog.querySelector('form'));

  expect(await screen.findByRole('alert')).toHaveTextContent('Select an item, enter a positive whole-number quantity, reference, date, and reason.');
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('opens the Add Stock workflow for a selected low-stock asset', async () => {
  renderInventory('/store/inventory?addStock=true&assetId=17');
  const dialog = await screen.findByRole('dialog');
  expect(screen.getByLabelText('Inventory Item')).toHaveValue('17');
  expect(dialog).toHaveTextContent('Add Stock to Existing Inventory');
  expect(apiClient.get).not.toHaveBeenCalledWith('/api/store/receive', expect.anything());
});

test('exports all matching API records to Excel and CSV', async () => {
  renderInventory();
  await screen.findByText('INV-000005');
  const initialRequestCount = apiClient.get.mock.calls.length;

  fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(initialRequestCount + 1));
  expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/inventory/export', {
    params: expect.objectContaining({ sortBy: 'itemId' }),
  });
  expect(XLSX.utils.book_new).toHaveBeenCalled();
  expect(XLSX.writeFile).toHaveBeenCalledWith(
    XLSX.utils.book_new.mock.results[0].value,
    expect.stringMatching(/^store-inventory-.*\.xlsx$/),
  );

  URL.createObjectURL = jest.fn(() => 'blob:inventory-export');
  URL.revokeObjectURL = jest.fn();
  const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await waitFor(() => expect(screen.getByRole('button', { name: 'Excel' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(initialRequestCount + 2));
  expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/inventory/export', {
    params: expect.objectContaining({ sortBy: 'itemId' }),
  });
  expect(XLSX.utils.sheet_to_csv).toHaveBeenCalled();
  expect(anchorClick).toHaveBeenCalled();
  anchorClick.mockRestore();
});

test('shows a retryable error when inventory loading fails', async () => {
  apiClient.get
    .mockRejectedValueOnce({ response: { status: 500 } })
    .mockResolvedValueOnce(inventoryResponse());

  renderInventory();

  expect(await screen.findByText('Unable to load inventory')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('INV-000005')).toBeInTheDocument();
});
