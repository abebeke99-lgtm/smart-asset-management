import React from 'react';
import { render, screen } from '@testing-library/react';
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
              assets: [],
              assignments: [],
              maintenance: [],
              notifications: [],
              summary: { total: 0, assigned: 0, available: 0, maintenance: 0, repair: 0, retired: 0, pendingRequests: 0, openSupportTickets: 0, openIncidents: 0, upcomingMaintenance: 0, expiringLicenses: 0 },
              recentActivities: [],
              rfidDevices: [],
              health: { success: true, database: 'connected' },
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
  });
});
