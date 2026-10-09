import React from 'react';
import { render, waitFor } from '@testing-library/react';
import Departments from './AdminDepartmentManagement';
import Settings from './AdminSettings';
import Backup from './AdminBackup';

jest.mock('../../utils/api', () => ({
  apiBase: () => 'https://api.example',
  apiClient: { post: jest.fn() },
}));

const jsonResponse = (data = {}) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn().mockResolvedValue(JSON.stringify(data)),
});

describe('admin page API routing', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue(jsonResponse());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads departments and colleges from the configured API origin', async () => {
    render(<Departments />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example/api/departments',
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example/api/colleges',
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
    });
  });

  test('loads settings from the configured API origin', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example/api/settings',
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
    });
  });

  test('loads backups from the configured API origin', async () => {
    render(<Backup />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example/api/admin/backups',
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
    });
  });
});
