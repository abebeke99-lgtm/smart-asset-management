import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ICTInventory from './ICTInventory';

const inventoryResponse = {
  success: true,
  data: [{
    id: 4,
    name: 'Laptop workstation',
    assetCode: 'ICT-004',
    serialNumber: 'SN-004',
    category: 'Computer Equipment',
    status: 'available',
    condition: 'Good',
    campus: 'Main Campus',
    college: 'Science College',
    departmentName: 'ICT Services',
    location: 'Room 12',
  }],
  summary: {
    totalItems: 11,
    available: 4,
    assigned: 2,
    damaged: 1,
    missing: 1,
    underMaintenance: 1,
    replaced: 1,
    expired: 1,
  },
  pagination: { page: 1, total: 1, totalPages: 1 },
  options: {
    categories: [{ id: 1, name: 'Computer Equipment' }],
    statuses: ['available', 'assigned'],
    conditions: ['Good'],
    campuses: [{ id: 2, campusName: 'Main Campus' }],
    colleges: [{ id: 5, collegeName: 'Science College' }],
    departments: [{ id: 8, name: 'ICT Services' }],
    locations: ['Room 12'],
  },
};

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('ICTInventory', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(inventoryResponse));
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('loads central inventory, summary, filters, and asset details', async () => {
    render(<ICTInventory />);

    expect(await screen.findByText('Laptop workstation')).toBeInTheDocument();
    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('Under Maintenance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download import template' })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/ict/inventory?'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
      target: { name: 'status', value: 'assigned' },
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('status=assigned'),
      expect.any(Object),
    ));

    fireEvent.click(screen.getByRole('button', { name: 'View Laptop workstation' }));
    expect(await screen.findByRole('dialog', { name: /Laptop workstation/ })).toBeInTheDocument();
    expect(screen.getAllByText('SN-004')).toHaveLength(2);
  });

  test('validates an Excel/CSV upload with the API before enabling import', async () => {
    const previewResponse = {
      success: true,
      summary: { total: 1, imported: 0, rejected: 0, duplicates: 0, errors: 0, valid: 1 },
      results: [{
        row: 2,
        valid: true,
        duplicate: false,
        errors: [],
        record: { name: 'New Laptop', serialNumber: 'SN-100', category: 'Computer Equipment', status: 'available' },
      }],
    };
    global.fetch
      .mockResolvedValueOnce(jsonResponse(inventoryResponse))
      .mockResolvedValueOnce(jsonResponse(previewResponse));

    render(<ICTInventory />);
    await screen.findByText('Laptop workstation');
    const file = new File(['spreadsheet'], 'inventory.xlsx');
    fireEvent.change(screen.getByLabelText('Import Excel or CSV inventory'), {
      target: { files: [file] },
    });

    expect(await screen.findByRole('dialog', { name: 'Review spreadsheet import' })).toBeInTheDocument();
    expect(screen.getByText('New Laptop')).toBeInTheDocument();
    expect(screen.getByText('Total Rows')).toBeInTheDocument();
    expect(screen.getByText('Validation Errors')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 1 valid records' })).toBeEnabled();
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/ict/inventory/import',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    expect(global.fetch.mock.calls[1][1].body.get('file')).toBe(file);
    expect(global.fetch.mock.calls[1][1].headers['Content-Type']).toBeUndefined();
  });

  test('commits the previewed file and displays import totals', async () => {
    const preview = {
      success: true,
      summary: { total: 2, imported: 0, rejected: 1, duplicates: 1, errors: 1, valid: 1 },
      results: [{
        row: 2,
        valid: true,
        duplicate: false,
        errors: [],
        record: { name: 'New Laptop', serialNumber: 'SN-100', category: 'Computer Equipment', status: 'available' },
      }],
    };
    const completed = {
      success: true,
      summary: { total: 2, imported: 1, rejected: 1, duplicates: 1, errors: 1, valid: 1 },
    };
    global.fetch
      .mockResolvedValueOnce(jsonResponse(inventoryResponse))
      .mockResolvedValueOnce(jsonResponse(preview))
      .mockResolvedValueOnce(jsonResponse(completed, 201))
      .mockResolvedValueOnce(jsonResponse(inventoryResponse));

    render(<ICTInventory />);
    await screen.findByText('Laptop workstation');
    fireEvent.change(screen.getByLabelText('Import Excel or CSV inventory'), {
      target: { files: [new File(['spreadsheet'], 'inventory.xlsx')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Import 1 valid records' }));

    expect(await screen.findByRole('status', { name: 'Import summary' })).toHaveTextContent('Total Rows');
    expect(screen.getByRole('status', { name: 'Import summary' })).toHaveTextContent('Imported');
    expect(screen.getByRole('status', { name: 'Import summary' })).toHaveTextContent('1');
    expect(global.fetch.mock.calls[2][1].body).toBeInstanceOf(FormData);
  });

  test('rejects unsupported file types before sending an import request', async () => {
    render(<ICTInventory />);
    await screen.findByText('Laptop workstation');
    fireEvent.change(screen.getByLabelText('Import Excel or CSV inventory'), {
      target: { files: [new File(['not a spreadsheet'], 'inventory.pdf', { type: 'application/pdf' })] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Select an Excel (.xls, .xlsx) or CSV file.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('rejects files larger than 10 MB before sending an import request', async () => {
    render(<ICTInventory />);
    await screen.findByText('Laptop workstation');
    const oversizedFile = new File([new Uint8Array((10 * 1024 * 1024) + 1)], 'inventory.xlsx');
    fireEvent.change(screen.getByLabelText('Import Excel or CSV inventory'), {
      target: { files: [oversizedFile] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('The spreadsheet must be 10 MB or smaller.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
