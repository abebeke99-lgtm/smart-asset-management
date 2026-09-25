import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import DeptAssetHistory from './DeptAssetHistory';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const assetId = 12;
const requestUrls = [
  `/api/assets/${assetId}`,
  `/api/assets/${assetId}/assignments`,
  `/api/assets/${assetId}/maintenance`,
  `/api/rfid/history/${assetId}`,
];
const successResponses = {
  [`/api/assets/${assetId}`]: {
    data: {
      asset: {
        id: assetId,
        name: 'Laptop-01',
        assetCode: 'AST-1001',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    },
  },
  [`/api/assets/${assetId}/assignments`]: {
    data: {
      history: [
        {
          id: 201,
          status: 'active',
          createdAt: '2025-01-02T00:00:00.000Z',
          notes: 'Engineering assignment',
        },
      ],
    },
  },
  [`/api/assets/${assetId}/maintenance`]: {
    data: {
      history: [
        {
          id: 301,
          status: 'completed',
          updatedAt: '2025-01-03T00:00:00.000Z',
          problem: 'Battery replacement',
        },
      ],
    },
  },
  [`/api/rfid/history/${assetId}`]: {
    data: {
      logs: [
        {
          id: 401,
          timestamp: '2025-01-04T00:00:00.000Z',
          event: 'Scanned at Room B2',
          location: 'Room B2',
        },
      ],
    },
  },
};

const createDeferred = () => {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

const renderHistory = (path = `/department/history/${assetId}`) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/department/history" element={<DeptAssetHistory />} />
      <Route path="/department/history/:id" element={<DeptAssetHistory />} />
    </Routes>
  </MemoryRouter>
);

describe('DeptAssetHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => Promise.resolve(successResponses[url] || { data: {} }));
  });

  it('shows the loading state and renders the asset history from all four endpoints', async () => {
    const pending = Object.fromEntries(requestUrls.map((url) => [url, createDeferred()]));
    axios.get.mockImplementation((url) => pending[url].promise);

    renderHistory();
    expect(screen.getByText('Loading history...')).toBeInTheDocument();

    await act(async () => {
      requestUrls.forEach((url) => pending[url].resolve(successResponses[url]));
    });

    await waitFor(() => expect(screen.getByRole('heading', { name: /asset history/i })).toBeInTheDocument());
    expect(screen.getByText('Laptop-01')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('Maintenance: completed')).toBeInTheDocument();
    expect(screen.getByText('RFID Scanned')).toBeInTheDocument();
    expect(screen.getByText('Room B2')).toBeInTheDocument();
    requestUrls.forEach((url) => expect(axios.get).toHaveBeenCalledWith(url));
  });

  it('shows a selection prompt when no asset id is in the route', () => {
    renderHistory('/department/history');

    expect(screen.getByText('Select an asset from the asset list to view its history.')).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('shows the department access error when the asset request is forbidden', async () => {
    axios.get.mockImplementation((url) => url === `/api/assets/${assetId}`
      ? Promise.reject({ response: { status: 403 } })
      : Promise.resolve(successResponses[url]));

    renderHistory();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('This asset is outside your department.'));
  });
});
