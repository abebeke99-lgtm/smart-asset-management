import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UIProvider, useLanguage } from '../../contexts/UiContext';
import Services from './Services';

const LanguageSwitcher = () => {
  const { setLanguage } = useLanguage();
  return <button type="button" onClick={() => setLanguage('am')}>Switch language</button>;
};

const destinations = [
  '/admin/assets/create',
  '/ict/inventory',
  '/admin/assets/assign',
  '/admin/assets/transfer',
  '/admin/maintenance',
  '/admin/rfid',
  '/college/verification',
  '/admin/reports'
];

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

const renderServices = (children = <Services />) => render(
  <MemoryRouter>
    <UIProvider>{children}</UIProvider>
  </MemoryRouter>
);

describe('Services page', () => {
  beforeEach(() => localStorage.setItem('language', 'en'));

  it('omits the hero breadcrumb and text while preserving the image treatment and eight service cards', () => {
    const { container } = renderServices();

    expect(screen.getByRole('heading', { name: 'University Asset Management System', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Services', level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    expect(screen.queryByText('Digital services for registering, tracking, assigning, maintaining, verifying, and reporting university assets.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(serviceTitles);
    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.getByText('Register university assets, record identification details, and maintain asset records.')).toBeInTheDocument();
    expect(screen.getByText('Identify assets with QR codes or RFID workflows and record movement activity.')).toBeInTheDocument();
    expect(screen.queryByText(/physical reader hardware is supplied/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0[1-8]$/)).not.toBeInTheDocument();
    expect(container.querySelector('.services-card-number')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^View Details:/ })).toHaveLength(8);
    expect(screen.queryAllByRole('link')).toHaveLength(0);

    const cardImages = container.querySelectorAll('.services-card-image-frame img');
    expect(cardImages).toHaveLength(8);
    expect(new Set(Array.from(cardImages, (image) => image.getAttribute('src'))).size).toBe(8);
    cardImages.forEach((image) => expect(image).toHaveAttribute('alt', expect.stringMatching(/\S/)));

    expect(container.querySelector('.services-hero-image')).toHaveAttribute('src', '/images/hero/4-1.jpg');
    expect(container.querySelector('.services-hero-overlay')).toBeInTheDocument();
    expect(container.querySelector('.services-hero')).toHaveStyle({ background: '#419fd9' });
    expect(container.querySelector('style').textContent).toContain('object-fit: cover');
  });

  it('opens complete service details and links to registered application destinations', () => {
    renderServices();
    serviceTitles.forEach((title, index) => {
      const trigger = screen.getByRole('button', { name: `View Details: ${title}` });
      fireEvent.click(trigger);

      const dialog = screen.getByRole('dialog', { name: title });
      expect(within(dialog).getByRole('heading', { name: 'What you can do' })).toBeInTheDocument();
      expect(within(dialog).getAllByRole('listitem')).toHaveLength(5);
      expect(within(dialog).getByRole('img', { name: /\S/ })).toBeInTheDocument();
      expect(within(dialog).getByRole('link', { name: 'Open Service' })).toHaveAttribute('href', destinations[index]);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Close service details' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it('supports Escape and keeps keyboard focus within the detail dialog', () => {
    renderServices();
    const trigger = screen.getByRole('button', { name: 'View Details: Asset Registration' });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'Close service details' });
    const open = within(dialog).getByRole('link', { name: 'Open Service' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(open).toHaveFocus();
    fireEvent.keyDown(open, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(open).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('shows an accessible fallback when a service image fails to load', () => {
    renderServices();
    const image = screen.getByRole('img', { name: 'Illustration of a computer-based university asset registration form' });

    fireEvent.error(image);

    expect(screen.getByRole('img', { name: 'Illustration of a computer-based university asset registration form' })).toBeInTheDocument();
  });

  it('retains responsive layout and honors reduced-motion preferences', () => {
    const { container } = renderServices();
    const styles = container.querySelector('style').textContent;

    expect(styles).toContain('@media (max-width: 1050px)');
    expect(styles).toContain('@media (max-width: 640px)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('.services-detail-dialog');
  });

  it('updates the cards and details when the shared language changes to Amharic', () => {
    renderServices(
      <>
        <LanguageSwitcher />
        <Services />
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));

    expect(screen.queryByRole('heading', { name: 'አገልግሎቶች', level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    expect(screen.queryByText('ለዩኒቨርሲቲ ንብረቶች ምዝገባ፣ ክትትል፣ ምደባ፣ ጥገና፣ ማረጋገጫና ሪፖርት የዲጂታል አገልግሎቶች።')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የንብረት ምዝገባ', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/ኢንቬንተሪንና የክምችት መጠንን ይከታተሉ/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^ዝርዝር ይመልከቱ:/ })).toHaveLength(8);

    fireEvent.click(screen.getByRole('button', { name: 'ዝርዝር ይመልከቱ: የንብረት ምዝገባ' }));
    const dialog = screen.getByRole('dialog', { name: 'የንብረት ምዝገባ' });
    expect(within(dialog).getByRole('heading', { name: 'ማከናወን የሚችሉት' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'አገልግሎቱን ክፈት' })).toHaveAttribute('href', destinations[0]);
    expect(within(dialog).getByRole('button', { name: 'የአገልግሎት ዝርዝር ዝጋ' })).toBeInTheDocument();
  });
});
