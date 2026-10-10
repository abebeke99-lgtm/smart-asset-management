import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminNotifications from './AdminNotifications';
import { apiClient } from '../../utils/api';

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('react-toastify', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const scheduledNotification = {
  id: 17,
  title: 'Scheduled notice',
  message: 'Scheduled message',
  type: 'system',
  priority: 'medium',
  status: 'scheduled',
  channel: 'in_app',
  read: false,
};

const notificationList = (rows = []) => ({
  data: {
    data: rows,
    summary: { total: rows.length, unread: rows.length, read: 0, highPriority: 0, today: 0 },
    pagination: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
  },
});

describe('AdminNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockImplementation((url) => Promise.resolve(
      url === '/api/admin/notifications/recipients'
        ? { data: { data: [{ id: 8, fullName: 'ICT User', username: 'ict.user', email: 'ict@example.test', role: 'ict_officer' }], roles: ['admin', 'ict_officer'] } }
        : notificationList(),
    ));
    apiClient.post.mockResolvedValue({ data: { success: true } });
    apiClient.put.mockResolvedValue({ data: { success: true } });
    apiClient.delete.mockResolvedValue({ data: { success: true } });
  });

  test('Administrator can create and publish a role-targeted notification', async () => {
    render(<AdminNotifications />);
    await screen.findByText('No notifications found.');
    fireEvent.click(screen.getByRole('button', { name: 'Create Notification' }));

    fireEvent.change(screen.getByLabelText('Recipient type'), { target: { value: 'role' } });
    const roleSelector = screen.getByLabelText('Select notification roles');
    await screen.findByRole('option', { name: 'ict officer' });
    fireEvent.change(screen.getByLabelText('Notification title'), { target: { value: 'Planned maintenance' } });
    fireEvent.change(screen.getByLabelText('Notification message'), { target: { value: 'Maintenance begins at 18:00.' } });
    roleSelector.options[1].selected = true;
    fireEvent.change(roleSelector);
    fireEvent.click(screen.getByRole('button', { name: 'Publish Notification' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/admin/notifications/bulk', expect.objectContaining({
        title: 'Planned maintenance',
        message: 'Maintenance begins at 18:00.',
        recipientType: 'role',
        roles: ['ict_officer'],
        channels: ['in_app'],
      }));
    });
  });

  test('Administrator can edit scheduled content and permanently delete a notification', async () => {
    apiClient.get.mockResolvedValue(notificationList([scheduledNotification]));
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdminNotifications />);

    await screen.findByText('Scheduled notice');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Notification title'), { target: { value: 'Updated scheduled notice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith('/api/admin/notifications/17', expect.objectContaining({
        title: 'Updated scheduled notice',
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/api/admin/notifications/17');
    });
    confirm.mockRestore();
  });
});
