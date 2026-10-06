import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { useLanguage } from '../../contexts/UiContext';
import DeptLaboratories from './DeptLaboratories';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  ...jest.requireActual('../../services/apiClient'),
  default: { get: jest.fn() },
}));
jest.mock('../../contexts/UiContext', () => ({ useLanguage: jest.fn() }));

const laboratory = {
  id: 11,
  name: 'Physics Laboratory',
  building: 'Science Hall',
  room: 'Physics Laboratory',
  roomCode: 'PHY-LAB',
  capacity: 24,
  responsibleStaff: 'Aster Lecturer',
  department: 'Physics',
  assetCount: 4,
  condition: 'Good',
  status: 'Active',
};
const listResponse = (data = [laboratory]) => ({
  data: {
    success: true,
    department: { id: 3, name: 'Physics' },
    summary: { total: data.length, active: data.length, inactive: 0, assets: data.reduce((total, row) => total + row.assetCount, 0) },
    data,
  },
});
const dashboardResponse = {
  data: {
    success: true,
    laboratory,
    summary: { totalAssets: 4, functionalAssets: 2, damagedAssets: 1, assetsUnderMaintenance: 1, openServiceRequests: 3 },
    inventory: [{ id: 20, name: 'Microscope', assetCode: 'AST-20', category: 'Lab equipment', condition: 'Good', status: 'available' }],
    recentMaintenance: [{ id: 30, title: 'Calibration', status: 'completed', asset: { name: 'Microscope' }, createdAt: '2026-09-02T00:00:00.000Z' }],
    recentTransfers: [{ id: 40, transferNumber: 'TR-40', status: 'Completed', direction: 'incoming', asset: { name: 'Microscope' }, transferDate: '2026-09-01T00:00:00.000Z' }],
  },
};

const renderPage = (path = '/department-head/laboratories') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/department-head/laboratories" element={<DeptLaboratories />} />
      <Route path="/department-head/laboratories/:id" element={<DeptLaboratories />} />
    </Routes>
  </MemoryRouter>,
);

describe('Department Head laboratories', () => {
  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
    apiClient.get.mockReset();
    apiClient.get.mockResolvedValue(listResponse());
    useLanguage.mockReturnValue({ language: 'en' });
  });

  it('lists scoped laboratories with fields, summary, supported status filter, and detail navigation', async () => {
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading laboratories');
    expect(await screen.findByRole('heading', { name: 'Laboratories' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Physics Laboratory' })).toBeInTheDocument();
    expect(screen.getByText('Aster Lecturer')).toBeInTheDocument();
    expect(screen.getByText('Science Hall')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('4 assets')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/laboratories');

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), { target: { value: 'Restricted' } });
    expect(screen.getByText('No laboratories match your search and status filter.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), { target: { value: 'all' } });
    apiClient.get.mockResolvedValueOnce(dashboardResponse);
    fireEvent.click(screen.getByRole('button', { name: /View dashboard/ }));
    expect(await screen.findByText('Open service requests')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenLastCalledWith('/department-head/laboratories/11');
  });

  it('shows the laboratory dashboard and its real inventory and recent activity', async () => {
    apiClient.get.mockResolvedValue(dashboardResponse);
    renderPage('/department-head/laboratories/11');

    expect(await screen.findByRole('heading', { level: 2, name: 'Physics Laboratory' })).toBeInTheDocument();
    expect(screen.getByText('Functional assets')).toBeInTheDocument();
    expect(screen.getByText('Damaged assets')).toBeInTheDocument();
    expect(screen.getByText('Assets under maintenance')).toBeInTheDocument();
    expect(screen.getByText('Open service requests')).toBeInTheDocument();
    expect(screen.getByText('Microscope · completed')).toBeInTheDocument();
    expect(screen.getByText('Calibration')).toBeInTheDocument();
    expect(screen.getByText(/Incoming · Completed/)).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/laboratories/11');
  });

  it('supports empty data, API errors, retry, refresh, and Amharic translations', async () => {
    apiClient.get.mockImplementation(() => { throw new Error('Laboratory service unavailable'); });
    const rendered = renderPage();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load laboratories.');
    apiClient.get.mockImplementation(() => Promise.resolve(listResponse([])));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No laboratories are recorded for this department.')).toBeInTheDocument();
    apiClient.get.mockImplementation(() => Promise.resolve(listResponse()));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Physics Laboratory' })).toBeInTheDocument();

    rendered.unmount();
    useLanguage.mockReturnValue({ language: 'am' });
    apiClient.get.mockImplementation(() => Promise.resolve(listResponse([])));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'ላቦራቶሪዎች' })).toBeInTheDocument();
    expect(await screen.findByText('ለዚህ ዲፓርትመንት ምንም ላቦራቶሪ አልተመዘገበም።')).toBeInTheDocument();
  });

  it('refreshes the selected laboratory dashboard', async () => {
    apiClient.get.mockResolvedValue(dashboardResponse);
    renderPage('/department-head/laboratories/11');
    await screen.findByRole('heading', { level: 2, name: 'Physics Laboratory' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
    expect(apiClient.get).toHaveBeenLastCalledWith('/department-head/laboratories/11');
  });
});
