import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import DeptLocations from './DeptLocations';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getApiErrorMessage: jest.fn((error, fallback) => error?.response?.data?.message || error?.message || fallback),
}));

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../contexts/UiContext', () => ({ useLanguage: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('xlsx', () => ({
  utils: {
    json_to_sheet: jest.fn((rows) => ({ rows })),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  writeFile: jest.fn(),
}));

const location = {
  id: 11,
  code: 'LAB-11',
  name: 'Physics Lab',
  building: 'Science Hall',
  room: 'Physics Lab',
  type: 'laboratory',
  department: 'Engineering',
  responsibleStaff: 'Aster Lecturer',
  status: 'active',
  description: 'Teaching laboratory',
  assetCount: 8,
  recordType: 'room',
};
const response = (data = [location], overrides = {}) => ({
  data: {
    success: true,
    data,
    department: { id: 3, name: 'Engineering', code: 'ENG' },
    college: { id: 2, name: 'Engineering College' },
    summary: { total: data.length, active: data.length, inactive: 0, locationsWithAssets: data.length },
    filters: { types: ['laboratory', 'department_location'] },
    pagination: { page: 1, pages: 1, total: data.length },
    ...overrides,
  },
});

describe('Department Head locations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockReset();
    apiClient.get.mockResolvedValue(response());
    XLSX.utils.book_new.mockReturnValue({ SheetNames: [], Sheets: {} });
    XLSX.utils.book_append_sheet.mockImplementation(() => {});
    XLSX.writeFile.mockImplementation(() => {});
    useAuth.mockReturnValue({
      user: { id: 4, role: 'department_head', departmentId: 3, permissions: [] },
      hasPermission: jest.fn(() => false),
    });
    useLanguage.mockReturnValue({ language: 'en' });
  });

  it('loads real scoped locations and displays building, room, type, department and asset information', async () => {
    render(<DeptLocations />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading department locations');
    expect(await screen.findByRole('heading', { name: 'Department Locations' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Physics Lab' })).toBeInTheDocument();
    expect(screen.getByText('Science Hall')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Aster Lecturer')).toBeInTheDocument();
    expect(screen.getByText('8 assets')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/locations', {
      params: { search: '', status: 'all', type: 'all', page: 1, limit: 25 },
    });
  });

  it('searches and filters by status and type without sending a department identifier', async () => {
    render(<DeptLocations />);
    await screen.findByRole('heading', { name: 'Physics Lab' });
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'active' } });
    fireEvent.change(screen.getByLabelText('Filter by location type'), { target: { value: 'laboratory' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/department-head/locations', {
      params: { search: '', status: 'active', type: 'laboratory', page: 1, limit: 25 },
    }));

    fireEvent.change(screen.getByLabelText('Search department locations'), { target: { value: 'Physics' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/department-head/locations', {
      params: { search: 'Physics', status: 'active', type: 'laboratory', page: 1, limit: 25 },
    }), { timeout: 1500 });
  });

  it('views location details and closes the dialog', async () => {
    render(<DeptLocations />);
    fireEvent.click(await screen.findByRole('button', { name: 'View' }));

    const dialog = screen.getByRole('dialog', { name: 'Physics Lab' });
    expect(dialog).toHaveTextContent('LAB-11');
    expect(dialog).toHaveTextContent('Science Hall');
    expect(dialog).toHaveTextContent('Engineering College');
    expect(dialog).toHaveTextContent('Aster Lecturer');
    expect(dialog).toHaveTextContent('8');
    fireEvent.click(screen.getByRole('button', { name: 'Close location details' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('refreshes and retries after a request error', async () => {
    render(<DeptLocations />);

    expect(await screen.findByRole('heading', { name: 'Physics Lab' })).toBeInTheDocument();
    apiClient.get.mockImplementation(() => Promise.reject(new Error('Location service unavailable')));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Location service unavailable');
    apiClient.get.mockResolvedValue(response());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Physics Lab' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/department-head/locations', {
      params: { search: '', status: 'all', type: 'all', page: 1, limit: 25 },
    }));
  });

  it('exports all scoped locations only when reports.export is granted', async () => {
    useAuth.mockReturnValue({
      user: { id: 4, role: 'department_head', departmentId: 3, permissions: ['reports.export'] },
      hasPermission: jest.fn(() => true),
    });
    const secondLocation = { ...location, id: 12, name: 'Chemistry Lab' };
    apiClient.get.mockImplementation((_url, { params }) => {
      if (params.export && params.page === 1) {
        return Promise.resolve(response([location], { pagination: { page: 1, pages: 2, total: 2 } }));
      }
      if (params.export && params.page === 2) {
        return Promise.resolve(response([secondLocation], { pagination: { page: 2, pages: 2, total: 2 } }));
      }
      return Promise.resolve(response());
    });

    render(<DeptLocations />);
    fireEvent.click(await screen.findByRole('button', { name: 'Export' }));
    await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'department-locations.xlsx'));
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/locations', {
      params: { search: '', status: 'all', type: 'all', export: true, page: 1, limit: 100 },
    });
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/locations', {
      params: { search: '', status: 'all', type: 'all', export: true, page: 2, limit: 100 },
    });
    expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ 'Location ID': 11, Building: 'Science Hall', Room: 'Physics Lab' }),
      expect.objectContaining({ 'Location ID': 12 }),
    ]));
    expect(toast.success).toHaveBeenCalled();
  });

  it('uses Amharic labels and presents an empty state', async () => {
    useLanguage.mockReturnValue({ language: 'am' });
    apiClient.get.mockResolvedValue(response([], {
      summary: { total: 0, active: 0, inactive: 0, locationsWithAssets: 0 },
      pagination: { page: 1, pages: 1, total: 0 },
    }));
    render(<DeptLocations />);

    expect(await screen.findByRole('heading', { name: 'የዲፓርትመንት ቦታዎች' })).toBeInTheDocument();
    expect(await screen.findByText('ምንም የዲፓርትመንት ቦታ አልተገኘም።')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'አድስ' })).toBeInTheDocument();
  });
});
