import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import AssetCreate from './AssetCreate';
import apiClient from '../../services/apiClient';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../../contexts/UiContext', () => ({ useLanguage: jest.fn() }));

jest.mock('react-toastify', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

describe('ICT asset creation form', () => {
  beforeEach(() => {
    useLanguage.mockReturnValue({ language: 'en', theme: 'light' });
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        categories: [{ id: 1, name: 'Laptop' }],
        departments: [{ id: 1, name: 'Engineering' }],
      },
    });
    apiClient.post.mockResolvedValue({
      data: { success: true, data: { assetCode: 'ICT-42' } },
    });
  });

  it('submits a blank ICT asset code for backend generation', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/ict/assets/create']}>
        <AssetCreate />
      </MemoryRouter>
    );

    await screen.findByRole('option', { name: 'Laptop' });
    fireEvent.change(container.querySelector('[name="name"]'), { target: { value: 'Test Laptop' } });
    fireEvent.change(container.querySelector('[name="category_id"]'), { target: { value: '1' } });
    fireEvent.change(container.querySelector('[name="department_id"]'), { target: { value: '1' } });
    fireEvent.change(container.querySelector('[name="purchase_date"]'), { target: { value: '2026-09-01' } });
    fireEvent.change(container.querySelector('[name="purchase_cost"]'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Asset' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/ict/assets', expect.objectContaining({
        asset_id: '',
        name: 'Test Laptop',
        category_id: '1',
        department_id: '1',
      }));
    });
    expect(toast.success).toHaveBeenCalled();
  });
});