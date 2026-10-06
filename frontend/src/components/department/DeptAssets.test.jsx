import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
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

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en', theme: 'light' }),
}));

const departmentAssets = [
  {
    id: 12,
    assetCode: 'AST-120',
    asset_tag: 'AST-120',
    name: 'Engineering Laptop',
    category: 'Computing',
    status: 'available',
    condition: 'Good',
    location: 'Room 1',
    assigned_to_name: 'A. User',
    laboratoryName: 'Computer Lab',
    serialNumber: 'SER-120',
    digitalId: 'QR-120',
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
  </MemoryRouter>
);

describe('Department Assets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(axios.get).toHaveBeenCalledWith('/api/assets', {
      params: { page: 1, limit: 50 },
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

    expect(await screen.findByText('QR-120')).toBeInTheDocument();
    expect(screen.getAllByText('Computer Lab')).toHaveLength(2);
    expect(await screen.findByText('device-manual.pdf')).toBeInTheDocument();
    expect(await screen.findAllByText('Asset Assigned')).toHaveLength(2);
    expect(axios.get).toHaveBeenCalledWith('/api/assets/12/history');
    expect(axios.get).toHaveBeenCalledWith('/api/assets/12/documents');
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
});
