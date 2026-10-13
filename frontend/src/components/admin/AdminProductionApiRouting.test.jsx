import React from 'react';
import { render, waitFor } from '@testing-library/react';
import Departments from './AdminDepartmentManagement';
import Settings from './AdminSettings';
import Backup from './AdminBackup';
import Locations from './Locations';
import AssetCategories from './AssetCategories';
import Colleges from './AdminCollegeManagement';

jest.mock('../../utils/api', () => ({
  apiBase: () => 'https://api.example',
  apiClient: { get: jest.fn(), post: jest.fn() },
  apiFetch: jest.fn(),
  getApiErrorMessage: (error, fallback) => error.message || fallback,
}));

const { apiClient, apiFetch } = require('../../utils/api');

const jsonResponse = (data = {}) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: { get: () => 'application/json' },
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn().mockResolvedValue(JSON.stringify(data)),
});

describe('admin page API routing', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
    apiFetch.mockResolvedValue(jsonResponse({ success: true, data: [] }));
    apiClient.get.mockResolvedValue({ data: { success: true, data: [] } });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('loads departments and colleges through the shared API client', async () => {
    render(<Departments />);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        'https://api.example/api/departments',
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
      expect(apiFetch).toHaveBeenCalledWith(
        'https://api.example/api/colleges',
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
    });
  });

  test('reports a college API failure instead of silently ignoring it', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    apiFetch.mockImplementation((url) => Promise.resolve(
      url === 'https://api.example/api/colleges'
        ? { ok: false, status: 503 }
        : jsonResponse({ departments: [] }),
    ));

    render(<Departments />);

    await waitFor(() => {
      expect(warning).toHaveBeenCalledWith(
        'College list could not be loaded:',
        expect.objectContaining({ message: 'Unable to load colleges (503)' }),
      );
    });
  });

  test('shows a readable message when an API response is HTML', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    apiFetch.mockImplementation((url) => Promise.resolve(
      url === 'https://api.example/api/colleges'
        ? {
          ok: true,
          status: 200,
          json: jest.fn().mockRejectedValue(Object.assign(
            new Error('The API returned an unexpected non-JSON response.'),
            { code: 'API_NON_JSON_RESPONSE' },
          )),
        }
        : jsonResponse({ departments: [] }),
    ));

    render(<Departments />);

    await waitFor(() => {
      expect(warning).toHaveBeenCalledWith(
        'College list could not be loaded:',
        expect.objectContaining({ message: 'The API returned an unexpected non-JSON response.' }),
      );
    });
  });

  test('loads settings and backup history through the shared API client', async () => {
    render(<Settings />);
    render(<Backup />);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        'https://api.example/api/settings',
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
      expect(apiClient.get).toHaveBeenCalledWith('/admin/backups', {
        headers: { Accept: 'application/json' },
      });
    });
  });

  test('loads locations and asset categories from the configured API origin', async () => {
    render(<Locations />);
    render(<AssetCategories />);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        'https://api.example/api/locations',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(apiFetch).toHaveBeenCalledWith(
        'https://api.example/api/asset-categories',
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  test('loads colleges and campuses from the configured API origin', async () => {
    render(<Colleges />);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        'https://api.example/api/admin/colleges?limit=100',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(apiFetch).toHaveBeenCalledWith(
        'https://api.example/api/locations/campuses?status=active&limit=500',
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });
});
