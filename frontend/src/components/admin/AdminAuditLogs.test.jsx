import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { UIProvider } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import AdminAuditLogs from './AdminAuditLogs';

jest.mock('../../utils/api', () => ({
  apiClient: { get: jest.fn() },
  apiBase: () => '',
}));

describe('AdminAuditLogs statistics', () => {
  beforeEach(() => {
    localStorage.clear();
    apiClient.get.mockImplementation((url) => {
      if (url === '/api/users') return Promise.resolve({ data: { users: [] } });
      if (url === '/api/admin/audit-logs') {
        return Promise.resolve({
          data: {
            success: true,
            data: Array.from({ length: 15 }, (_, index) => ({
              id: index + 1,
              action: 'LOGIN',
              entity: 'user',
              module: 'user',
              userId: index % 2 + 1,
              result: 'Success',
              timestamp: '2026-10-13T00:00:00.000Z',
            })),
            total: 617,
            totalEvents: 617,
            stats: {
              filtered: 617,
              successful: 610,
              failed: 7,
              securityEvents: 2,
              uniqueUsers: 24,
            },
            pagination: { page: 1, limit: 15, total: 617, pages: 42 },
          },
        });
      }
      return Promise.reject(new Error(`Unexpected API call: ${url}`));
    });
  });

  it('shows dataset counts instead of treating the 15-row page as the filtered total', async () => {
    render(
      <UIProvider>
        <AdminAuditLogs />
      </UIProvider>
    );

    const totalCardLabel = await screen.findByText('Total Events');
    const filteredCardLabel = screen.getByText('Filtered Events');
    const successfulCardLabel = screen.getByText('Successful');

    expect(within(totalCardLabel.parentElement.parentElement).getByText('617')).toBeInTheDocument();
    expect(within(filteredCardLabel.parentElement.parentElement).getByText('617')).toBeInTheDocument();
    expect(within(successfulCardLabel.parentElement.parentElement).getByText('610')).toBeInTheDocument();
    expect(screen.getByText('617', { selector: 'strong' })).toBeInTheDocument();
  });
});
