import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UIProvider, useLanguage } from '../../contexts/UiContext';
import Services from './Services';

const LanguageSwitcher = () => {
  const { setLanguage } = useLanguage();
  return <button type="button" onClick={() => setLanguage('am')}>Switch language</button>;
};

describe('Services page', () => {
  beforeEach(() => localStorage.setItem('language', 'en'));

  it('renders the eight public service descriptions without dashboard links', () => {
    render(
      <MemoryRouter>
        <UIProvider>
          <Services />
        </UIProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Services', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Digital services for efficient, accountable, and transparent university asset management.')).toBeInTheDocument();
    [
      'Asset Registration',
      'Inventory Management',
      'Asset Assignment',
      'Asset Transfer',
      'Maintenance',
      'RFID / QR Tracking',
      'Asset Verification',
      'Reports & Analytics'
    ].forEach((title) => expect(screen.getByRole('heading', { name: title, level: 3 })).toBeInTheDocument());
    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.getByText(/physical reader hardware is supplied/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /asset|inventory|transfer|maintenance|report/i })).not.toBeInTheDocument();
  });

  it('updates all service content when the shared language changes to Amharic', () => {
    render(
      <MemoryRouter>
        <UIProvider>
          <LanguageSwitcher />
          <Services />
        </UIProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));

    expect(screen.getByRole('heading', { name: 'አገልግሎቶች', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የንብረት ምዝገባ', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/የክምችት ክትትል/)).toBeInTheDocument();
    expect(screen.getByText(/አካላዊ የRFID አንባቢ መሳሪያ/)).toBeInTheDocument();
  });
});
