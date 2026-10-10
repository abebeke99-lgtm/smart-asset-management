import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import AssetDetails from './AssetDetails';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }));
jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en', theme: 'light' }),
}));
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'ict_officer' } }),
}));

const asset = {
  id: 3,
  name: 'Regression asset',
  status: 'Available',
  asset_tag: 'ASSET-0001',
};

const renderAssetDetails = () => render(
  <MemoryRouter initialEntries={['/ict/assets/3']}>
    <Routes>
      <Route path="/ict/assets/:id" element={<AssetDetails />} />
      <Route path="/assets" element={<div>Asset list</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  axios.get.mockReset();
  toast.error.mockReset();
});

test('keeps a loaded asset visible when its history request is denied', async () => {
  axios.get
    .mockResolvedValueOnce({ data: { success: true, asset } })
    .mockRejectedValueOnce({ response: { status: 403 } });

  renderAssetDetails();

  expect(await screen.findByRole('heading', { name: 'Regression asset' })).toBeInTheDocument();
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to load asset history'));
  expect(screen.queryByText('Asset list')).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenNthCalledWith(1, '/api/assets/3');
  expect(axios.get).toHaveBeenNthCalledWith(2, '/api/assets/3/history');
});

test('continues to treat an asset detail 404 as a missing asset', async () => {
  axios.get.mockRejectedValueOnce({ response: { status: 404 } });

  renderAssetDetails();

  expect(await screen.findByText('Asset list')).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(toast.error).toHaveBeenCalledWith('Failed to load asset details');
});
