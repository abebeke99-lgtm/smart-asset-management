import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import ICTReports from './ICTReports';
import { useLanguage } from '../../contexts/UiContext';
import { getIctReports } from '../../services/ictReportsService';

jest.mock('../../contexts/UiContext', () => ({ useLanguage: jest.fn() }));
jest.mock('../../services/ictReportsService', () => ({
  getIctReports: jest.fn(),
  exportIctReport: jest.fn(),
}));

const reportResponse = (reportType = 'inventory', rows) => {
  const data = rows ?? (reportType === 'software-licenses'
    ? [{ id: 9, softwareName: 'Office Suite', vendor: 'Example vendor', version: '2026', licenseType: 'Per Device', status: 'Active', expiryDate: '2027-01-01', quantity: 4, usedQuantity: 2, assignedDevices: 'ICT-009', assignedUsers: 'Test User' }]
    : [{ id: 1, assetTag: 'ICT-001', name: 'Laptop 1', category: 'computer', serialNumber: 'SER-001', status: 'available', condition: 'Good', department: 'ICT', location: 'Main building', assignedTo: '—' }]);
  return { data: {
    reportType,
    data,
    summary: { totalAssets: data.length, totalLicenses: data.length, active: data.length, expiringSoon: 0, expired: 0 },
    filters: { categories: ['computer'], statuses: ['available', 'Active'], conditions: ['Good'], locations: ['Main building'], priorities: ['high'], departments: [{ id: 1, name: 'ICT' }] },
    pagination: { page: 1, limit: 25, total: data.length, totalPages: data.length ? 1 : 0 },
    generatedAt: '2026-09-27T12:00:00.000Z',
    scope: { collegeName: 'Test College' },
  } };
};

const renderReports = () => render(<MemoryRouter><ICTReports /></MemoryRouter>);

describe('ICTReports', () => {
  beforeEach(() => {
    useLanguage.mockReturnValue({ language: 'en' });
    getIctReports.mockImplementation(({ type }) => Promise.resolve(reportResponse(type)));
  });

  afterEach(() => jest.clearAllMocks());

  it('loads report rows through the ICT reports API', async () => {
    renderReports();

    expect(await screen.findByText('Laptop 1')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Asset Inventory Report' })).toHaveTextContent('Test College');
    expect(getIctReports).toHaveBeenCalledWith(expect.objectContaining({ type: 'inventory', page: 1 }));
  });

  it('requests the selected software-license report and renders assignment and expiration columns', async () => {
    renderReports();
    await screen.findByText('Laptop 1');

    fireEvent.change(screen.getByLabelText('Report Type'), { target: { value: 'software-licenses' } });

    expect(await screen.findByText('Office Suite')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Expiration' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Assigned Devices' })).toBeInTheDocument();
    expect(getIctReports).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'software-licenses' }));
  });

  it('shows loading and empty states from the API response', async () => {
    getIctReports.mockReturnValueOnce(new Promise(() => {}));
    renderReports();
    expect(screen.getByRole('status')).toHaveTextContent('Generating report...');

    getIctReports.mockReset();
    getIctReports.mockResolvedValue(reportResponse('inventory', []));
    renderReports();
    expect(await screen.findByText('No data found')).toBeInTheDocument();
    expect(screen.getByText('No records match the selected filters.')).toBeInTheDocument();
  });

  it('shows an API error and retries successfully', async () => {
    getIctReports.mockReset();
    getIctReports
      .mockRejectedValueOnce({ response: { data: { message: 'Report database query failed.' } } })
      .mockResolvedValueOnce(reportResponse());
    renderReports();

    expect(await screen.findByText('Report database query failed.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Laptop 1')).toBeInTheDocument();
    expect(getIctReports).toHaveBeenCalledTimes(2);
  });

  it('renders report controls in Amharic when selected', async () => {
    useLanguage.mockReturnValue({ language: 'am' });
    renderReports();

    expect(await screen.findByRole('heading', { name: 'የአይሲቲ ሪፖርቶች' })).toBeInTheDocument();
    expect(screen.getByText('የሪፖርት መቆጣጠሪያዎች')).toBeInTheDocument();
  });
});