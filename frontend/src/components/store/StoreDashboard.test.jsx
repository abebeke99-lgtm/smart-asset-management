import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import StoreDashboard from './StoreDashboard';
import { apiClient } from '../../utils/api';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 12, role: 'store_manager', fullName: 'Store Manager' } }),
}));

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar-chart" />,
  Line: () => <div data-testid="line-chart" />,
}));

const CurrentPath = () => <output>{useLocation().pathname}</output>;

const renderDashboard = () => render(
  <MemoryRouter initialEntries={['/store']}>
    <Routes>
      <Route path="/store" element={<><StoreDashboard /><CurrentPath /></>} />
      <Route path="/store/available-assets" element={<p>Available assets destination</p>} />
    </Routes>
  </MemoryRouter>
);

describe('Store Manager dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads real dashboard data from the Store API and navigates to the matching Store page', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          kpis: { totalInventory: 42, availableAssets: 25, assignedAssets: 12, damagedItems: 5, lowStock: 3 },
          inventoryByStatus: { available: 25, assigned: 12, damaged: 5 },
          categories: { Furniture: 42 },
          stockMovement: { received: 7 },
          monthlyMovements: [],
          pendingTransactions: [{ type: 'Request', count: 2, route: '/store/requests' }],
          recentActivities: [],
          lowStockAlerts: [],
          verification: {},
          status: {},
          today: {},
          health: { api: 'online', database: 'connected' },
        },
      },
    });

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Physical Asset Movement & Inventory Control' })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/api/store/dashboard', { timeout: 10000 });
    expect(screen.getByRole('button', { name: /25.*Available Assets/i })).toBeInTheDocument();
    expect(document.querySelectorAll('.store-kpi')).toHaveLength(8);
    expect(screen.queryByText('Pending Requests')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending Transfers')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /25.*Available Assets/i }));
    expect(await screen.findByText('Available assets destination')).toBeInTheDocument();
  });

  it('shows empty-state content for a successful response with no inventory or activity', async () => {
    apiClient.get.mockResolvedValue({ data: { success: true, data: {} } });

    renderDashboard();

    expect(await screen.findAllByText('No inventory data available')).toHaveLength(2);
    expect(screen.getByText('No low-stock items')).toBeInTheDocument();
    expect(screen.getAllByText('No store activity yet')).toHaveLength(3);
  });

  it('shows an API error and retries the dashboard request', async () => {
    apiClient.get
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({ data: { success: true, data: {} } });

    renderDashboard();

    expect(await screen.findByText('Unable to load Store dashboard')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findAllByText('No inventory data available')).toHaveLength(2);
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });
});
