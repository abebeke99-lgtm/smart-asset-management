import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import ICTDashboard from './ICTDashboard';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: jest.fn(),
}));

jest.mock('react-chartjs-2', () => ({
  Doughnut: () => <div data-testid="doughnut-chart" />,
  Bar: () => <div data-testid="bar-chart" />,
  Line: () => <div data-testid="line-chart" />,
}));

describe('ICTDashboard', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: { fullName: 'ICT Officer', username: 'ict_officer', role: 'ict_officer' },
    });

    useLanguage.mockReturnValue({ theme: 'light' });

    apiClient.get.mockImplementation((url) => {
      if (url === '/api/ict/dashboard') {
        return Promise.resolve({
          data: {
            success: true,
            dashboard: {
              totalAssets: 0,
              assignedAssets: 0,
              availableAssets: 0,
              maintenanceAssets: 0,
              repairAssets: 0,
              pendingRequests: 0,
              openIncidents: 0,
              supportTickets: 0,
              expiringLicenses: 0,
              assetStatus: [],
              assetCategories: [],
              recentActivity: [],
              requests: [],
              operationalOverview: { openIncidents: 0, upcomingMaintenance: 0, databaseStatus: { status: 'connected' } },
              databaseStatus: { status: 'connected', checkedAt: '2026-09-26T00:00:00.000Z' },
              assets: [],
              assignments: [],
              maintenance: [],
              notifications: [],
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('renders the operational overview and keeps zero-valued metrics visible', async () => {
    render(
      <MemoryRouter>
        <ICTDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'ICT Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Overview of ICT asset operations and maintenance.')).toBeInTheDocument();
    expect(screen.queryByText('Portfolio at a glance')).not.toBeInTheDocument();
    expect(screen.getByText('Total ICT Assets')).toBeInTheDocument();
    expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    expect(screen.getByText('Expiring Licenses')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create asset/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign asset/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate report/i })).not.toBeInTheDocument();
    expect(screen.getByText('No data available.')).toBeInTheDocument();
    expect(screen.getByText('No recent activity.')).toBeInTheDocument();
  });

  it('shows API errors and retries the dashboard request', async () => {
    apiClient.get.mockReset();
    apiClient.get
      .mockRejectedValueOnce({ response: { data: { message: 'Dashboard query failed.' } } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          dashboard: {
            totalAssets: 0, assignedAssets: 0, availableAssets: 0, maintenanceAssets: 0, repairAssets: 0,
            pendingRequests: 0, openIncidents: 0, supportTickets: 0, expiringLicenses: 0,
            assetStatus: [], assetCategories: [], recentActivity: [], notifications: [], requests: [],
            operationalOverview: { openIncidents: 0, upcomingMaintenance: 0 },
            databaseStatus: { status: 'connected' },
          },
        },
      });

    render(<MemoryRouter><ICTDashboard /></MemoryRouter>);
    expect(await screen.findByText('Dashboard query failed.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('heading', { name: 'ICT Dashboard' })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('shows loading state while the dashboard request is pending', () => {
    apiClient.get.mockReturnValueOnce(new Promise(() => {}));
    render(<MemoryRouter><ICTDashboard /></MemoryRouter>);
    expect(screen.getByLabelText('Loading dashboard')).toBeInTheDocument();
  });

  it('renders non-zero metrics returned by the API', async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        success: true,
        dashboard: {
          totalAssets: 7, assignedAssets: 3, availableAssets: 2, maintenanceAssets: 1, repairAssets: 1,
          pendingRequests: 4, openIncidents: 2, supportTickets: 5, expiringLicenses: 6,
          assetStatus: [{ label: 'Available', count: 2 }], assetCategories: [{ label: 'Laptop', count: 7 }],
          recentActivity: [], notifications: [], requests: [],
          operationalOverview: { openIncidents: 2, upcomingMaintenance: 1 },
          databaseStatus: { status: 'connected' },
        },
      },
    });

    render(<MemoryRouter><ICTDashboard /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'ICT Dashboard' });
    expect(screen.getByText('Total ICT Assets').parentElement.querySelector('strong')).toHaveTextContent('7');
    expect(screen.getByText('Assigned Assets').parentElement.querySelector('strong')).toHaveTextContent('3');
    expect(screen.getByText('Expiring Licenses').parentElement.querySelector('strong')).toHaveTextContent('6');
  });

  it('refreshes by requesting fresh dashboard data', async () => {
    render(<MemoryRouter><ICTDashboard /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'ICT Dashboard' });
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  });
});
