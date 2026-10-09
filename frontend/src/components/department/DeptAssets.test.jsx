import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, useLocation } from 'react-router-dom';
import axios from 'axios';
import DeptAssets from './DeptAssets';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      role: 'department_head',
      department: 'Engineering',
      departmentId: 7,
      permissions: ['assets.view'],
    },
  }),
}));

let mockLanguage = 'en';

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: mockLanguage, theme: 'light' }),
  useTranslation: () => ({ language: mockLanguage, t: (key, fallback) => fallback }),
}));

const departmentAssets = [
  {
    id: 12,
    assetCode: 'AST-120',
    asset_tag: 'AST-120',
    name: 'Engineering Laptop',
    category: 'Computing',
    quantity: 2,
    unit: 'units',
    status: 'available',
    condition: 'Good',
    location: 'Room 1',
    assetType: 'Non-Fixed Asset',
    assigned_to_name: 'A. User',
    laboratoryName: 'Computer Lab',
    serialNumber: 'SER-120',
    digitalId: 'DIG-120',
    qrCode: 'QR-120',
    rfidTag: 'RFID-120',
    purchaseDate: '2024-03-01T00:00:00.000Z',
    warrantyExpiry: '2027-03-01T00:00:00.000Z',
    purchasePrice: 1000,
  },
  {
    id: 13,
    assetCode: 'AST-130',
    asset_tag: 'AST-130',
    name: 'Lab Microscope',
    category: 'Laboratory Equipment',
    status: 'damaged',
    condition: 'Damaged',
    location: 'Room 2',
    assigned_to_name: null,
    laboratoryName: 'Biology Lab',
  },
];

const renderAssets = () => render(
  <MemoryRouter initialEntries={['/department-head/assets']}>
    <DeptAssets />
    <CurrentPath />
  </MemoryRouter>
);

const assetsPage = () => (
  <MemoryRouter initialEntries={['/department-head/assets']}>
    <DeptAssets />
    <CurrentPath />
  </MemoryRouter>
);

const CurrentPath = () => {
  const location = useLocation();
  return <output aria-label="Current path">{location.pathname}</output>;
};

describe('Department Assets', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    axios.get.mockImplementation((url) => {
      if (url === '/api/assets') {
        return Promise.resolve({ data: { assets: departmentAssets, pagination: { pages: 1 } } });
      }
      if (url === '/api/assets/12' || url === '/api/assets/13') {
        const asset = departmentAssets.find((item) => url.endsWith(`/${item.id}`));
        return Promise.resolve({ data: { asset } });
      }
      if (url.endsWith('/history')) {
        return Promise.resolve({ data: { history: [{ type: 'assigned', action: 'Asset Assigned', date: '2025-01-01', description: 'A. User' }] } });
      }
      if (url.endsWith('/documents')) {
        return Promise.resolve({ data: { documents: [{ id: 4, documentType: 'manual', originalName: 'device-manual.pdf' }] } });
      }
      if (url.includes('/scan/')) {
        return Promise.resolve({ data: { data: departmentAssets[0] } });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  it('loads real department assets and supports search and status filters', async () => {
    renderAssets();
    expect(await screen.findByText('Engineering Laptop')).toBeInTheDocument();
    expect(screen.getByText('Lab Microscope')).toBeInTheDocument();
    expect(screen.getAllByText('$1,000')).toHaveLength(2);
    expect(screen.getAllByText('Not recorded')).toHaveLength(2);
    expect(screen.getByText('Total Asset Value').parentElement).toHaveTextContent('$1,000');
    expect(axios.get).toHaveBeenCalledWith('/api/assets', {
      params: { page: 1, limit: 50 },
    });

    it('switches language without repeating the asset request', async () => {
      const { rerender } = renderAssets();
      expect(await screen.findByText('Engineering Laptop')).toBeInTheDocument();
      const requestCount = axios.get.mock.calls.length;

      mockLanguage = 'am';
      rerender(assetsPage());

      expect(screen.getByRole('heading', { name: 'የክፍል ንብረቶች' })).toBeInTheDocument();
      expect(axios.get).toHaveBeenCalledTimes(requestCount);
    });

    fireEvent.change(screen.getByPlaceholderText('Search by name or tag...'), { target: { value: 'AST-120' } });
    expect(screen.getByText('Engineering Laptop')).toBeInTheDocument();
    expect(screen.queryByText('Lab Microscope')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search by name or tag...'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Damaged' }));
    expect(screen.getByText('Lab Microscope')).toBeInTheDocument();
    expect(screen.queryByText('Engineering Laptop')).not.toBeInTheDocument();
  });

  it('filters department assets by laboratory and assignment', async () => {
    renderAssets();
    expect(await screen.findByText('Engineering Laptop')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Laboratory filter'), { target: { value: 'Biology Lab' } });
    expect(screen.getByText('Lab Microscope')).toBeInTheDocument();
    expect(screen.queryByText('Engineering Laptop')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Laboratory filter'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Assignment filter'), { target: { value: 'Unassigned' } });
    expect(screen.getByText('Lab Microscope')).toBeInTheDocument();
    expect(screen.queryByText('Engineering Laptop')).not.toBeInTheDocument();
  });

  it('shows scoped details, documents, and history', async () => {
    renderAssets();
    fireEvent.click(await screen.findByText('Engineering Laptop'));

    expect(screen.queryByRole('button', { name: 'Request Transfer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report Damaged' })).not.toBeInTheDocument();
    expect(await screen.findByText('QR-120')).toBeInTheDocument();
    expect(screen.getByText('Asset ID').parentElement).toHaveTextContent('AST-120');
    expect(screen.getByText('Digital ID').parentElement).toHaveTextContent('DIG-120');
    expect(screen.getByText('RFID').parentElement).toHaveTextContent('RFID-120');
    expect(screen.getByText('Quantity').parentElement).toHaveTextContent('2 units');
    expect(screen.getByText('Purchase Date').parentElement).toHaveTextContent(new Date(2024, 2, 1).toLocaleDateString());
    expect(screen.getByText('Warranty').parentElement).toHaveTextContent(new Date(2027, 2, 1).toLocaleDateString());
    expect(screen.getAllByText('Computer Lab')).toHaveLength(2);
    expect(await screen.findByText('device-manual.pdf')).toBeInTheDocument();
    expect(await screen.findAllByText('Asset Assigned')).toHaveLength(2);
    expect(axios.get).toHaveBeenCalledWith('/api/assets/12/history');
    expect(axios.get).toHaveBeenCalledWith('/api/assets/12/documents');
  });

  it('preserves leap-day purchase dates from date-only API values', async () => {
    const originalPurchaseDate = departmentAssets[0].purchaseDate;
    departmentAssets[0].purchaseDate = '2024-02-29T00:00:00.000Z';
    try {
      renderAssets();
      fireEvent.click(await screen.findByText('Engineering Laptop'));
      expect(await screen.findByText('QR-120')).toBeInTheDocument();
      expect(screen.getByText('Purchase Date').parentElement).toHaveTextContent(new Date(2024, 1, 29).toLocaleDateString());
    } finally {
      departmentAssets[0].purchaseDate = originalPurchaseDate;
    }
  });

  it('resolves QR identifiers through the scoped lookup API', async () => {
    renderAssets();
    fireEvent.change(await screen.findByLabelText('QR identifier'), { target: { value: 'QR-120' } });
    fireEvent.click(screen.getByRole('button', { name: /identify asset/i }));

    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/assets/scan/QR-120'));
    expect(await screen.findByText('device-manual.pdf')).toBeInTheDocument();
  });

  it('does not offer export without export permission', async () => {
    renderAssets();
    await screen.findByText('Engineering Laptop');
    expect(screen.queryByRole('button', { name: /export to excel/i })).not.toBeInTheDocument();
  });

  it('refreshes assets, requests an asset through the department request page, and filters by asset type', async () => {
    renderAssets();
    expect(await screen.findByText('Engineering Laptop')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Asset type filter'), { target: { value: 'Non-Fixed Asset' } });
    expect(screen.getByText('Engineering Laptop')).toBeInTheDocument();
    expect(screen.queryByText('Lab Microscope')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Engineering Laptop')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Request Asset' }));
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/department-head/requests');
  });

  it('retries a failed asset list request instead of showing a false empty state', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockRejectedValueOnce(new Error('Network unavailable'));
    renderAssets();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load assets');
    expect(errorLog).toHaveBeenCalledWith('Department assets fetch error:', expect.any(Error));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Engineering Laptop')).toBeInTheDocument();
  });

  it('submits maintenance requests using the Department Head scoped workflow', async () => {
    renderAssets();
    fireEvent.click(await screen.findByText('Engineering Laptop'));
    fireEvent.click(await screen.findByRole('button', { name: 'Request Maintenance' }));
    fireEvent.change(screen.getByPlaceholderText('Describe the maintenance required...'), {
      target: { value: 'Laptop battery is failing' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/api/department-head/maintenance-requests', {
      asset_id: 12,
      problem: 'Maintenance request',
      description: 'Laptop battery is failing',
      priority: 'medium',
    }));
  });
});
