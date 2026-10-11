import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StoreAssets from './StoreAssets';
import { apiClient } from '../../utils/api';

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
    expect(apiClient.get).toHaveBeenCalledWith('/api/store/available-assets', {
      params: expect.objectContaining({ page: 1, pageSize: 20, sortBy: 'name', sortOrder: 'asc' }),
    });
  });

  it('applies search, filter, and server-side sorting parameters', async () => {
    renderPage();
    await screen.findByText('Safety Gloves');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search assets...' }), { target: { value: 'gloves' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', {
      params: expect.objectContaining({ search: 'gloves', page: 1 }),
    }));
    expect(await screen.findByText('Safety Gloves')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'Safety' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', {
      params: expect.objectContaining({ search: 'gloves', category: 'Safety', page: 1 }),
    }));
    expect(await screen.findByText('Safety Gloves')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Available Quantity, unsorted' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/store/available-assets', {
      params: expect.objectContaining({ sortBy: 'availableQuantity', sortOrder: 'asc' }),
    }));
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
