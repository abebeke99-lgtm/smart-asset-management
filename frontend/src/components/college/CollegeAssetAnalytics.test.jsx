import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiClient from '../../services/apiClient';
import CollegeAssetAnalytics from './CollegeAssetAnalytics';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('react-chartjs-2', () => ({
  Bar: () => null,
  Doughnut: () => null,
  Line: () => null,
}));

const emptyPayload = {
  data: {
    summary: { totalAssets: 0 },
    distributions: {},
    trends: {},
    table: { rows: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } },
    departments: [],
  },
};

const populatedPayload = {
  data: {
    summary: { totalAssets: 1, activeAssets: 1 },
    distributions: {
      status: [{ status: 'available', count: 1 }],
      conditions: [{ condition: 'Good', count: 1 }],
      locations: [],
      departments: [],
      categories: [],
    },
    trends: { assetsAddedOverTime: [] },
    table: {
      rows: [{
        id: 7,
        assetCode: 'AST-7',
        assetName: 'Microscope',
        category: 'Equipment',
        department: 'Science',
        location: 'Lab 1',
        status: 'available',
        condition: 'Good',
      }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    },
    departments: [{ id: 4, name: 'Science' }],
  },
};

beforeEach(() => {
  apiClient.get.mockReset();
});

test('shows loading before rendering successful analytics and sends blank optional filters safely', async () => {
  let resolveRequest;
  apiClient.get.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));

  render(<CollegeAssetAnalytics />);
  expect(screen.getByText('Loading asset analytics...')).toBeInTheDocument();

  expect(apiClient.get).toHaveBeenCalledWith('/api/college/analytics/assets', {
    params: {
      search: undefined,
      departmentId: '',
      categoryId: '',
      locationId: '',
      status: '',
      condition: '',
      dateFrom: '',
      dateTo: '',
      page: 1,
      limit: 10,
    },
  });

  await act(async () => resolveRequest({ data: populatedPayload }));
  expect(await screen.findByText('Microscope')).toBeInTheDocument();
  expect(screen.getByText('AST-7')).toBeInTheDocument();
});

test('distinguishes a successful empty analytics result from a failed request', async () => {
  apiClient.get.mockResolvedValue({ data: emptyPayload });

  render(<CollegeAssetAnalytics />);

  expect(await screen.findByText('No assets match the selected filters.')).toBeInTheDocument();
  expect(screen.getByText('Showing 0 of 0')).toBeInTheDocument();
});

test('shows API errors and retries the analytics request', async () => {
  apiClient.get
    .mockRejectedValueOnce({ response: { data: { message: 'Analytics query failed.' } } })
    .mockResolvedValueOnce({ data: populatedPayload });

  render(<CollegeAssetAnalytics />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Analytics query failed.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('Microscope')).toBeInTheDocument();
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
});
