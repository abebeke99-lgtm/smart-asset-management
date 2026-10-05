import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminRFIDTracking from './AdminRFIDTracking';
import apiClient from '../../services/apiClient';
import { UiProvider } from '../../contexts/UiContext';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'react-toastify';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  getApiErrorMessage: jest.fn((_error, fallback) => fallback),
}));
jest.mock('html5-qrcode', () => ({ Html5Qrcode: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const asset = {
  id: 17,
  assetCode: 'ASSET-17',
  name: 'Laptop',
  category: 'Computers',
  serialNumber: 'SER-17',
  status: 'available',
  condition: 'Good',
  department: 'ICT',
  purchaseDate: '2025-01-01',
  qrCode: 'QR-17',
  rfidTag: 'RFID-17',
};
const tracking = {
  asset,
  currentLocation: {
    college: 'Engineering',
    department: 'ICT',
    building: 'Science Building',
    floor: 2,
    room: 'Room 204',
    lastUpdated: '2026-01-01',
    updatedBy: 'Admin User',
  },
  currentAssignment: { assignedTo: 'Aster Bekele', department: 'ICT', assignedBy: 'Admin User', status: 'active' },
  assignmentHistory: [{ id: 1, assignedTo: 'Aster Bekele', from: 'Store', to: 'ICT', assignedAt: '2026-01-15', assignedBy: 'Admin User', status: 'active' }],
  transferHistory: [{ id: 2, fromLocation: 'Room 100', toLocation: 'Room 204', fromDepartment: 'Store', toDepartment: 'ICT', date: '2026-02-15', approvedBy: 'Manager', reason: 'Relocation', status: 'Approved' }],
  maintenanceHistory: [{ id: 3, date: '2026-03-15', type: 'corrective', ticketId: 'WO-3', technician: 'Mekdes', cost: 240, status: 'completed', outcome: 'Screen repaired' }],
};
const EMPTY_SUMMARY = { totalAssets: 0, rfidAssigned: 0, qrAssigned: 0, fullyTracked: 0, notFullyTracked: 0 };
const renderPage = () => render(<UiProvider><AdminRFIDTracking /></UiProvider>);

beforeEach(() => {
  localStorage.setItem('language', 'en');
  apiClient.get.mockReset();
  apiClient.post.mockReset().mockResolvedValue({ data: { success: true } });
  toast.error.mockReset();
  toast.success.mockReset();
  Html5Qrcode.mockReset();
  Html5Qrcode.getCameras = jest.fn().mockResolvedValue([{ id: 'rear-camera', label: 'Back Camera' }]);
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/admin/rfid/summary') return Promise.resolve({ data: { success: true, data: { totalAssets: 7, rfidAssigned: 5, qrAssigned: 6, fullyTracked: 4, notFullyTracked: 3 } } });
    if (url === '/api/admin/rfid/assets') return Promise.resolve({ data: { success: true, data: { items: [asset], pagination: { page: 1, limit: 20, total: 1, pages: 1 } } } });
    if (url === '/api/admin/rfid/assets/17/tracking') return Promise.resolve({ data: { success: true, data: tracking } });
    if (url.startsWith('/api/admin/rfid/lookup/')) return Promise.resolve({ data: { success: true, data: { asset } } });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
});

test('loads server-side summary and paginated asset rows', async () => {
  renderPage();
  expect(await screen.findByText('Laptop')).toBeInTheDocument();
  expect(screen.getByText('7')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/admin/rfid/summary', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(apiClient.get).toHaveBeenCalledWith('/api/admin/rfid/assets', expect.objectContaining({
    params: { search: '', status: '', page: 1, limit: 20 },
    signal: expect.any(AbortSignal),
  }));
});

test('keeps summary skeletons visible until the summary request resolves', async () => {
  let resolveSummary;
  apiClient.get.mockImplementation((url, config) => {
    if (url === '/api/admin/rfid/summary') {
      return new Promise((resolve) => { resolveSummary = resolve; });
    }
    return Promise.resolve({ data: { success: true, data: { items: [asset], pagination: { page: 1, limit: 20, total: 1, pages: 1 } } } });
  });
  renderPage();
  await waitFor(() => expect(document.querySelectorAll('.rfid-summary-skeleton')).toHaveLength(5));
  expect(document.querySelector('.rfid-summary-card')).toHaveAttribute('aria-busy', 'true');
  await act(async () => {
    resolveSummary({ data: { success: true, data: { totalAssets: 7, rfidAssigned: 5, qrAssigned: 6, fullyTracked: 4, notFullyTracked: 3 } } });
  });
  expect(await screen.findByText('7')).toBeInTheDocument();
  expect(document.querySelectorAll('.rfid-summary-skeleton')).toHaveLength(0);
});

test('disables empty lookup and opens tracking details after an asset ID lookup', async () => {
  renderPage();
  const searchButtons = await screen.findAllByRole('button', { name: 'Search' });
  expect(searchButtons[0]).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Enter asset ID'), { target: { value: 'ASSET-17' } });
  expect(searchButtons[0]).toBeEnabled();
  fireEvent.click(searchButtons[0]);
  const dialog = await screen.findByRole('dialog');
  expect(await within(dialog).findByText('Laptop')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/admin/rfid/lookup/asset-id/ASSET-17', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(apiClient.post).toHaveBeenCalledWith('/api/admin/rfid/scan-log', {
    asset_id: 17, method: 'manual', value: 'ASSET-17',
  }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

test('uses the keyboard-wedge Enter submit and displays a not-found error for an unknown tag', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  apiClient.get.mockImplementation((url, config) => {
    if (url === '/api/admin/rfid/summary') return Promise.resolve({ data: { success: true, data: EMPTY_SUMMARY } });
    if (url === '/api/admin/rfid/assets') return Promise.resolve({ data: { data: { items: [], pagination: { page: 1, pages: 0, total: 0 } } } });
    if (url.includes('/lookup/code/')) return Promise.reject({ response: { status: 404, data: { message: 'missing' } } });
    return Promise.resolve({ data: { data: tracking } });
  });
  renderPage();
  const input = await screen.findByLabelText('Scan or enter code');
  fireEvent.change(input, { target: { value: 'UNKNOWN-TAG' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });
  fireEvent.submit(input.closest('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Asset not found');
  expect(apiClient.get).toHaveBeenCalledWith('/api/admin/rfid/lookup/code/UNKNOWN-TAG', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(errorLog).toHaveBeenCalledWith('Admin RFID tracking lookup failed:', expect.objectContaining({
    status: 404,
    responseBody: { message: 'missing' },
  }));
  errorLog.mockRestore();
});

test('accepts lookup responses that return the asset directly at the payload top level', async () => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/admin/rfid/summary') return Promise.resolve({ data: { success: true, data: { totalAssets: 1, rfidAssigned: 1, qrAssigned: 1, fullyTracked: 1, notFullyTracked: 0 } } });
    if (url === '/api/admin/rfid/assets') return Promise.resolve({ data: { success: true, data: { items: [asset], pagination: { page: 1, limit: 20, total: 1, pages: 1 } } } });
    if (url.startsWith('/api/admin/rfid/lookup/')) return Promise.resolve({ data: { success: true, asset } });
    if (url === '/api/admin/rfid/assets/17/tracking') return Promise.resolve({ data: { success: true, data: tracking } });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });

  renderPage();
  const input = await screen.findByLabelText('Enter asset ID');
  fireEvent.change(input, { target: { value: 'ASSET-17' } });
  fireEvent.click((await screen.findAllByRole('button', { name: 'Search' }))[0]);

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(await within(screen.getByRole('dialog')).findByText('Laptop')).toBeInTheDocument();
  expect(apiClient.post).toHaveBeenCalledWith('/api/admin/rfid/scan-log', {
    asset_id: 17, method: 'manual', value: 'ASSET-17',
  }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

test('opens the camera, decodes a QR value, logs the scan, and loads its detail panel', async () => {
  const scanner = { start: jest.fn().mockResolvedValue(), stop: jest.fn().mockResolvedValue(), clear: jest.fn() };
  Html5Qrcode.mockImplementation(() => scanner);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Start Scan' }));
  await waitFor(() => expect(scanner.start).toHaveBeenCalledWith(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    expect.any(Function),
    expect.any(Function),
  ));
  const decode = scanner.start.mock.calls[0][2];
  decode('QR-17');
  decode('QR-17');
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/admin/rfid/scan-log', {
    asset_id: 17, method: 'qr', value: 'QR-17',
  }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
  expect(apiClient.get.mock.calls.filter(([url]) => url === '/api/admin/rfid/lookup/code/QR-17')).toHaveLength(1);
  expect(scanner.stop).toHaveBeenCalled();
});

test('stops scanning and displays the not-found error when the camera reads an unknown QR', async () => {
  const scanner = { start: jest.fn().mockResolvedValue(), stop: jest.fn().mockResolvedValue(), clear: jest.fn() };
  Html5Qrcode.mockImplementation(() => scanner);
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/admin/rfid/summary') return Promise.resolve({ data: { success: true, data: EMPTY_SUMMARY } });
    if (url === '/api/admin/rfid/assets') return Promise.resolve({ data: { data: { items: [], pagination: { page: 1, pages: 0, total: 0 } } } });
    if (url.includes('/lookup/code/')) return Promise.reject({ response: { status: 404, data: { message: 'missing' } } });
    return Promise.resolve({ data: { data: tracking } });
  });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Start Scan' }));
  await waitFor(() => expect(scanner.start).toHaveBeenCalled());
  scanner.start.mock.calls[0][2]('UNKNOWN-QR');
  expect(await screen.findByRole('alert')).toHaveTextContent('Asset not found');
  expect(scanner.stop).toHaveBeenCalled();
});

test('reports denied camera permission and provides an HTTPS requirement for remote insecure origins', async () => {
  const scanner = { start: jest.fn().mockRejectedValue({ name: 'NotAllowedError', message: 'Permission denied' }), clear: jest.fn() };
  Html5Qrcode.mockImplementation(() => scanner);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Start Scan' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Camera permission was denied.');
  expect(Html5Qrcode.getCameras).not.toHaveBeenCalled();
});

test('reports when the device has no camera available', async () => {
  const scanner = { start: jest.fn().mockRejectedValue(new Error('Unable to start camera')), clear: jest.fn() };
  Html5Qrcode.mockImplementation(() => scanner);
  Html5Qrcode.getCameras.mockResolvedValue([]);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Start Scan' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No camera is available on this device.');
  expect(scanner.clear).toHaveBeenCalled();
});

test('stops and clears the active scanner on unmount', async () => {
  const scanner = { start: jest.fn().mockResolvedValue(), stop: jest.fn().mockResolvedValue(), clear: jest.fn() };
  Html5Qrcode.mockImplementation(() => scanner);
  const view = renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Start Scan' }));
  await waitFor(() => expect(scanner.start).toHaveBeenCalled());
  view.unmount();
  await waitFor(() => expect(scanner.stop).toHaveBeenCalledTimes(1));
  expect(scanner.clear).toHaveBeenCalledTimes(1);
});

test('renders tracking tabs and displays assignment, transfer, maintenance and QR information', async () => {
  renderPage();
  fireEvent.click(await screen.findByText('Laptop'));
  let dialog = await screen.findByRole('dialog');
  expect(within(dialog).getAllByText('QR-17')).toHaveLength(2);
  expect(dialog.querySelector('.rfid-qr svg')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('tab', { name: 'Current Location' }));
  expect(within(dialog).getByText('Science Building')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('tab', { name: 'Assignment' }));
  expect(within(dialog).getAllByText('Aster Bekele')).toHaveLength(2);
  fireEvent.click(within(dialog).getByRole('tab', { name: 'Transfer History' }));
  expect(within(dialog).getByText('Relocation')).toBeInTheDocument();
  expect(within(dialog).getByText('Manager')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('tab', { name: 'Maintenance History' }));
  expect(within(dialog).getByText('Screen repaired')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/admin/rfid/assets/17/tracking', expect.any(Object));
});

test('assigns tags and regenerates QR from the administrator detail panel', async () => {
  renderPage();
  fireEvent.click(await screen.findByText('Laptop'));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('QR code', { selector: 'input' }), { target: { value: 'QR-NEW' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Assign / replace tag' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/admin/rfid/assets/17/tags', { qrCode: 'QR-NEW' }));
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Generate / regenerate QR' })).toBeEnabled());
  fireEvent.click(within(dialog).getByRole('button', { name: 'Generate / regenerate QR' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/admin/rfid/assets/17/qr/regenerate'));
});

test('debounces search and sends status and pagination parameters to the server', async () => {
  apiClient.get.mockImplementation((url, config) => {
    if (url === '/api/admin/rfid/summary') return Promise.resolve({ data: { data: EMPTY_SUMMARY } });
    const requestedPage = config?.params?.page || 1;
    return Promise.resolve({ data: { data: { items: [asset], pagination: { page: requestedPage, limit: 20, total: 41, pages: 3 } } } });
  });
  renderPage();
  const searchInput = await screen.findByLabelText('Search asset ID, name, serial, RFID, QR, department...');
  fireEvent.change(searchInput, { target: { value: 'Laptop' } });
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/admin/rfid/assets', expect.objectContaining({
    params: { search: 'Laptop', status: '', page: 1, limit: 20 },
  })));
  fireEvent.change(screen.getByLabelText('Asset status'), { target: { value: 'available' } });
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/admin/rfid/assets', expect.objectContaining({
    params: { search: 'Laptop', status: 'available', page: 1, limit: 20 },
  })));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/admin/rfid/assets', expect.objectContaining({
    params: { search: 'Laptop', status: 'available', page: 2, limit: 20 },
  })));
});

test('does not show zero summary counts when the summary request fails', async () => {
  const getDefaultImplementation = apiClient.get.getMockImplementation();
  const pendingSummaries = [];
  apiClient.get.mockImplementation((url, config) => {
    if (url === '/api/admin/rfid/summary') {
      return new Promise((_resolve, reject) => pendingSummaries.push({ signal: config.signal, reject }));
    }
    return getDefaultImplementation(url, config);
  });
  renderPage();
  await waitFor(() => expect(pendingSummaries.some(({ signal }) => !signal.aborted)).toBe(true));
  await act(async () => {
    pendingSummaries.filter(({ signal }) => !signal.aborted)
      .forEach(({ reject }) => reject(new Error('Database unavailable')));
  });
  expect(await screen.findByText('Unable to load tracking summary.')).toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByText('—')).toHaveLength(5));
});

test('retries a failed summary independently and keeps the asset table usable', async () => {
  const defaultGet = apiClient.get.getMockImplementation();
  let summaryCalls = 0;
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  apiClient.get.mockImplementation((url, ...args) => {
    if (url === '/api/admin/rfid/summary' && summaryCalls++ === 0) {
      return Promise.reject({ response: { status: 503, data: { message: 'Summary database unavailable' } } });
    }
    return defaultGet(url, ...args);
  });
  try {
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Summary database unavailable');
    expect(await screen.findByText('Laptop')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(5);
    expect(errorLog).toHaveBeenCalledWith('Admin RFID tracking summary request failed:', expect.objectContaining({
      status: 503,
      responseBody: { message: 'Summary database unavailable' },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(summaryCalls).toBe(2);
  } finally {
    errorLog.mockRestore();
  }
});

test('Refresh reloads the summary and the asset table', async () => {
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh' }));
  await waitFor(() => {
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/api/admin/rfid/summary')).toHaveLength(2);
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/api/admin/rfid/assets')).toHaveLength(2);
  });
});

test('uses the Amharic translation catalog', async () => {
  localStorage.setItem('language', 'am');
  renderPage();
  expect(await screen.findByRole('heading', { name: 'RFID እና QR ክትትል' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ስካን ጀምር' })).toBeInTheDocument();
});
