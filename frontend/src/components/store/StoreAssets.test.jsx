import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StoreAssets from './StoreAssets';
import { apiClient } from '../../utils/api';
import * as XLSX from 'xlsx';

jest.mock('xlsx', () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
    json_to_sheet: jest.fn(() => ({})),
  },
  writeFile: jest.fn(),
}));

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const item = {
  id: 12,
  assetId: 12,
  name: 'Safety Gloves',
  category: 'Safety',
  totalQuantity: 10,
  quantity: 10,
  availableQuantity: 6,
  status: 'Available',
  collegeName: 'Health College',
  departmentName: 'Nursing',
  location: 'Main Store',
  unit: 'box',
  assetType: 'serialized',
  condition: 'Good',
};

const listResponse = (overrides = {}) => ({
  data: {
    success: true,
    data: {
      items: [item],
      summary: { totalAvailable: 6, availableToday: 2, awaitingIssue: 1, lowStock: 0 },
      filters: {
        categories: ['Safety'],
        locations: ['Main Store'],
        conditions: ['Good'],
        departments: [{ id: 4, name: 'Nursing' }],
        assetTypes: ['bulk'],
      },
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      ...overrides,
    },
  },
});

const renderPage = () => render(
  <MemoryRouter><StoreAssets /></MemoryRouter>,
);

describe('Available assets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockResolvedValue(listResponse());
  });

  it('renders quantities and organization details from the scoped API response', async () => {
    renderPage();

    expect(await screen.findByText('Safety Gloves')).toBeInTheDocument();
    expect(screen.getByText('Health College')).toBeInTheDocument();
    expect(screen.getAllByText('Nursing')).not.toHaveLength(0);
    expect(screen.getByText('10 box')).toBeInTheDocument();
    expect(screen.getByText('6 box')).toBeInTheDocument();
    expect(screen.getByText('Serialized')).toBeInTheDocument();
    expect(screen.getAllByText('Good')).not.toHaveLength(0);
    expect(apiClient.get).toHaveBeenCalledWith('/api/store/available-assets', expect.objectContaining({
      params: expect.objectContaining({ page: 1, pageSize: 20, sortBy: 'name', sortOrder: 'asc' }),
      signal: expect.any(AbortSignal),
    }));
  });

  it('applies search, filter, and server-side sorting parameters', async () => {
    renderPage();
    await screen.findByText('Safety Gloves');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search assets...' }), { target: { value: 'gloves' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', expect.objectContaining({
      params: expect.objectContaining({ search: 'gloves', page: 1 }),
    })));
    expect(await screen.findByText('Safety Gloves')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'Safety' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', expect.objectContaining({
      params: expect.objectContaining({ search: 'gloves', category: 'Safety', page: 1 }),
    })));
    expect(await screen.findByText('Safety Gloves')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Available Quantity, unsorted' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', expect.objectContaining({
      params: expect.objectContaining({ sortBy: 'availableQuantity', sortOrder: 'asc' }),
    })));
    expect(await screen.findByText('Safety Gloves')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Condition, unsorted' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', expect.objectContaining({
      params: expect.objectContaining({ sortBy: 'condition', sortOrder: 'asc' }),
    })));
  });

  it('resets all controls when filters are cleared and reloads page one', async () => {
    renderPage();
    await screen.findByText('Safety Gloves');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search assets...' }), { target: { value: 'gloves' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', expect.objectContaining({
      params: expect.objectContaining({ search: 'gloves' }),
    })));
    expect(await screen.findByText('Safety Gloves')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'Safety' } });
    expect(await screen.findByText('Safety Gloves')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Clear Filters/i }));
    expect(await screen.findByText('Safety Gloves')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search assets...' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('');
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', expect.objectContaining({
      params: expect.objectContaining({ search: '', category: '', page: 1 }),
    })));
  });

  it('uses server pagination and refreshes the current table data', async () => {
    apiClient.get.mockImplementation((url, { params }) => Promise.resolve(listResponse({
      pagination: { page: params.page, pageSize: 20, total: 21, totalPages: 2 },
    })));
    renderPage();
    await screen.findByText('Safety Gloves');
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', expect.objectContaining({
      params: expect.objectContaining({ page: 2 }),
    })));
    expect(await screen.findByText('Safety Gloves')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', expect.objectContaining({
      params: expect.objectContaining({ page: 2 }),
    })));
  });

  it('exports all filtered pages with the actual type and condition values', async () => {
    apiClient.get.mockImplementation((url, { params }) => Promise.resolve(listResponse({
      items: params.page === 1 ? [item] : [{ ...item, id: 13, assetId: 13, name: 'First Aid Kit' }],
      pagination: { page: params.page, pageSize: 100, total: 2, totalPages: 2 },
    })));
    renderPage();
    await screen.findByText('Safety Gloves');
    fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalledTimes(1));
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', expect.objectContaining({
      params: expect.objectContaining({ page: 2, pageSize: 100 }),
    }));
    const rows = XLSX.utils.json_to_sheet.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.objectContaining({ 'Asset Type': 'serialized', Condition: 'Good' }));
  });

  it('shows the empty state when the API returns no matching rows', async () => {
    apiClient.get.mockResolvedValue(listResponse({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }));
    renderPage();
    expect(await screen.findByText('No available assets')).toBeInTheDocument();
  });

  it('reports authorization and API errors without substituting fake inventory', async () => {
    apiClient.get.mockRejectedValueOnce({ response: { status: 401 } });
    renderPage();
    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
  });
});
