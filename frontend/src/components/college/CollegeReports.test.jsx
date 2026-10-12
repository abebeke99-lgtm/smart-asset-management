import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UiProvider } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';
import CollegeReports from './CollegeReports';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const makeResponse = (data = [], pagination = {}) => ({
  data: {
    success: true,
    reportType: 'inventory',
    data,
    summary: { totalAssets: data.length },
    filters: {
      departments: [{ id: 7, name: 'Physics' }],
      categories: [{ id: 3, name: 'Equipment' }],
      statuses: ['available'],
    },
    charts: [],
    pagination: { page: 1, limit: 20, total: data.length, totalPages: 1, ...pagination },
  },
});

const asset = (name) => ({
  id: name,
  assetCode: `CODE-${name}`,
  name,
  category: 'Equipment',
  department: 'Physics',
  location: 'Lab 1',
  status: 'available',
  condition: 'Good',
  purchaseDate: '2026-01-02',
  assetValue: 100,
  lastUpdated: '2026-01-03',
});

const renderPage = () => render(<UiProvider><CollegeReports /></UiProvider>);

beforeEach(() => {
  localStorage.setItem('language', 'en');
  apiClient.get.mockReset();
  apiClient.get.mockResolvedValue(makeResponse([asset('Microscope')]));
});

test('shows the report loading state before the backend responds', async () => {
  let resolveRequest;
  apiClient.get.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
  renderPage();

  expect(screen.getByText('Loading report data...')).toHaveAttribute('aria-busy', 'true');
  resolveRequest(makeResponse([asset('Microscope')]));
  expect(await screen.findByText('Microscope')).toBeInTheDocument();
});

test('shows a retryable API error and then distinguishes a successful empty result', async () => {
  apiClient.get
    .mockRejectedValueOnce({ response: { status: 500, data: { message: 'Report service unavailable' } } })
    .mockResolvedValueOnce(makeResponse([]));
  renderPage();

  expect(await screen.findByRole('alert')).toHaveTextContent('Report service unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No report data found for the selected filters.')).toBeInTheDocument();
});

test('refresh reloads the report from the API', async () => {
  renderPage();
  expect(await screen.findByText('Microscope')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  expect(apiClient.get.mock.calls[1][0]).toBe('/api/college/reports');
});

test('exports every page of the selected filtered report data', async () => {
  apiClient.get
    .mockResolvedValueOnce(makeResponse([asset('Microscope')]))
    .mockResolvedValueOnce(makeResponse([asset('Microscope')]))
    .mockResolvedValueOnce(makeResponse([asset('Microscope')], { page: 1, total: 2, totalPages: 2 }))
    .mockResolvedValueOnce(makeResponse([asset('Projector')], { page: 2, total: 2, totalPages: 2 }));

  const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:college-report') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  try {
    renderPage();
    expect(await screen.findByText('Microscope')).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '7' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export' })).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(4));
    expect(apiClient.get.mock.calls[2][1].params).toEqual(expect.objectContaining({
      page: 1,
      limit: 100,
      reportType: 'inventory',
      departmentId: '7',
    }));
    expect(apiClient.get.mock.calls[3][1].params).toEqual(expect.objectContaining({
      page: 2,
      limit: 100,
      reportType: 'inventory',
      departmentId: '7',
    }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalled();
  } finally {
    anchorClick.mockRestore();
    if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
    else delete URL.createObjectURL;
    if (originalRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
    else delete URL.revokeObjectURL;
  }
});
