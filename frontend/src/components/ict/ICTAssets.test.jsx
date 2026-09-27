import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import ICTAssets from './ICTAssets';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('react-toastify', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

describe('ICTAssets workspace', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: { role: 'ict_officer' },
    });

    apiClient.get.mockImplementation((url) => {
      if (url === '/api/ict/assets') {
        return Promise.resolve({
          data: {
            success: true,
            assets: [
              {
                id: 1,
                name: 'Laptop',
                assetTag: 'AST-001',
                category: 'Computer',
                serialNumber: 'SN-1001',
                department: 'ICT',
                location: 'Main Lab',
                assignedTo: 'Alemu',
                condition: 'Good',
                status: 'Assigned',
                updatedAt: '2026-09-24T00:00:00.000Z',
              },
            ],
            total: 1,
            pagination: { page: 1, pages: 1, limit: 25 },
            summary: { total: 1, available: 0, assigned: 1, maintenance: 0, damaged: 0, missing: 0 },
          },
        });
      }

      if (url === '/api/ict/assets/options') {
        return Promise.resolve({
          data: {
            categories: [{ id: 1, name: 'Computer' }],
            departments: [{ id: 1, name: 'ICT' }],
            statuses: ['Available', 'Assigned', 'In Maintenance', 'Missing'],
            conditions: ['Good', 'Fair', 'Poor'],
          },
        });
      }

      return Promise.resolve({ data: {} });
    });
  });

  it('renders the formal ICT asset register heading and includes sorting controls', async () => {
    render(
      <MemoryRouter>
        <ICTAssets />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'ICT Assets' })).toBeInTheDocument();
    expect(screen.getByText('Manage, track, assign, transfer, maintain, and verify university ICT assets.')).toBeInTheDocument();
    expect(screen.queryByText('Total Equipment')).not.toBeInTheDocument();
    expect(screen.getByText('Asset register')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort ICT assets by')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort direction')).toBeInTheDocument();
  });

  it('shows the required summary cards and uses the professional ICT asset labels', async () => {
    render(
      <MemoryRouter>
        <ICTAssets />
      </MemoryRouter>
    );

    const summary = await screen.findByRole('region', { name: 'ICT asset summary' });
    expect(within(summary).getByText('Total Assets')).toBeInTheDocument();
    expect(within(summary).getByText('Assigned')).toBeInTheDocument();
    expect(within(summary).getByText('Available')).toBeInTheDocument();
    expect(within(summary).getByText('Maintenance')).toBeInTheDocument();
    expect(within(summary).getByText('Missing')).toBeInTheDocument();
    expect(screen.queryByText(/svg/i)).not.toBeInTheDocument();
  });

  it('shows a scoped empty state and an authorized add-asset action', async () => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/api/ict/assets') {
        return Promise.resolve({
          data: {
            success: true,
            assets: [],
            total: 0,
            pagination: { page: 1, pages: 1, totalPages: 1, total: 0, limit: 25 },
            summary: { total: 0, available: 0, assigned: 0, maintenance: 0, missing: 0 },
          },
        });
      }

      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter>
        <ICTAssets />
      </MemoryRouter>
    );

    expect(await screen.findByText('No ICT assets are available in your authorized scope.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add ict asset/i })).toBeInTheDocument();
  });

  it('shows an API failure instead of treating it as an empty register', async () => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/api/ict/assets') {
        return Promise.reject({ response: { status: 500 } });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter>
        <ICTAssets />
      </MemoryRouter>
    );

    expect(await screen.findByText('The server could not load ICT assets.')).toBeInTheDocument();
    expect(screen.queryByText('No ICT assets found')).not.toBeInTheDocument();
    expect(screen.getByText('The asset register could not be loaded.')).toBeInTheDocument();
  });

  it('exports each page returned by the authorized ICT assets API', async () => {
    const createObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const clickLink = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:ict-assets') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    apiClient.get.mockImplementation((url, config) => {
      if (url === '/api/ict/assets/options') return Promise.resolve({ data: {} });
      if (config.params.limit === 100) {
        return Promise.resolve({
          data: {
            success: true,
            assets: config.params.page === 1 ? [{ id: 1, name: 'Laptop' }] : [{ id: 2, name: 'Monitor' }],
            pagination: { page: config.params.page, limit: 100, total: 101, pages: 2, totalPages: 2 },
          },
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          assets: [{ id: 1, name: 'Laptop', status: 'available' }],
          total: 101,
          summary: { total: 101, assigned: 0, available: 101, maintenance: 0, missing: 0 },
          pagination: { page: 1, limit: 25, total: 101, pages: 5, totalPages: 5 },
        },
      });
    });

    try {
      render(
        <MemoryRouter>
          <ICTAssets />
        </MemoryRouter>
      );

      await screen.findByRole('heading', { name: 'ICT Assets' });
      fireEvent.click(screen.getByRole('button', { name: 'Export' }));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/api/ict/assets', expect.objectContaining({
          params: expect.objectContaining({ page: 2, limit: 100 }),
        }));
      });
      expect(clickLink).toHaveBeenCalled();
    } finally {
      clickLink.mockRestore();
      if (createObjectUrl) Object.defineProperty(URL, 'createObjectURL', createObjectUrl);
      else delete URL.createObjectURL;
      if (revokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrl);
      else delete URL.revokeObjectURL;
    }
  });

  it('loads status-tab results from the backend and resets to the first page', async () => {
    render(
      <MemoryRouter>
        <ICTAssets />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'ICT Assets' });
    fireEvent.click(screen.getByRole('tab', { name: 'Maintenance' }));

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/ict/assets',
        expect.objectContaining({
          params: expect.objectContaining({ statusTab: 'maintenance', page: 1 }),
        }),
      );
    });
  });
});
