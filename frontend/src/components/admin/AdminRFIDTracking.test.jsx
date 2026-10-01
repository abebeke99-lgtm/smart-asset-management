import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminRFIDTracking from './AdminRFIDTracking';
import apiClient from '../../services/apiClient';
import { UiProvider } from '../../contexts/UiContext';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'react-toastify';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
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
  department: 'ICT',
  qrCode: 'QR-17',
  rfidTag: 'RFID-17',
  CampusRecord: { campusName: 'Main Campus' },
  BuildingRecord: { buildingName: 'Science Building' },
  RoomRecord: { floor: 2, roomName: 'Room 204' },
};

const renderPage = () => render(<UiProvider><AdminRFIDTracking /></UiProvider>);

beforeEach(() => {
  localStorage.setItem('language', 'en');
  apiClient.get.mockReset();
  toast.error.mockReset();
  Html5Qrcode.mockReset();
  Html5Qrcode.getCameras = jest.fn().mockResolvedValue([{ id: 'rear-camera', label: 'Back Camera' }]);
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/assets') return Promise.resolve({ data: { success: true, data: [asset], total: 1, pagination: { pages: 1 } } });
    if (url.endsWith('/assignments')) return Promise.resolve({ data: { success: true, data: [{ userName: 'Aster Bekele', department: 'ICT', assignedAt: '2026-01-15', status: 'active' }] } });
    if (url.endsWith('/transfers')) return Promise.resolve({ data: { success: true, data: [{ fromLocation: 'Room 100', toLocation: 'Room 204', transferredAt: '2026-02-15', reason: 'Relocation' }] } });
    if (url.endsWith('/maintenance')) return Promise.resolve({ data: { success: true, data: [{ requestedAt: '2026-03-15', title: 'Screen repair', status: 'completed', technicianName: 'Mekdes' }] } });
    return Promise.resolve({ data: { success: true, data: { asset } } });
  });
});

test('initializes the scanner and stops and clears it on unmount', async () => {
  const scanner = { isScanning: true, start: jest.fn().mockResolvedValue(), stop: jest.fn().mockResolvedValue(), clear: jest.fn() };
  Html5Qrcode.mockImplementation(() => scanner);
  const view = renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Start Scan' }));
  await waitFor(() => expect(scanner.start).toHaveBeenCalledWith(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    expect.any(Function),
    expect.any(Function),
  ));
  view.unmount();
  await waitFor(() => expect(scanner.stop).toHaveBeenCalledTimes(1));
  expect(scanner.clear).toHaveBeenCalledTimes(1);
});

test('looks up a decoded QR value after stopping the scanner', async () => {
  const scanner = { start: jest.fn().mockResolvedValue(), stop: jest.fn().mockResolvedValue(), clear: jest.fn() };
  Html5Qrcode.mockImplementation(() => scanner);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Start Scan' }));
  await waitFor(() => expect(scanner.start).toHaveBeenCalled());
  scanner.start.mock.calls[0][2]('QR-17');
  await waitFor(() => expect(scanner.stop).toHaveBeenCalledTimes(1));
  expect(apiClient.get).toHaveBeenCalledWith('/api/rfid/lookup/QR-17', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});

test('retries a failed facing-mode request with the preferred rear camera ID', async () => {
  const scanner = { start: jest.fn().mockRejectedValueOnce(new Error('OverconstrainedError')).mockResolvedValueOnce(), stop: jest.fn().mockResolvedValue(), clear: jest.fn() };
  Html5Qrcode.mockImplementation(() => scanner);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Start Scan' }));
  await waitFor(() => expect(scanner.start).toHaveBeenCalledTimes(2));
  expect(scanner.start.mock.calls[0][0]).toEqual({ facingMode: 'environment' });
  expect(scanner.start.mock.calls[1][0]).toBe('rear-camera');
  expect(Html5Qrcode.getCameras).toHaveBeenCalledTimes(1);
});

test('shows a permission-specific message when camera access is denied', async () => {
  const scanner = { start: jest.fn().mockRejectedValue({ name: 'NotAllowedError', message: 'Permission denied' }), clear: jest.fn() };
  Html5Qrcode.mockImplementation(() => scanner);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Start Scan' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Camera permission was denied.'));
  expect(Html5Qrcode.getCameras).not.toHaveBeenCalled();
});

test('looks up an asset by asset ID and displays its details', async () => {
  renderPage();
  fireEvent.change(await screen.findByLabelText('Enter asset ID'), { target: { value: 'ASSET-17' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Search' })[0]);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Laptop')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/assets/lookup/ASSET-17', expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

test('looks up RFID or QR values and shows a not-found error for unknown codes', async () => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/assets') return Promise.resolve({ data: { data: [asset], total: 1, pagination: { pages: 1 } } });
    return Promise.reject({ response: { status: 404, data: { message: 'missing' } } });
  });
  renderPage();
  fireEvent.change(await screen.findByLabelText('Enter or scan RFID / QR code'), { target: { value: 'UNKNOWN-TAG' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Search' })[1]);
  expect(await screen.findByRole('alert')).toHaveTextContent('Asset not found');
  expect(apiClient.get).toHaveBeenCalledWith('/api/rfid/lookup/UNKNOWN-TAG', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(toast.error).toHaveBeenCalledWith('Asset not found');
});

test('renders the campus to room hierarchy and a QR code for the selected asset', async () => {
  renderPage();
  fireEvent.click(await screen.findByText('Laptop'));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Main Campus → Science Building → 2 → Room 204')).toBeInTheDocument();
  expect(within(dialog).getAllByText('QR-17')).toHaveLength(2);
  expect(dialog.querySelector('.rfid-qr svg')).toBeInTheDocument();
});

test('lazy-loads assignment, transfer, and maintenance histories when tabs are selected', async () => {
  renderPage();
  fireEvent.click(await screen.findByText('Laptop'));
  expect(await screen.findByText('Aster Bekele')).toBeInTheDocument();
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('tab', { name: 'Transfer History' }));
  expect(await screen.findByText('Relocation')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('tab', { name: 'Maintenance History' }));
  expect(await screen.findByText('Screen repair')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/assets/17/assignments', expect.any(Object));
  expect(apiClient.get).toHaveBeenCalledWith('/api/assets/17/transfers', expect.any(Object));
  expect(apiClient.get).toHaveBeenCalledWith('/api/assets/17/maintenance', expect.any(Object));
});

test('uses the Amharic translation catalog when the language is switched to Amharic', async () => {
  localStorage.setItem('language', 'am');
  renderPage();
  expect(await screen.findByRole('heading', { name: 'RFID እና QR ክትትል' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ስካን ጀምር' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'የክትትል ማጣሪያ' })).toBeInTheDocument();
});