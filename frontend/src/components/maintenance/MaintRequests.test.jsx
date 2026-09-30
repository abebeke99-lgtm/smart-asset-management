import React from 'react';
import { render, screen } from '@testing-library/react';
import MaintRequests from './MaintRequests';
import { apiClient } from '../../utils/api';
import { getAssets, getMaintenancePage, getTechnicians } from '../../services/maintenanceApi';

jest.mock('../../utils/api', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('../../services/maintenanceApi', () => ({
  getAssets: jest.fn(),
  getMaintenancePage: jest.fn(),
  getTechnicians: jest.fn(),
  createMaintenance: jest.fn(),
  updateMaintenance: jest.fn(),
  setMaintenanceStatus: jest.fn(),
  removeMaintenance: jest.fn(),
  assignMaintenance: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockResolvedValue({ data: { data: [] } });
  getAssets.mockResolvedValue([]);
  getTechnicians.mockResolvedValue([]);
  getMaintenancePage.mockResolvedValue({
    items: [
      { id: 1, refId: 'REQ-001', asset: 'Laptop', priority: 'Medium', status: 'Pending' },
      { id: 2, refId: 'REQ-002', asset: 'Projector', priority: 'Low', status: 'Completed' },
    ],
    pagination: { total: 2, pages: 1 },
  });
});

test('renders normalized maintenance requests with priority, status, and table styles', async () => {
  const { container } = render(<MaintRequests />);

  expect(await screen.findByText('REQ-001')).toBeInTheDocument();
  expect(container.querySelector('thead tr')).toHaveStyle({ backgroundColor: 'var(--color-table-header)' });
  expect(container.querySelectorAll('tbody tr')[0]).toHaveStyle({ backgroundColor: 'var(--color-surface)' });
  expect(container.querySelectorAll('tbody tr')[1]).toHaveStyle({ backgroundColor: 'var(--color-table-hover)' });
  const firstRow = container.querySelectorAll('tbody tr')[0];
  expect(firstRow.cells[6].querySelector('span')).toHaveClass('request-priority', 'request-priority-medium');
  expect(firstRow.cells[7].querySelector('span')).toHaveClass('request-status', 'request-status-pending');
});