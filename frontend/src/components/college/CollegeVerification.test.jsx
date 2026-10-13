import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import CollegeVerification from './CollegeVerification';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const assets = [
  { id: 11, assetCode: 'ENG-011', name: 'Microscope', category: 'Equipment', location: 'Lab 1' },
  { id: 12, assetCode: 'ENG-012', name: 'Projector', category: 'Equipment', location: 'Room 2' },
];

const session = { id: 7, name: 'Annual inventory', status: 'in_progress', VerificationItems: [] };
const listResponse = (sessions = []) => ({
  data: {
    success: true,
    data: {
      sessions,
      summary: { totalAssets: 2, verified: 0, pending: 0, notFound: 0, discrepancies: 0, sessions: sessions.length },
      filters: { departments: [], statuses: [], locations: [], assetStatuses: [] },
      pagination: { page: 1, limit: 10, total: sessions.length, totalPages: 1, pages: 1 },
    },
  },
});

const renderPage = () => render(<MemoryRouter><CollegeVerification /></MemoryRouter>);

beforeEach(() => {
  apiClient.get.mockReset();
  apiClient.post.mockReset();
  useAuth.mockReturnValue({ hasPermission: (permission) => permission === 'college.verification.manage' });
  apiClient.get.mockResolvedValue(listResponse());
});

test('starts a college-scoped session and records assets one at a time', async () => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/college/assets') return Promise.resolve({ data: { data: assets, pagination: { pages: 1 } } });
    if (url === '/api/college/verification/7') return Promise.resolve({ data: { success: true, data: session } });
    return Promise.resolve(listResponse([session]));
  });
  apiClient.post.mockImplementation((url, body) => {
    if (url === '/api/college/verification') return Promise.resolve({ data: { success: true, data: session } });
    if (url.endsWith('/items')) return Promise.resolve({ data: { success: true, data: { id: 31, assetId: body.asset_id, state: body.state, notes: body.notes } } });
    return Promise.resolve({ data: { success: true } });
  });

  renderPage();

  fireEvent.click(await screen.findByRole('button', { name: 'Start verification' }));
  fireEvent.change(screen.getByLabelText('Session name'), { target: { value: 'Annual inventory' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

  const workflow = await screen.findByRole('dialog', { name: 'Annual inventory' });
  expect(within(workflow).getByText('Asset 1 of 2')).toBeInTheDocument();
  expect(within(workflow).getByText('Microscope')).toBeInTheDocument();

  fireEvent.change(within(workflow).getByLabelText('Observed result'), { target: { value: 'verified' } });
  fireEvent.click(within(workflow).getByRole('button', { name: 'Save result and continue' }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/college/verification/7/items', {
    asset_id: 11,
    state: 'verified',
    notes: '',
    observed_location: '',
  }));
  expect(await within(workflow).findByText('Projector')).toBeInTheDocument();
  expect(within(workflow).getByText('Asset 2 of 2')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/college/assets', { params: { page: 1, limit: 100 } });
});

test('search filters, status categories, and session pagination request the selected records', async () => {
  apiClient.get.mockImplementation((url, options = {}) => {
    const page = Number(options.params?.page) || 1;
    const response = listResponse([session]);
    response.data.data.pagination = { page, limit: 10, total: 11, totalPages: 2, pages: 2 };
    return Promise.resolve(response);
  });

  renderPage();
  await screen.findByRole('button', { name: 'Filter by Verified verification result' });

  fireEvent.click(screen.getByRole('button', { name: 'Filter by Verified verification result' }));
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/college/verification', expect.objectContaining({
    params: expect.objectContaining({ page: 1, resultState: 'verified' }),
  })));

  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/college/verification', expect.objectContaining({
    params: expect.objectContaining({ page: 2, resultState: 'verified' }),
  })));

  fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/college/verification', expect.objectContaining({
    params: expect.objectContaining({ page: 1, resultState: undefined }),
  })));

  fireEvent.change(screen.getByLabelText('Search verification assets'), { target: { value: 'ENG-011' } });
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/college/verification', expect.objectContaining({
    params: expect.objectContaining({ page: 1, search: 'ENG-011' }),
  })));
});

test('reports asset loading errors when a session cannot load its college inventory', async () => {
  const existingSession = { ...session, VerificationItems: [] };
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/college/verification') return Promise.resolve(listResponse([existingSession]));
    if (url === '/api/college/verification/7') return Promise.resolve({ data: { success: true, data: existingSession } });
    if (url === '/api/college/assets') return Promise.reject({ response: { data: { message: 'Inventory is unavailable.' } } });
    return Promise.resolve(listResponse([existingSession]));
  });

  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'View' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Inventory is unavailable.');
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('users without verification manage permission cannot start sessions', async () => {
  useAuth.mockReturnValue({ hasPermission: () => false });
  renderPage();
  await screen.findByText('No verification sessions found.');
  expect(screen.queryByRole('button', { name: 'Start verification' })).not.toBeInTheDocument();
});
