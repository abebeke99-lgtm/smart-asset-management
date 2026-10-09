import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { UiProvider, useLanguage } from '../../contexts/UiContext';
import CollegeAssets from './CollegeAssets';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn()
  }
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
