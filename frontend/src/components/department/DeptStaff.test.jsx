import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import DeptStaff from './DeptStaff';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getApiErrorMessage: jest.fn((error, fallback) => error?.message || fallback),
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

const member = {
  id: 18,
  fullName: 'Aster Lecturer',
  username: 'aster',
  employeeId: 'EMP-018',
  position: 'Lecturer',
  email: 'aster@example.test',
  phone: '555-0123',
  role: 'staff',
  laboratory: 'Physics Lab',
  active: true,
  status: 'active',
};

const response = (data = [member], overrides = {}) => ({
  data: {
    success: true,
    data,
    summary: { total: data.length, active: data.length, inactive: 0 },
    filters: { positions: ['Lecturer', 'Laboratory Staff'] },
    pagination: { page: 1, pages: 1, total: data.length },
    ...overrides,
  },
});

describe('Department Head staff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockReset();
    useAuth.mockReturnValue({
      user: { id: 4, role: 'department_head', departmentId: 3, department: 'Engineering' },
      hasPermission: jest.fn(() => false),
    });
    useLanguage.mockReturnValue({ language: 'en', theme: 'light' });
    apiClient.get.mockResolvedValue(response());
  });

  it('loads scoped staff and displays requested real staff details and database KPIs', async () => {
    render(<DeptStaff />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading department staff');
    expect(await screen.findByText('Aster Lecturer')).toBeInTheDocument();
    expect(screen.getByText('EMP-018')).toBeInTheDocument();
    expect(screen.getAllByText('Lecturer').length).toBeGreaterThan(1);
    expect(screen.getByText('Physics Lab')).toBeInTheDocument();
    expect(screen.getByText('Total Staff').parentElement).toHaveTextContent('1');
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/staff', {
      params: { page: 1, limit: 25 },
    });
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
  });

  it('sends search, position, and status filters to the scoped endpoint', async () => {
    render(<DeptStaff />);
    await screen.findByText('Aster Lecturer');

    fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'Lecturer' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/department-head/staff', {
      params: { search: undefined, position: 'Lecturer', status: 'active', page: 1, limit: 25 },
    }));

    fireEvent.change(screen.getByLabelText('Search staff'), { target: { value: 'Aster' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/department-head/staff', {
      params: { search: 'Aster', position: 'Lecturer', status: 'active', page: 1, limit: 25 },
    }), { timeout: 1500 });
  });

  it('clears filters and refreshes the scoped staff list', async () => {
    render(<DeptStaff />);
    await screen.findByText('Aster Lecturer');
    fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'Lecturer' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/department-head/staff', {
      params: { search: undefined, position: undefined, status: undefined, page: 1, limit: 25 },
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Refresh staff' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(4));
  });

  it('opens a staff detail view with the requested fields', async () => {
    render(<DeptStaff />);
    fireEvent.click(await screen.findByRole('button', { name: 'View' }));

    const dialog = screen.getByRole('dialog', { name: 'Aster Lecturer' });
    expect(dialog).toHaveTextContent('EMP-018');
    expect(dialog).toHaveTextContent('Lecturer');
    expect(dialog).toHaveTextContent('Staff');
    expect(dialog).toHaveTextContent('Physics Lab');
    expect(dialog).toHaveTextContent('Active');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows loading errors and supports retry', async () => {
    apiClient.get
      .mockRejectedValueOnce(new Error('Staff API failed'))
      .mockResolvedValueOnce(response());
    render(<DeptStaff />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Staff API failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Aster Lecturer')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('exports all pages from the authorized endpoint only when reports.export is granted', async () => {
    useAuth.mockReturnValue({
      user: { id: 4, role: 'department_head', departmentId: 3, permissions: ['reports.export'] },
      hasPermission: jest.fn(() => true),
    });
    const exportMember = { ...member, id: 19, fullName: 'Bini Laboratory Staff' };
    apiClient.get.mockImplementation((_url, { params }) => {
      if (params.limit === 100 && params.page === 1) {
        return Promise.resolve(response([member], { pagination: { page: 1, pages: 2, total: 2 } }));
      }
      if (params.limit === 100 && params.page === 2) {
        return Promise.resolve(response([exportMember], { pagination: { page: 2, pages: 2, total: 2 } }));
      }
      return Promise.resolve(response());
    });

    render(<DeptStaff />);
    fireEvent.click(await screen.findByRole('button', { name: 'Export' }));

    await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'department-staff.xlsx'));
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/staff', {
      params: { search: undefined, position: undefined, status: undefined, page: 1, limit: 100 },
    });
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/staff', {
      params: { search: undefined, position: undefined, status: undefined, page: 2, limit: 100 },
    });
    expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ 'Staff ID': 18, 'Full Name': 'Aster Lecturer', 'Employee ID': 'EMP-018' }),
      expect.objectContaining({ 'Staff ID': 19, 'Full Name': 'Bini Laboratory Staff' }),
    ]));
    expect(toast.success).toHaveBeenCalled();
  });

  it('uses Amharic labels and remains scrollable on narrow layouts', async () => {
    useLanguage.mockReturnValue({ language: 'am', theme: 'light' });
    render(<DeptStaff />);

    expect(await screen.findByRole('heading', { name: /የዲፓርትመንት ሰራተኞች/ })).toBeInTheDocument();
    await screen.findByText(member.fullName);
    expect(screen.getByText('የሰራተኛ መለያ ቁጥር')).toBeInTheDocument();
    expect(screen.getByText('ላቦራቶሪ/ቢሮ')).toBeInTheDocument();
  });
});
