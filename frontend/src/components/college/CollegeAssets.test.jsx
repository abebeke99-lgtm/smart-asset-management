import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { UiProvider, useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import CollegeAssets from './CollegeAssets';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn()
  }
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <button type="button" onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}>
      Switch language
    </button>
  );
}

beforeEach(() => {
  localStorage.setItem('language', 'en');
  apiClient.get.mockReset();
  apiClient.post.mockReset();
  apiClient.put.mockReset();
  useAuth.mockReturnValue({ user: null, hasPermission: () => false });
  apiClient.get.mockResolvedValue({
    data: {
      data: [{
        id: 3,
        assetCode: 'MAU-003',
        name: 'Laboratory Microscope',
        serialNumber: 'SN-003',
        category: 'Laboratory Equipment',
        status: 'available',
        condition: 'functional',
        currentValue: 1200
      }],
      summary: { total: 1, active: 1, assigned: 0, available: 1, maintenance: 0, damagedMissing: 0 },
      filters: { categories: [], statuses: [], conditions: [], locations: [], assignmentStatuses: [], departments: [] },
      pagination: { page: 1, limit: 20, total: 1, pages: 1 }
    }
  });
});

test('switches asset inventory labels immediately without repeating the API request', async () => {
  render(
    <UiProvider>
      <MemoryRouter>
        <LanguageSwitch />
        <CollegeAssets inventory />
      </MemoryRouter>
    </UiProvider>
  );

  expect(await screen.findByRole('heading', { name: 'College Inventory' })).toBeInTheDocument();
  expect(screen.getByText('Asset Tag')).toBeInTheDocument();
  expect(screen.getByText('Laboratory Microscope')).toBeInTheDocument();
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));
  expect(apiClient.get).toHaveBeenCalledWith('/api/college/inventory', expect.objectContaining({
    params: expect.objectContaining({ page: 1, limit: 20 })
  }));

  fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));

  expect(await screen.findByRole('heading', { name: 'የኮሌጅ እቃ ቆጠራ' })).toBeInTheDocument();
  expect(screen.getByText('የንብረት መለያ')).toBeInTheDocument();
  expect(screen.getByText('Laboratory Microscope')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledTimes(1);
});

test('translates asset details and preserves the requested asset id', async () => {
  apiClient.get.mockImplementation((url) => Promise.resolve(url.includes('/api/college/assets/') ? {
    data: { data: { id: 3, name: 'Laboratory Microscope', assetCode: 'MAU-003', serialNumber: 'SN-003' } }
  } : {
    data: {
      data: [{ id: 3, name: 'Laboratory Microscope', assetCode: 'MAU-003' }],
      summary: {},
      filters: { categories: [], statuses: [], conditions: [], locations: [], assignmentStatuses: [], departments: [] },
      pagination: { page: 1, limit: 20, total: 1, pages: 1 }
    }
  }));

  render(
    <UiProvider>
      <MemoryRouter><CollegeAssets /></MemoryRouter>
    </UiProvider>
  );

  await screen.findByRole('heading', { name: 'College Assets' });
  fireEvent.click(screen.getByRole('button', { name: 'View details for Laboratory Microscope' }));

  expect(await screen.findByRole('dialog')).toHaveTextContent('Asset details');
  expect(screen.getByText('Serial Number')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/college/assets/3');
});

test('college managers can register an asset with scoped reference data and refresh the list', async () => {
  useAuth.mockReturnValue({
    user: { role: 'college_manager' },
    hasPermission: (permission) => permission === 'college.assets.create'
  });
  apiClient.get.mockImplementation((url) => {
    if (url.endsWith('/registration-options')) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            college: { id: 4, name: 'Engineering College' },
            categories: [{ id: 2, name: 'Laboratory Equipment' }],
            departments: [{ id: 9, name: 'Physics' }],
            custodians: [{ id: 15, name: 'Alemu Bekele' }]
          }
        }
      });
    }
    return Promise.resolve({
      data: {
        data: [{ id: 3, assetCode: 'MAU-003', name: 'Laboratory Microscope', category: 'Laboratory Equipment' }],
        summary: { total: 1 },
        filters: { categories: [], statuses: [], conditions: [], locations: [], assignmentStatuses: [], departments: [] },
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
        college: { id: 4, name: 'Engineering College' }
      }
    });
  });
  apiClient.post.mockResolvedValue({ data: { success: true, data: { id: 30 } } });

  render(
    <UiProvider>
      <MemoryRouter><CollegeAssets /></MemoryRouter>
    </UiProvider>
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Register asset' }));
  const dialog = await screen.findByRole('dialog', { name: 'Register asset' });
  fireEvent.change(within(dialog).getByLabelText(/Asset code/), { target: { value: 'ENG-001' } });
  fireEvent.change(within(dialog).getByLabelText(/Asset name/), { target: { value: 'New microscope' } });
  fireEvent.change(within(dialog).getByLabelText(/Category/), { target: { value: 'Laboratory Equipment' } });
  fireEvent.change(within(dialog).getByLabelText(/Department/), { target: { value: '9' } });
  fireEvent.change(within(dialog).getByLabelText(/^Location/), { target: { value: 'Physics Lab' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save asset' }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/college/assets', expect.objectContaining({
    assetCode: 'ENG-001',
    name: 'New microscope',
    category: 'Laboratory Equipment',
    departmentId: 9,
    location: 'Physics Lab',
    quantity: 1
  })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(3));
});

test('registered assets refresh into the College Inventory list', async () => {
  let registered = false;
  useAuth.mockReturnValue({
    user: { role: 'college_manager' },
    hasPermission: (permission) => permission === 'college.assets.create'
  });
  apiClient.get.mockImplementation((url) => Promise.resolve(url.endsWith('/registration-options')
    ? { data: { data: { college: { id: 4, name: 'Engineering College' }, categories: [{ id: 2, name: 'Laboratory Equipment' }], departments: [], custodians: [] } } }
    : {
      data: {
        data: registered ? [{ id: 30, assetCode: 'ENG-030', name: 'New microscope', category: 'Laboratory Equipment' }] : [],
        summary: { total: registered ? 1 : 0 },
        filters: {},
        pagination: { page: 1, limit: 20, total: registered ? 1 : 0, pages: 1 }
      }
    }));
  apiClient.post.mockImplementation(async () => {
    registered = true;
    return { data: { success: true, data: { id: 30 } } };
  });

  render(
    <UiProvider>
      <MemoryRouter><CollegeAssets inventory /></MemoryRouter>
    </UiProvider>
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Register asset' }));
  const dialog = await screen.findByRole('dialog', { name: 'Register asset' });
  fireEvent.change(within(dialog).getByLabelText(/Asset code/), { target: { value: 'ENG-030' } });
  fireEvent.change(within(dialog).getByLabelText(/Asset name/), { target: { value: 'New microscope' } });
  fireEvent.change(within(dialog).getByLabelText(/Category/), { target: { value: 'Laboratory Equipment' } });
  fireEvent.change(within(dialog).getByLabelText(/^Location/), { target: { value: 'Physics Lab' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save asset' }));

  expect(await screen.findByText('New microscope')).toBeInTheDocument();
  expect(apiClient.post).toHaveBeenCalledWith('/api/college/assets', expect.objectContaining({
    assetCode: 'ENG-030',
    name: 'New microscope',
    category: 'Laboratory Equipment',
    location: 'Physics Lab'
  }));
  expect(apiClient.get).toHaveBeenCalledWith('/api/college/inventory', expect.objectContaining({
    params: expect.objectContaining({ page: 1, limit: 20 })
  }));
});

test('college managers with update permission edit an existing asset through the scoped endpoint', async () => {
  useAuth.mockReturnValue({
    user: { role: 'college_manager' },
    hasPermission: (permission) => permission === 'college.assets.update'
  });
  apiClient.get.mockImplementation((url) => Promise.resolve(url.endsWith('/registration-options')
    ? { data: { data: { college: { id: 4, name: 'Engineering College' }, categories: [{ id: 2, name: 'Laboratory Equipment' }], departments: [], custodians: [] } } }
    : { data: { data: [{ id: 3, assetCode: 'MAU-003', name: 'Laboratory Microscope', category: 'Laboratory Equipment', purchaseDate: '2024-01-01', purchasePrice: 1200 }], summary: {}, filters: {}, pagination: { page: 1, limit: 20, total: 1, pages: 1 } } }));
  apiClient.put.mockResolvedValue({ data: { success: true, data: { id: 3 } } });

  render(
    <UiProvider>
      <MemoryRouter><CollegeAssets /></MemoryRouter>
    </UiProvider>
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Edit Laboratory Microscope' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit asset' });
  fireEvent.change(within(dialog).getByLabelText(/Asset name/), { target: { value: 'Updated microscope' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save asset' }));

  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/college/assets/3', expect.objectContaining({
    name: 'Updated microscope',
    category: 'Laboratory Equipment',
    purchaseDate: '2024-01-01'
  })));
});

test('invalid list responses produce a visible error and Retry reloads the list', async () => {
  apiClient.get
    .mockResolvedValueOnce({ data: { data: { unexpected: true } } })
    .mockResolvedValueOnce({
      data: {
        data: [],
        summary: {},
        filters: {},
        pagination: { page: 1, limit: 20, total: 0, pages: 1 }
      }
    });

  render(
    <UiProvider>
      <MemoryRouter><CollegeAssets /></MemoryRouter>
    </UiProvider>
  );

  expect(await screen.findByRole('alert')).toHaveTextContent('The server returned invalid asset data.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findAllByText('No assets found')).toHaveLength(2);
  expect(apiClient.get).toHaveBeenCalledTimes(2);
});
