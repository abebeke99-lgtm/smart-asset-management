import React from 'react';
import fs from 'fs';
import path from 'path';
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

const serviceImagePaths = [
  '/images/assets/asset-registration.jpg',
  '/images/workflow/asset-workflow.svg',
  '/images/assets/asset-management.svg',
  '/images/assets/asset-transfer.svg',
  '/images/maintenance/maintenance-management.svg',
  '/images/technology/rfid-tracking.svg',
  '/images/security/asset-security.svg',
  '/images/analytics/asset-analytics.svg'
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

    expect(screen.getByRole('heading', { name: 'Asset Management Modules', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Manage, track, verify, and analyze university assets in one place.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    expect(screen.queryByText('Digital services for registering, tracking, assigning, maintaining, verifying, and reporting university assets.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(serviceTitles);
    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.getByText('Register university assets, record identification details, and maintain asset records.')).toBeInTheDocument();
    expect(screen.getByText('Identify assets with QR codes or RFID workflows and record movement activity.')).toBeInTheDocument();
    expect(screen.queryByText(/physical reader hardware is supplied/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0[1-8]$/)).not.toBeInTheDocument();
    expect(container.querySelector('.services-card-number')).toBeNull();
    expect(screen.getAllByRole('link', { name: /^View Details:/ })).toHaveLength(8);
    expect(screen.getAllByRole('button', { name: /^More info:/ })).toHaveLength(8);
    destinations.forEach((destination, index) => {
      expect(screen.getByRole('link', { name: `View Details: ${serviceTitles[index]}` })).toHaveAttribute('href', destination);
    });

    const cardImages = container.querySelectorAll('.services-card-image-frame img');
    expect(cardImages).toHaveLength(8);
    expect(new Set(Array.from(cardImages, (image) => image.getAttribute('src'))).size).toBe(8);
    expect(Array.from(cardImages, (image) => image.getAttribute('src'))).toEqual(serviceImagePaths);
    cardImages.forEach((image) => expect(image).toHaveAttribute('alt', expect.stringMatching(/\S/)));
    serviceImagePaths.forEach((imagePath) => {
      expect(fs.existsSync(path.join(process.cwd(), 'public', imagePath.replace(/^\//, '')))).toBe(true);
    });

    expect(container.querySelector('.services-hero')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.services-card-image-frame img')).toHaveLength(8);
    expect(container.querySelector('style').textContent).toContain('object-fit: cover');
    expect(container.querySelector('style').textContent).toContain('object-fit: contain');
  });

  it('opens complete service details and links to registered application destinations', () => {
    renderServices();
    serviceTitles.forEach((title, index) => {
      const trigger = screen.getByRole('button', { name: `More info: ${title}` });
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
    const trigger = screen.getByRole('button', { name: 'More info: Asset Registration' });
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
    const image = screen.getByRole('img', { name: 'Asset registration form and image preview' });

    fireEvent.error(image);

    expect(screen.getByRole('img', { name: 'Asset registration form and image preview' })).toBeInTheDocument();
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

    expect(screen.getByRole('img', { name: 'የንብረት ምዝገባ ቅጽና የምስል ቅድመ እይታ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የንብረት አስተዳደር ሞጁሎች', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    expect(screen.queryByText('ለዩኒቨርሲቲ ንብረቶች ምዝገባ፣ ክትትል፣ ምደባ፣ ጥገና፣ ማረጋገጫና ሪፖርት የዲጂታል አገልግሎቶች።')).not.toBeInTheDocument();
    expect(screen.getByText('የዩኒቨርሲቲ ንብረቶችን በአንድ ቦታ ያስተዳድሩ፣ ይከታተሉ፣ ያረጋግጡና ይተንትኑ።')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የንብረት ምዝገባ', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/ኢንቬንተሪንና የክምችት መጠንን ይከታተሉ/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^ዝርዝር ይመልከቱ:/ })).toHaveLength(8);

    fireEvent.click(screen.getByRole('button', { name: 'ተጨማሪ መረጃ: የንብረት ምዝገባ' }));
    const dialog = screen.getByRole('dialog', { name: 'የንብረት ምዝገባ' });
    expect(within(dialog).getByRole('heading', { name: 'ማከናወን የሚችሉት' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'አገልግሎቱን ክፈት' })).toHaveAttribute('href', destinations[0]);
    expect(within(dialog).getByRole('button', { name: 'የአገልግሎት ዝርዝር ዝጋ' })).toBeInTheDocument();
  });
});
