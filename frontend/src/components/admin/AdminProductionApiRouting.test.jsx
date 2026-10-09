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
  apiClient: { post: jest.fn() },
}));

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
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example/api/colleges',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        }),
      );
    });
  });

  test('reports a college API failure instead of silently ignoring it', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch.mockImplementation((url) => Promise.resolve(
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

  test('reports an HTML response parse failure from the colleges API', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch.mockImplementation((url) => Promise.resolve(
      url === 'https://api.example/api/colleges'
        ? {
          ok: true,
          status: 200,
          json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON')),
        }
        : jsonResponse({ departments: [] }),
    ));

    render(<Departments />);

    await waitFor(() => {
      expect(warning).toHaveBeenCalledWith(
        'College list could not be loaded:',
        expect.objectContaining({ message: 'Unexpected token < in JSON' }),
      );
    });
  });

  test('loads settings from the configured API origin', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example/api/settings',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        }),
      );
    });
  });

  test('loads backups from the configured API origin', async () => {
    render(<Backup />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example/api/admin/backups',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        }),
      );
    });
  });

  test('loads locations from the configured API origin', async () => {
    render(<Locations />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example/api/locations',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Bearer /) }),
        }),
      );
    });
  });

  test('loads asset categories from the configured API origin', async () => {
    render(<AssetCategories />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example/api/asset-categories',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Bearer /) }),
        }),
      );
    });
  });

  test('loads colleges and campuses from the configured API origin', async () => {
    render(<Colleges />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example/api/admin/colleges?limit=100',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Bearer /) }),
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example/api/locations/campuses?status=active&limit=500',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Bearer /) }),
        }),
      );
    });
  });
});
