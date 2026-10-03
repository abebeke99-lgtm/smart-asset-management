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

  it('renders eight unnumbered service cards with concise copy and existing destinations', () => {
    const { container } = render(
      <MemoryRouter>
        <UIProvider>
          <Services />
        </UIProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Services', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'University Asset Management System', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Digital services for registering, tracking, assigning, maintaining, verifying, and reporting university assets.')).toBeInTheDocument();
    const serviceTitles = [
      'Asset Registration',
      'Inventory Management',
      'Asset Assignment',
      'Asset Transfer',
      'Maintenance',
      'QR & RFID Tracking',
      'Asset Verification',
      'Reports & Analytics'
    ];
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(serviceTitles);
    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.getByText('Register university assets, record identification details, and maintain asset records.')).toBeInTheDocument();
    expect(screen.getByText('Identify assets with QR codes or RFID workflows and record movement activity.')).toBeInTheDocument();
    expect(screen.queryByText(/physical reader hardware is supplied/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0[1-8]$/)).not.toBeInTheDocument();
    expect(container.querySelector('.services-card-number')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home');
    expect(screen.getAllByRole('link')).toHaveLength(9);
    [
      '/admin/assets/create',
      '/admin/inventory/overview',
      '/admin/assets/assign',
      '/admin/assets/transfer',
      '/admin/maintenance',
      '/admin/rfid/qr',
      '/college/verification',
      '/admin/reports'
    ].forEach((destination, index) => {
      expect(screen.getByRole('link', { name: `Learn More ${serviceTitles[index]}` })).toHaveAttribute('href', destination);
    });
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
    expect(screen.getByRole('heading', { name: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የንብረት ምዝገባ', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/ኢንቬንተሪንና የክምችት መጠንን ይከታተሉ/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /ተጨማሪ ይመልከቱ/ })).toHaveLength(8);
    expect(screen.queryByText(/አካላዊ የRFID አንባቢ መሳሪያ/)).not.toBeInTheDocument();
  });
});
