import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../utils/api';
import DeptNotifications from './DeptNotifications';

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

describe('Department Head notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockResolvedValue({
      data: {
        notifications: [
          {
            id: 51,
            title: 'New department request',
            message: 'Request AR-51 requires review.',
            type: 'approval',
            read: false,
            created_at: '2026-10-06T10:00:00.000Z',
            entityType: 'department_asset_request',
            entityId: 51,
          },
          {
            id: 52,
            title: 'Request approved',
            message: 'Request AR-52 was approved.',
            type: 'approval',
            read: true,
            read_at: '2026-10-06T11:00:00.000Z',
            created_at: '2026-10-06T10:30:00.000Z',
            entityType: 'department_asset_request',
            entityId: 52,
          },
        ],
        summary: { total: 2, unread: 1, read: 1 },
        pagination: { page: 1, totalPages: 1 },
      },
    });
    apiClient.patch.mockResolvedValue({ data: { unreadCount: 0 } });
  });

  it('loads persisted notification history and displays entity and read timestamps', async () => {
    render(
      <MemoryRouter initialEntries={['/department-head/notifications']}>
        <Routes>
          <Route path="/department-head/notifications" element={<DeptNotifications />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('New department request')).toBeInTheDocument();
    expect(screen.getByText('Request approved')).toBeInTheDocument();
    expect(screen.getByText('Related entity: department_asset_request #51')).toBeInTheDocument();
    expect(screen.getByText(/Read:/)).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications', expect.objectContaining({
      params: expect.objectContaining({ page: 1, limit: 20 }),
    }));
  });

  it('marks an unread notification as read when opened', async () => {
    render(
      <MemoryRouter initialEntries={['/department-head/notifications']}>
        <Routes>
          <Route path="/department-head/notifications" element={<DeptNotifications />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('New department request');
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[0]);

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('/api/notifications/51/read');
    });
  });
});
