import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '../../contexts/AuthContext';
import { exportIctReport, getIctReports } from '../../services/ictReportsService';
import ICTReports from './ICTReports';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/ictReportsService', () => ({
  exportIctReport: jest.fn(),
  getIctReports: jest.fn(),
}));

const inventoryResponse = {
  data: {
    success: true,
    reportType: 'inventory',
    data: [{
      id: 17,
      assetTag: 'ICT-017',
      name: 'Laptop 17',
      category: 'Computer',
      serialNumber: 'SN-017',
      status: 'available',
      condition: 'Good',
      department: 'ICT',
      location: 'Office 4',
      purchaseDate: '2026-01-12',
    }],
    summary: { totalAssets: 8, available: 4, assigned: 2, underMaintenance: 1 },
    filters: {
      categories: ['Computer'],
      statuses: ['available', 'assigned'],
      conditions: ['Good'],
      locations: ['Office 4'],
      departments: [{ id: 6, name: 'ICT' }],
    },
    pagination: { page: 1, limit: 25, total: 8, totalPages: 1 },
    scope: { collegeId: 3, collegeName: 'Science College' },
    generatedAt: '2026-10-04T00:00:00.000Z',
  },
};

describe('ICTReports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ hasPermission: () => true });
    getIctReports.mockResolvedValue(inventoryResponse);
  });

  test('renders live report rows, totals, scope, and filters', async () => {
    render(<ICTReports />);

    expect(await screen.findByText('Laptop 17')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asset Inventory' })).toBeInTheDocument();
    expect(screen.getByText('Data scope: Science College')).toBeInTheDocument();
    expect(screen.getByText('Total Assets')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by category' })).toHaveValue('');

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by category' }), {
      target: { value: 'Computer' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Search report' }), {
      target: { value: 'laptop' },
    });
    fireEvent.change(screen.getByLabelText('Date from'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Date to'), { target: { value: '2026-06-30' } });

    await waitFor(() => expect(getIctReports).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'inventory',
        search: 'laptop',
        category: 'Computer',
        dateFrom: '2026-01-01',
        dateTo: '2026-06-30',
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
  });

  test('supports the requested report types and hides exports without export permission', async () => {
    useAuth.mockReturnValue({ hasPermission: (permission) => permission === 'ict.reports.view' });
    render(<ICTReports />);
    await screen.findByText('Laptop 17');

    expect(screen.queryByRole('button', { name: 'CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument();

    const select = screen.getByRole('combobox', { name: 'Select report' });
    [
      ['assignments', 'Assignment'],
      ['maintenance', 'Maintenance'],
      ['damaged', 'Damaged Assets'],
      ['warranty', 'Warranty'],
      ['transfers', 'Transfer'],
      ['support', 'Service Tickets'],
      ['incidents', 'Incidents'],
      ['software-licenses', 'Software Licenses'],
    ].forEach(([value, label]) => {
      expect(Array.from(select.options).some((option) => option.value === value && option.textContent === label)).toBe(true);
    });
  });

  test('requests CSV export using the current report filters', async () => {
    exportIctReport.mockResolvedValue({ data: new Blob(['assetTag,name']) });
    const createObjectUrl = jest.fn(() => 'blob:report');
    const revokeObjectUrl = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });

    render(<ICTReports />);
    await screen.findByText('Laptop 17');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search report' }), { target: { value: 'laptop' } });
    await waitFor(() => expect(getIctReports).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'laptop' }),
      expect.any(Object),
    ));
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));

    await waitFor(() => expect(exportIctReport).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'inventory', search: 'laptop' }),
    ));
    expect(createObjectUrl).toHaveBeenCalled();
  });
});
