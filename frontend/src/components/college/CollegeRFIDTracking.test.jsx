import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Html5Qrcode } from 'html5-qrcode';
import { UiProvider } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import CollegeRFIDTracking from './CollegeRFIDTracking';

const mockStartScanner = jest.fn();
const mockStopScanner = jest.fn();
const mockClearScanner = jest.fn();

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('html5-qrcode', () => ({
  Html5Qrcode: jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const dashboard = {
  data: [{
    id: 8,
    name: 'Microscope',
    assetCode: 'AST-008',
    qrCode: 'QR-008',
    rfidTag: 'RFID-008',
    department: 'Physics',
    location: 'Lab 4',
    status: 'available',
    condition: 'Good',
  }],
  logs: [{
    id: 21,
    tag: 'QR-008',
    action: 'qr_scan',
    location: 'Lab 4',
    createdAt: '2026-10-10T10:00:00.000Z',
    scannedBy: { id: 4, name: 'College Staff' },
    asset: { id: 8, name: 'Microscope', assetCode: 'AST-008' },
  }],
  summary: { totalAssets: 12, taggedAssets: 9, untaggedAssets: 3, uniqueLocations: 4, recentScans: 7 },
  filters: { departments: [{ id: 2, name: 'Physics' }], statuses: ['available'], locations: ['Lab 4'] },
  pagination: { page: 1, limit: 25, total: 12, totalPages: 1 },
};

const renderPage = () => render(<UiProvider><CollegeRFIDTracking /></UiProvider>);

const createScanner = (startResult = Promise.resolve()) => {
  const scanner = {
    start: (...args) => {
      mockStartScanner(...args);
      return typeof startResult === 'function' ? startResult() : startResult;
    },
    stop: () => Promise.resolve(mockStopScanner()),
    clear: () => mockClearScanner(),
  };
  Html5Qrcode.mockImplementation(() => scanner);
  return scanner;
};

beforeEach(() => {
  localStorage.setItem('language', 'en');
  apiClient.get.mockReset();
  apiClient.post.mockReset();
  Html5Qrcode.mockReset();
  apiClient.get.mockResolvedValue({ data: dashboard });
  apiClient.post.mockResolvedValue({ data: { success: true, data: { asset: dashboard.data[0] } } });
  mockStartScanner.mockReset();
  mockStopScanner.mockReset();
  mockClearScanner.mockReset();
  useAuth.mockReturnValue({
    user: { id: 4, role: 'college_manager' },
    hasPermission: (permission) => permission === 'college.assets.update',
  });
});

test('loads real tracking summary, asset identifiers, locations, and recent scan actor', async () => {
  renderPage();

  expect((await screen.findAllByText('Microscope')).length).toBeGreaterThan(0);
  expect(screen.getByText('12')).toBeInTheDocument();
  expect(screen.getByLabelText('RFID Tag AST-008')).toHaveValue('RFID-008');
  expect(screen.getAllByText('QR-008').length).toBeGreaterThan(0);
  expect(screen.getByText('College Staff')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/college/rfid', expect.objectContaining({
    params: expect.objectContaining({ page: 1, limit: 25 }),
  }));
});

test('filters are sent to the configured API path and retryable API errors remain distinct from empty results', async () => {
  apiClient.get
    .mockRejectedValueOnce({ response: { status: 500, data: { message: 'Internal server error' } } })
    .mockResolvedValueOnce({ data: { ...dashboard, data: [], logs: [] } });
  renderPage();

  expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No matching assets found.')).toBeInTheDocument();
  expect(screen.getByText('No recent scan activity available.')).toBeInTheDocument();
  expect(apiClient.get.mock.calls[1][0]).toBe('/api/college/rfid');
});

test('validates the lookup before recording a successful scan through the backend', async () => {
  apiClient.get.mockImplementation((path) => {
    if (path === '/api/college/rfid') return Promise.resolve({ data: dashboard });
    return Promise.resolve({ data: { success: true, data: dashboard.data[0] } });
  });
  renderPage();

  const field = await screen.findByLabelText('Tracking identifier');
  fireEvent.change(field, { target: { value: 'QR-008' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lookup' }));
  expect(await screen.findByText('Asset found.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Record scan' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/college/rfid/scan', {
    method: 'manual',
    value: 'QR-008',
  }));
});

test('camera QR scanning records the decoded identifier and releases the camera', async () => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  createScanner();
  renderPage();

  fireEvent.change(await screen.findByLabelText('Scan method'), { target: { value: 'qr' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start QR camera' }));
  await waitFor(() => expect(mockStartScanner).toHaveBeenCalled());

  const decodedQrHandler = mockStartScanner.mock.calls[0][2];
  act(() => decodedQrHandler('QR-008'));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/college/rfid/scan', {
    method: 'qr',
    value: 'QR-008',
  }));
  expect(mockStopScanner).toHaveBeenCalled();
  expect(mockClearScanner).toHaveBeenCalled();
  expect(await screen.findByText('Scan recorded.')).toBeInTheDocument();
});

test('camera QR scan rejects invalid decoded values without calling the API', async () => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  createScanner();
  renderPage();

  fireEvent.change(await screen.findByLabelText('Scan method'), { target: { value: 'qr' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start QR camera' }));
  await waitFor(() => expect(mockStartScanner).toHaveBeenCalled());
  act(() => mockStartScanner.mock.calls[0][2]('Q'.repeat(256)));

  expect(await screen.findByRole('alert')).toHaveTextContent('A valid tracking identifier of 1 to 255 characters is required.');
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('camera scan API failures remain visible and still release camera resources', async () => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  createScanner();
  apiClient.post.mockRejectedValueOnce({ response: { data: { message: 'Scan write failed.' } } });
  renderPage();

  fireEvent.change(await screen.findByLabelText('Scan method'), { target: { value: 'qr' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start QR camera' }));
  await waitFor(() => expect(mockStartScanner).toHaveBeenCalled());
  act(() => mockStartScanner.mock.calls[0][2]('QR-008'));

  expect(await screen.findByRole('alert')).toHaveTextContent('Scan write failed.');
  expect(apiClient.post).toHaveBeenCalledWith('/api/college/rfid/scan', { method: 'qr', value: 'QR-008' });
  expect(mockStopScanner).toHaveBeenCalled();
  expect(mockClearScanner).toHaveBeenCalled();
});

test('camera stops when the scan method changes away from QR', async () => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  createScanner();
  renderPage();

  const methodSelect = await screen.findByLabelText('Scan method');
  fireEvent.change(methodSelect, { target: { value: 'qr' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start QR camera' }));
  await waitFor(() => expect(mockStartScanner).toHaveBeenCalled());

  fireEvent.change(methodSelect, { target: { value: 'manual' } });
  await waitFor(() => expect(mockStopScanner).toHaveBeenCalled());
  expect(mockClearScanner).toHaveBeenCalled();
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('camera stops when the tracking component unmounts', async () => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  createScanner();
  const view = renderPage();

  fireEvent.change(await screen.findByLabelText('Scan method'), { target: { value: 'qr' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start QR camera' }));
  await waitFor(() => expect(mockStartScanner).toHaveBeenCalled());

  view.unmount();
  await waitFor(() => expect(mockStopScanner).toHaveBeenCalled());
  expect(mockClearScanner).toHaveBeenCalled();
});

test('camera permission failures show a useful message and clear the scanner', async () => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  createScanner(() => Promise.reject(new Error('permission denied')));
  renderPage();

  fireEvent.change(await screen.findByLabelText('Scan method'), { target: { value: 'qr' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start QR camera' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not access the camera. Check browser permission and try again.');
  expect(mockClearScanner).toHaveBeenCalled();
  expect(mockStopScanner).not.toHaveBeenCalled();
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('College Manager can update RFID tags and request a unique QR code', async () => {
  renderPage();

  const rfidInput = await screen.findByLabelText('RFID Tag AST-008');
  fireEvent.change(rfidInput, { target: { value: 'RFID-UPDATED' } });
  const saveButton = screen.getByRole('button', { name: 'Save RFID tag' });
  fireEvent.click(saveButton);
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/college/rfid/assets/8/tags', { rfidTag: 'RFID-UPDATED' }));
  await screen.findByText('Tracking tag updated.');
  await waitFor(() => expect(saveButton).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Generate QR' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenLastCalledWith('/api/college/rfid/assets/8/qr/regenerate', {}));
});

test('Amharic mode translates the tracking dashboard and regular College accounts do not see tag management', async () => {
  localStorage.setItem('language', 'am');
  useAuth.mockReturnValue({
    user: { id: 9, role: 'college' },
    hasPermission: () => false,
  });
  renderPage();

  expect(await screen.findByText('የሚከታተሉ ንብረቶች')).toBeInTheDocument();
  expect((await screen.findAllByText('Microscope')).length).toBeGreaterThan(0);
  expect(screen.getByText('የቅርብ ጊዜ ቅኝቶች')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'የRFID መለያ አስቀምጥ' })).not.toBeInTheDocument();
  expect(screen.getByText('RFID-008')).toBeInTheDocument();
});
