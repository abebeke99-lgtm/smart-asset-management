import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UIProvider, useLanguage } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';
import CollegeDashboard from './CollegeDashboard';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() }
}));

function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
    >
      {language === 'en' ? 'Amharic' : 'English'}
    </button>
  );
}

describe('CollegeDashboard translations', () => {
  beforeEach(() => {
    localStorage.clear();
    apiClient.get.mockResolvedValue({
      data: {
        data: {
          college: { name: 'Engineering', code: 'ENG' },
          summary: { totalAssets: 5, activeAssets: 3, pendingRequests: 1 }
        }
      }
    });
  });

  it('updates college dashboard copy immediately without reloading its data', async () => {
    render(
      <UIProvider>
        <MemoryRouter>
          <CollegeDashboard />
          <LanguageToggle />
        </MemoryRouter>
      </UIProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Assets by Department' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asset Status Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage Assets/ })).toHaveAttribute('href', '/college/assets');
    expect(apiClient.get).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Amharic' }));

    expect(await screen.findByRole('heading', { name: 'የኮሌጅ አስተዳዳሪ ዳሽቦርድ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የንብረት ሁኔታ አጠቃላይ እይታ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ንብረቶችን ያስተዳድሩ/ })).toHaveAttribute('href', '/college/assets');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('language')).toBe('am');
  });
});
