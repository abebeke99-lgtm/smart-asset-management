import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import DepartmentHeadAssets from './DepartmentHeadAssets';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'department_head', department: 'Engineering', departmentId: 7 } }),
}));

let mockActiveLanguage = 'en';
jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: mockActiveLanguage, theme: 'light' }),
}));

const assets = [{
  id: 12,
  assetCode: 'ENG-001',
  digitalId: 'DID-001',
  name: 'Department Laptop',
  category: 'Computers',
  serialNumber: 'SER-001',
  quantity: 2,
  status: 'Available',
  condition: 'Good',
  location: 'Engineering Lab',
  assignedUser: { id: 44, fullName: 'A. Engineer' },
  purchaseDate: '2024-01-10',
  warrantyExpiry: '2027-01-10',
  qrCode: 'QR-001',
  rfidTag: 'RFID-001',
  maintenanceStatus: 'None',
}];

const renderPage = () => render(<MemoryRouter><DepartmentHeadAssets /></MemoryRouter>);

describe('Department Head assets page', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveLanguage = 'en';
    axios.get.mockImplementation((url) => {
      if (url === '/api/department-head/assets') {
        return Promise.resolve({ data: { assets, pagination: { total: 1, pages: 1 } } });
      }
      if (url === '/api/department-head/assets/12') return Promise.resolve({ data: { asset: assets[0] } });
      if (url === '/api/department-head/staff') {
        return Promise.resolve({ data: { staff: [{ id: 44, fullName: 'A. Engineer' }] } });
      }
      if (url === '/api/department-head/assets/export') {
        return Promise.resolve({ data: new Blob(['data']), headers: { 'content-disposition': 'attachment; filename="assets_eng_2026-10-07.csv"' } });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    axios.post.mockResolvedValue({ data: { success: true } });
    axios.put.mockResolvedValue({ data: { asset: assets[0] } });
  });

  it('loads server-paginated assets and submits server-side search and filters', async () => {
    renderPage();
    expect(await screen.findByText('Department Laptop')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Asset ID/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Maintenance Status/ })).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith('/api/department-head/assets', { params: expect.objectContaining({ page: 1, limit: 25 }) });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search name, serial number, or Digital ID' }), { target: { value: 'SER-001' } });
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/department-head/assets', {
      params: expect.objectContaining({ search: 'SER-001', page: 1 }),
    }));

    fireEvent.change(screen.getByRole('combobox', { name: 'All Warranty' }), { target: { value: 'valid' } });
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/department-head/assets', {
      params: expect.objectContaining({ warranty: 'valid' }),
    }));

    fireEvent.change(screen.getByRole('combobox', { name: 'All Assigned Users' }), { target: { value: '44' } });
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/department-head/assets', {
      params: expect.objectContaining({ assignedUser: '44' }),
    }));
  });

  it('accepts asset rows returned directly as an array', async () => {
    axios.get.mockResolvedValueOnce({ data: assets });
    renderPage();
    expect(await screen.findByText('Department Laptop')).toBeInTheDocument();
    expect(screen.queryByText('Unable to load department assets.')).not.toBeInTheDocument();
  });

  it('opens asset details with scoped staff options and submits only editable values', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Department Laptop'));
    expect(await screen.findAllByText('RFID-001')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Asset History' })).toHaveAttribute('href', '/department-head/history?asset=12');
    expect(screen.getByRole('link', { name: 'Tracking' })).toHaveAttribute('href', '/department-head/tracking?asset=12');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Department-Editable Fields' }));
    await screen.findAllByRole('option', { name: 'A. Engineer' });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Room 4' } });
    fireEvent.change(screen.getByLabelText('Update Note'), { target: { value: 'Moved to new office' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith('/api/department-head/assets/12', {
      location: 'Room 4',
      condition: 'Good',
      assignedUserId: 44,
      note: 'Moved to new office',
    }));
  });

  it('validates registration requests before submitting them', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Request Asset Registration' }));
    fireEvent.change(screen.getByLabelText('Asset Name'), { target: { value: 'Projector' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Presentation' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'Good' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Lecture Hall' } });
    fireEvent.change(screen.getByLabelText('Justification'), { target: { value: 'Needed for teaching' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Quantity must be greater than zero.');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('submits a valid registration request to the approval workflow', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Request Asset Registration' }));
    fireEvent.change(screen.getByLabelText('Asset Name'), { target: { value: 'Projector' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Presentation' } });
    fireEvent.change(screen.getByLabelText('Serial Number'), { target: { value: 'PROJ-005' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'Good' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Lecture Hall' } });
    fireEvent.change(screen.getByLabelText('Justification'), { target: { value: 'Needed for teaching' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/api/department-head/assets/registration-requests', expect.objectContaining({
      name: 'Projector',
      quantity: 2,
      serialNumber: 'PROJ-005',
      justification: 'Needed for teaching',
    })));
  });

  it('exports using the selected format and the active filters', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = jest.fn(() => 'blob:asset-export');
    URL.revokeObjectURL = jest.fn();
    HTMLAnchorElement.prototype.click = jest.fn();
    try {
      renderPage();
      await screen.findByText('Department Laptop');
      fireEvent.click(screen.getByRole('button', { name: 'Export' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'CSV' }));
      await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/department-head/assets/export', {
        params: expect.objectContaining({ format: 'csv' }),
        responseType: 'blob',
      }));
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      HTMLAnchorElement.prototype.click = originalAnchorClick;
    }
  });

  it('renders the scoped empty and recoverable error states', async () => {
    axios.get.mockResolvedValueOnce({ data: { assets: [], pagination: { total: 0, pages: 1 } } });
    const emptyView = renderPage();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No assets found for your department.'));
    emptyView.unmount();

    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockRejectedValueOnce(new Error('Unavailable'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load department assets.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(errorLog).toHaveBeenCalledWith('Department Head assets load failed:', expect.any(Error));
  });

  it('renders bilingual Department Head labels in Amharic', async () => {
    mockActiveLanguage = 'am';
    renderPage();
    expect(await screen.findByRole('heading', { name: 'የክፍል ንብረቶች' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'የንብረት ምዝገባ ጥያቄ' })).toBeInTheDocument();
  });
});
