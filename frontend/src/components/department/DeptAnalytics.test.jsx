import React from 'react';
import { render, screen } from '@testing-library/react';
import apiClient from '../../services/apiClient';
import DeptAnalytics from './DeptAnalytics';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getApiErrorMessage: jest.fn((error, fallback) => error?.message || fallback),
}));

jest.mock('react-chartjs-2', () => ({
  Bar: ({ data }) => <div data-testid="bar-chart">{data.labels.join(', ')}</div>,
  Doughnut: ({ data }) => <div data-testid="doughnut-chart">{data.labels.join(', ')}</div>,
}));

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ theme: 'light' }),
}));

const analytics = {
  assetUtilization: { statuses: [{ label: 'Active', count: 8 }], total: 8, assignments: [], activeAssignments: 3 },
  assetCondition: { conditions: [{ label: 'Good', count: 7 }], discrepancies: 1 },
  inventory: { totalItems: 4, quantity: 10, available: 7, reserved: 1, damaged: 2, lowStock: 1 },
  approvals: [{ label: 'Pending', count: 2 }],
  service: { statuses: [{ label: 'Submitted', count: 3 }], maintenanceStatuses: {} },
  ticketAging: { under24Hours: 1, from24To72Hours: 1, over72Hours: 1, escalated: 1, overdue: 0 },
  transfers: [],
  laboratories: 2,
};

test('renders department analytics for assets, condition, inventory, approvals and tickets', async () => {
  apiClient.get.mockResolvedValue({ data: { success: true, data: analytics } });
  render(<DeptAnalytics />);

  expect(await screen.findByText('Department Analytics')).toBeInTheDocument();
  expect(await screen.findByText('Verification discrepancies')).toBeInTheDocument();
  expect(screen.getByText('Inventory quantities')).toBeInTheDocument();
  expect(screen.getByText('Approval status')).toBeInTheDocument();
  expect(screen.getByText('Ticket aging')).toBeInTheDocument();
  expect(screen.getAllByTestId('doughnut-chart')).toHaveLength(2);
  expect(screen.getAllByTestId('bar-chart')).toHaveLength(4);
  expect(apiClient.get).toHaveBeenCalledWith('/api/department-head/analytics');
});
