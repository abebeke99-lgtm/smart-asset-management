/* eslint-disable no-unused-vars, no-dupe-keys, no-template-curly-in-string */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeptTracking from './DeptTracking';
import apiClient from '../../services/apiClient';
import { UiProvider } from '../../contexts/UiContext';
import { Html5Qrcode } from 'html5-qrcode';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getApiErrorMessage: (error, fallback) => error?.response?.data?.message || fallback,
}));
jest.mock('html5-qrcode', () => ({ Html5Qrcode: jest.fn() }));

const asset = {
  id: 21,
  assetCode: 'ASSET-21',
  name: 'Department laptop',
  category: 'Computers',
  serialNumber: 'SER-21',
  qrCode: 'QR-21',
  rfidTag: 'RFID-21',
  department: 'Engineering',
  condition: 'Good',
  warrantyExpiry: '2027-08-01',
  assigned_to_name: 'Aster Bekele',
};

const renderPage = () => render(
  <MemoryRouter>
    <UiProvider><DeptTracking /></UiProvider>
  </MemoryRouter>,
);

beforeEach(() => {
  localStorage.setItem('language', 'en');
  apiClient.get.mockReset();
  Html5Qrcode.mockReset();
  apiClient.get.mockImplementation((url) => {
    if (url === '/assets/scan/QR-21') return Promise.resolve({ data: { data: asset } });
    if (url === '/assets/21') return Promise.resolve({ data: { asset } });
    if (url === '/assets/21/location') return Promise.resolve({ data: { data: { campus: 'Main Campus', building: 'Science', floor: 2, room: '204' } } });
    if (url === '/assets/21/assignments') return Promise.resolve({ data: { data: [{ status: 'active', userName: 'Aster Bekele', condition: 'Good' }] } });
    if (url === '/assets/21/transfers') return Promise.resolve({ data: { data: [{ fromLocation: 'Room 100', toLocation: 'Room 204', fromDepartment: 'Store', toDepartment: 'Engineering', transferredAt: '2026-05-01' }] } });
    if (url === '/assets/21/maintenance') return Promise.resolve({ data: { data: [{ title: 'Screen repair', status: 'completed', requestedAt: '2026-04-01' }] } });
    if (url === '/assets/21/documents') return Promise.resolve({ data: { data: [{ id: 8, originalName: 'Warranty.pdf', documentType: 'warranty' }] } });
    if (url === '/assets/21/history') return Promise.resolve({ data: { history: [{ type: 'rfid', action: 'RFID Scan', description: 'Reader detected at Room 204', date: '2026-05-02' }] } });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
});

test('looks up authorized department assets and displays tracking details', async () => {
  renderPage();
  fireEvent.change(screen.getByLabelText('QR code, RFID tag, or asset ID'), { target: { value: 'QR-21' } });
  fireEvent.click(screen.getByRole('button', { name: 'Look up asset' }));

  expect(await screen.findByRole('heading', { name: 'Department laptop' })).toBeInTheDocument();
  expect(screen.getByText('ASSET-21')).toBeInTheDocument();
  expect(screen.getByText('Main Campus · Science · Floor 2 · 204')).toBeInTheDocument();
  expect(screen.getByText('Aster Bekele')).toBeInTheDocument();
  expect(screen.getByText('2027-08-01')).toBeInTheDocument();
  expect(screen.getByText('Screen repair')).toBeInTheDocument();
  expect(screen.getByText('Warranty.pdf')).toBeInTheDocument();
  expect(screen.getByText('Room 100 → Room 204')).toBeInTheDocument();
  expect(screen.getByText('RFID movement events')).toBeInTheDocument();
  expect(screen.getByText('Reader detected at Room 204 · 2026-05-02')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/assets/scan/QR-21');
  expect(apiClient.get).toHaveBeenCalledWith('/assets/21/transfers');
  expect(apiClient.get).toHaveBeenCalledWith('/assets/21/history');
});

test('reports authorization-safe not-found results without requesting asset history', async () => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/assets/scan/EXTERNAL-ASSET') {
      return Promise.reject({ response: { status: 404, data: { message: 'Asset not found for identifier' } } });
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
  renderPage();
  fireEvent.change(screen.getByLabelText('QR code, RFID tag, or asset ID'), { target: { value: 'EXTERNAL-ASSET' } });
  fireEvent.click(screen.getByRole('button', { name: 'Look up asset' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Asset not found for identifier');
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));
  expect(apiClient.get).toHaveBeenCalledWith('/assets/scan/EXTERNAL-ASSET');
  expect(screen.queryByText('Department laptop')).not.toBeInTheDocument();
});

test('camera QR scans use the authorized department lookup', async () => {
  const originalAnimationFrame = window.requestAnimationFrame;
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  const start = jest.fn().mockImplementation((_camera, _config, onDecode) => {
    window.setTimeout(() => onDecode('QR-21'), 0);
    return Promise.resolve();
  });
  Html5Qrcode.mockImplementation(() => ({
    start,
    stop: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn(),
  }));
  try {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));

    expect(await screen.findByRole('heading', { name: 'Department laptop' })).toBeInTheDocument();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/assets/scan/QR-21'));
    expect(start).toHaveBeenCalled();
  } finally {
    window.requestAnimationFrame = originalAnimationFrame;
  }
});

test('offers the existing physical inventory verification workflow', () => {
  renderPage();
  const verificationLink = screen.getByRole('link', { name: /Physical inventory verification/ });
  expect(verificationLink).toHaveAttribute('href', '/department-head/verification');
  expect(within(verificationLink).getByText('Physical inventory verification')).toBeInTheDocument();
});
