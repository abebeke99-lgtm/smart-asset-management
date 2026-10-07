import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { toast } from 'react-toastify';
import { autoTable } from 'jspdf-autotable';
import DeptReports from './DeptReports';

let mockAuthState = {
  user: { role: 'department_head', department: 'Engineering', permissions: ['reports.export'] },
  hasPermission: jest.fn(() => true),
};

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en', theme: 'light' }),
}));

jest.mock('react-toastify', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

jest.mock('jspdf', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    prototype: {
      setFontSize: jest.fn().mockReturnThis(),
      setTextColor: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      save: jest.fn(),
    },
  }),
}));

jest.mock('jspdf-autotable', () => ({
  autoTable: jest.fn(),
}));

afterEach(() => {
  jest.restoreAllMocks();
});

jest.mock('react-chartjs-2', () => ({
  Bar: () => null,
  Doughnut: ({ data }) => <div data-testid="category-chart">{data.labels.join(', ')}</div>,
  Pie: ({ data }) => <div data-testid="location-chart">{data.labels.join(', ')}</div>,
}));

const inventoryPayload = {
  data: [{
    id: 5,
    asset_tag: 'AST-005',
    name: 'Engineering Laptop',
    category_name: 'Computers',
    status: 'available',
    location: 'Engineering Lab A',
    current_value: 1250,
  }],
  assets: [{
    id: 5,
    asset_tag: 'AST-005',
    name: 'Engineering Laptop',
    category_name: 'Computers',
    status: 'available',
    location: 'Engineering Lab A',
    current_value: 1250,
  }],
  totals: {
    totalAssets: 1,
    inUse: 0,
    available: 1,
    underMaintenance: 0,
    disposed: 0,
    totalValue: 1250,
    utilizationRate: 0,
    byCategory: { Computers: 1 },
    byLocation: { 'Engineering Lab A': 1 },
  },
};

const regularReportPayload = {
  assets: [{
    id: 9,
    asset_tag: 'AST-009',
    name: 'Engineering Laptop',
    category_name: 'Computers',
    status: 'available',
    location: 'Engineering Lab A',
    assigned_to_name: 'Alice Johnson',
    current_value: 1250,
  }],
  maintenance: [{
    request_number: 'MR-101',
    title: 'AC maintenance',
    asset_name: 'AC-1',
    status: 'Pending',
    priority: 'High',
    type: 'Preventive',
    reported_by_name: 'Alice Johnson',
    created_at: '2024-01-01',
    actual_cost: 180,
  }],
  staff: [{
    fullName: 'Alice Johnson',
    role: 'Engineer',
    email: 'alice@example.com',
    assigned_assets: 1,
    active: true,
  }],
  approvals: [{
    request_id: 'AR-42',
    type: 'Asset',
    requested_by: 'Alice Johnson',
    status: 'Approved',
    created_at: '2024-01-01',
    approved_at: '2024-01-02',
    approved_by: 'Department Head',
    approval_comment: 'Approved',
  }],
};

describe('DeptReports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      user: { role: 'department_head', department: 'Engineering', permissions: ['reports.export'] },
      hasPermission: jest.fn(() => true),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads a regular department report and shows export actions for authorized users', async () => {
    apiClient.get.mockImplementation((url, options = {}) => {
      const { reportType } = options.params || {};
      if (reportType === 'assets') {
        return Promise.resolve({ data: { assets: regularReportPayload.assets, totals: { totalAssets: 1 } } });
      }
      if (reportType === 'maintenance') {
        return Promise.resolve({ data: { data: regularReportPayload.maintenance } });
      }
      if (reportType === 'staff') {
        return Promise.resolve({ data: { data: regularReportPayload.staff } });
      }
      if (reportType === 'approvals') {
        return Promise.resolve({ data: { data: regularReportPayload.approvals } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    render(
      <MemoryRouter>
        <DeptReports />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Department Reports' })).toBeInTheDocument();
    expect(await screen.findByText('Engineering Laptop')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /export to excel/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /export to pdf/i })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(4);
  });

  it('hides export buttons when reports.export is not granted', async () => {
    mockAuthState = {
      user: { role: 'department_head', department: 'Engineering', permissions: [] },
      hasPermission: jest.fn(() => false),
    };

    apiClient.get.mockImplementation((url, options = {}) => {
      const { reportType } = options.params || {};
      if (reportType === 'assets') {
        return Promise.resolve({ data: { assets: regularReportPayload.assets, totals: { totalAssets: 1 } } });
      }
      if (reportType === 'maintenance') {
        return Promise.resolve({ data: { data: regularReportPayload.maintenance } });
      }
      if (reportType === 'staff') {
        return Promise.resolve({ data: { data: regularReportPayload.staff } });
      }
      if (reportType === 'approvals') {
        return Promise.resolve({ data: { data: regularReportPayload.approvals } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    render(
      <MemoryRouter>
        <DeptReports />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Department Reports' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /export to excel/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /export to pdf/i })).not.toBeInTheDocument();
    });
  });

  it('shows a load error and retry action for regular report failures', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    apiClient.get.mockRejectedValue({ response: { status: 404 } });

    render(
      <MemoryRouter>
        <DeptReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('The department reports resource was not found.');
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(errorLog).toHaveBeenCalledWith('Department reports request failed:', expect.objectContaining({
      status: 404,
      message: 'The department reports resource was not found.',
    }));
  });

  it('loads inventory summary and assets from one department reports request', async () => {
    apiClient.get.mockResolvedValue({ data: inventoryPayload });

    render(
      <MemoryRouter>
        <React.StrictMode>
          <DeptReports inventoryMode />
        </React.StrictMode>
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
    expect(await screen.findByRole('heading', { name: 'Department Inventory' })).toBeInTheDocument();
    expect(await screen.findByText('Engineering Laptop')).toBeInTheDocument();
    expect(screen.getByTestId('category-chart')).toHaveTextContent('Computers');
    expect(screen.getByTestId('location-chart')).toHaveTextContent('Engineering Lab A');
    expect(screen.getByText('Total Assets').parentElement).toHaveTextContent('1');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/department/reports', {
      params: expect.objectContaining({ limit: 100, reportType: 'assets' }),
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows a successful empty state without treating it as an error', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: [],
        assets: [],
        totals: {
          totalAssets: 0,
          inUse: 0,
          available: 0,
          underMaintenance: 0,
          disposed: 0,
          totalValue: 0,
          utilizationRate: 0,
          byCategory: {},
          byLocation: {},
        },
      },
    });

    render(
      <MemoryRouter>
        <DeptReports inventoryMode />
      </MemoryRouter>
    );

    expect(await screen.findByText('No assets found for this department.')).toBeInTheDocument();
    expect(screen.getByText('No category data available for this department.')).toBeInTheDocument();
    expect(screen.getByText('No location data available for this department.')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('exports a PDF using the supported AutoTable function API', async () => {
    apiClient.get.mockResolvedValue({ data: inventoryPayload });

    render(
      <MemoryRouter>
        <DeptReports inventoryMode />
      </MemoryRouter>
    );

    await screen.findByText('Engineering Laptop');
    fireEvent.click(screen.getByRole('button', { name: /export to pdf/i }));

    expect(autoTable).toHaveBeenCalledTimes(1);
    const pdfDocument = autoTable.mock.calls[0][0];
    expect(autoTable).toHaveBeenCalledWith(pdfDocument, expect.objectContaining({
      body: expect.arrayContaining([expect.arrayContaining(['AST-005', 'Engineering Laptop'])]),
    }));
    expect(pdfDocument.save).toHaveBeenCalledWith(expect.stringContaining('_assets.pdf'));
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('shows a permission error and retry instead of an empty inventory when forbidden', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    apiClient.get.mockRejectedValue({ response: { status: 403 } });

    render(
      <MemoryRouter>
        <DeptReports inventoryMode />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('You do not have permission to view this department data.');
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('No assets found for this department.')).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith('Department reports request failed:', expect.objectContaining({ status: 403 }));
  });
});