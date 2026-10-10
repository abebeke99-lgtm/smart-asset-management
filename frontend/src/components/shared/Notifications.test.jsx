import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Notifications from './Notifications';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('shared notifications permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockResolvedValue({
      data: {
        notifications: [{
          id: 4,
          title: 'Personal alert',
          message: 'Review the request.',
          read: false,
          created_at: '2026-10-09T10:00:00.000Z',
        }],
        summary: { total: 1, unread: 1, read: 0 },
        pagination: { page: 1, totalPages: 1 },
      },
    });
  });

  test('does not show delete to a role without notification delete permission', async () => {
    useAuth.mockReturnValue({ user: { id: 7, role: 'student', permissions: [] } });
    render(<MemoryRouter><Notifications /></MemoryRouter>);

    expect(await screen.findByText('Personal alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete notification:/ })).not.toBeInTheDocument();
  });

  test('shows delete for a role granted notification deletion by default', async () => {
    useAuth.mockReturnValue({ user: { id: 8, role: 'maintenance', permissions: [] } });
    render(<MemoryRouter><Notifications /></MemoryRouter>);

    expect(await screen.findByText('Personal alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete notification: Personal alert/ })).toBeInTheDocument();
  });
});
