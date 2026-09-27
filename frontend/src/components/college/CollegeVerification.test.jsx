import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CollegeVerification from './CollegeVerification';
import { UIProvider, useLanguage } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const LanguageControls = () => {
  const { setLanguage } = useLanguage();
  return <div><button type="button" onClick={() => setLanguage('am')}>Use Amharic</button><button type="button" onClick={() => setLanguage('en')}>Use English</button></div>;
};

describe('CollegeVerification', () => {
  beforeEach(() => {
    localStorage.setItem('language', 'en');
    apiClient.get.mockImplementation((url, options = {}) => {
      if (url === '/api/college/verification') {
        const page = options.params?.page || 1;
        return Promise.resolve({
          data: {
            data: {
              sessions: [{ id: 42, createdAt: '2026-09-01T10:00:00.000Z', status: 'in_progress', totalItems: 1, verified: 1, pending: 0, Department: { name: 'Science' }, Starter: { fullName: 'Test Manager' } }],
              summary: { totalAssets: 1, verified: 1, pending: 0, notFound: 0, discrepancies: 0, sessions: 11 },
              filters: { departments: [{ id: 3, name: 'Science' }], statuses: ['in_progress'], locations: ['Lab'], assetStatuses: ['Available'] },
              pagination: { page, limit: 10, total: 11, totalPages: 2, pages: 2 },
            },
          },
        });
      }

      if (url === '/api/college/verification/42') {
        return Promise.resolve({
          data: {
            data: {
              id: 42,
              name: 'Annual inventory',
              status: 'in_progress',
              VerificationItems: [{ id: 5, state: 'verified', notes: 'Checked', Asset: { name: 'Microscope', assetCode: 'AST-05', condition: 'Good' } }],
            },
          },
        });
      }

      return Promise.resolve({ data: {} });
    });
  });

  it('filters, paginates, opens persisted session details, and switches languages', async () => {
    render(<UIProvider><LanguageControls /><CollegeVerification /></UIProvider>);

    expect(await screen.findByRole('heading', { name: 'Physical verification for the authorized college' })).toBeInTheDocument();
    expect(screen.queryByText('Annual inventory')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Department' }), { target: { value: '3' } });
    await waitFor(() => expect(apiClient.get.mock.calls.some(([url, options]) => url === '/api/college/verification' && options.params.departmentId === '3')).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(apiClient.get.mock.calls.some(([url, options]) => url === '/api/college/verification' && options.params.page === 2 && options.params.departmentId === '3')).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    const dialog = await screen.findByRole('dialog');
    expect(await screen.findByText('Microscope')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/api/college/verification/42');

    fireEvent.click(screen.getByRole('button', { name: 'Use Amharic' }));
    expect(await screen.findByText('የማረጋገጫ እቃዎች')).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Use English' }));
    expect(await screen.findByText('Verification items')).toBeInTheDocument();
  });
});