import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UIProvider } from '../../contexts/UiContext';
import App from '../../App';
import Home from './Home';

describe('Home', () => {
  beforeEach(() => localStorage.clear());

  it('renders the real university asset management landing page content', () => {
    render(
      <MemoryRouter>
        <UIProvider><Home /></UIProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'University Asset Management' })).toBeInTheDocument();
    expect(screen.getAllByText('UNIVERSITY ASSET OPERATIONS')).toHaveLength(2);
    expect(screen.getByText('Manage, track, assign, maintain, and monitor every university asset from one centralized platform.')).toBeInTheDocument();
    expect(screen.getByText(/From asset registration and assignment to transfer, maintenance, verification, returns, and financial reporting/)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Core system features' })).getByText('Asset Registration')).toBeInTheDocument();
    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
    expect(screen.getByText('Complete visibility across the entire asset lifecycle.')).toBeInTheDocument();
    expect(screen.getByText('SYSTEM GOAL')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Operational services built for the university/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Why Departments Choose This System' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'How the System Works' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Built for Every Role' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Secure by Design' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Trusted by Mekdela Amba University' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Quick Links' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ready to Get Started?' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Login to System' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Explore System' })).toHaveAttribute('href', '/about');
  });

  it('overlays the single accessible page heading on the rotating hero image', () => {
    const { container } = render(
      <MemoryRouter>
        <UIProvider><Home /></UIProvider>
      </MemoryRouter>
    );
    const hero = container.querySelector('.uam-hero');
    const imageArea = hero.querySelector('.uam-hero-media');
    const content = hero.querySelector('.uam-hero-shell');
    const imageTitle = screen.getByRole('heading', { name: 'University Asset Management', level: 1 });
    const homeStyles = container.querySelector('style').textContent;

    expect(imageArea.nextElementSibling).toBe(content);
    expect(imageArea.querySelectorAll('.uam-hero-image')).toHaveLength(3);
    expect(imageArea).toContainElement(imageTitle);
    expect(imageTitle).toHaveClass('uam-hero-image-title');
    expect(imageArea.querySelector('.uam-hero-title-backdrop')).toBeInTheDocument();
    expect(content.querySelector('h1')).toBeNull();
    expect(content.querySelector('.uam-hero-copy')).toBeInTheDocument();
    expect(content.querySelector('.uam-hero-panel')).toBeInTheDocument();
    expect(content).toHaveTextContent('Manage, track, assign, maintain, and monitor every university asset from one centralized platform.');
    expect(homeStyles).toContain('position: absolute');
    expect(homeStyles).toContain('color: #FFFFFF');
    expect(homeStyles).toContain('text-shadow: 0 3px 14px');
    expect(homeStyles).toContain('@media (max-width: 640px)');
    expect(homeStyles).toContain('.uam-hero-image-title { right: 18px; bottom: 34px; left: 18px;');
  });

  it('shows the active hero image at full opacity and keeps the smooth responsive image treatment', () => {
    const { container } = render(
      <MemoryRouter>
        <UIProvider><Home /></UIProvider>
      </MemoryRouter>
    );
    const image = container.querySelector('.uam-hero-image.is-active');
    const homeStyles = container.querySelector('style').textContent;

    expect(image).toHaveStyle({ opacity: '1', objectFit: 'cover' });
    expect(homeStyles).toContain('transition: opacity 700ms ease, transform 5s ease');
    expect(homeStyles).toContain('height: min(760px, calc(100svh - 82px))');
    expect(homeStyles).not.toContain('.uam-hero-media::after');
    expect(homeStyles).not.toContain('opacity: 0.14');
  });

  it('rotates hero images with a crossfade', () => {
    jest.useFakeTimers();
    const { container } = render(
      <MemoryRouter>
        <UIProvider><Home /></UIProvider>
      </MemoryRouter>
    );

    expect(container.querySelectorAll('.uam-hero-image.is-active')[0]).toHaveAttribute(
      'src',
      '/images/hero/4-1.jpg',
    );

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(container.querySelectorAll('.uam-hero-image.is-active')).toHaveLength(1);
    expect(container.querySelector('.uam-hero-image.is-active')).toHaveAttribute(
      'src',
      '/images/hero/imagegs.jpg',
    );
    jest.useRealTimers();
  });

  it('renders Amharic page content from the shared language context', () => {
    localStorage.setItem('language', 'am');
    render(
      <MemoryRouter>
        <UIProvider><Home /></UIProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'የዩኒቨርሲቲ ንብረት አስተዳደር' })).toBeInTheDocument();
    expect(screen.getByText('ንብረት መመዝገብ')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ስርዓቱ እንዴት ይሰራል?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ለሁሉም ሚናዎች የተዘጋጀ' })).not.toBeInTheDocument();
    expect(screen.queryByText('ትክክለኛ የዩኒቨርሲቲ ንብረት መረጃን በአንድ ማዕከላዊ መድረክ ያስተዳድሩ።')).not.toBeInTheDocument();
    expect(screen.queryByText('ለእያንዳንዱ ንብረት ተጠያቂውን ይከታተሉ እና ግልጽ ተጠያቂነትን ያስጠብቁ።')).not.toBeInTheDocument();
    expect(screen.queryByText('የአስተዳደርና የፋይናንስ ኦዲት መዝገቦች')).not.toBeInTheDocument();
  });

  it('renders the shared public footer without footer language controls', () => {
    render(<App />);

    const footer = screen.getByRole('contentinfo');
    const footerContent = within(footer);

    expect(footerContent.getByText('University Asset Management System')).toBeInTheDocument();
    const quickLinks = within(footerContent.getByRole('navigation', { name: 'Quick Links' }));
    expect(quickLinks.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home');
    expect(quickLinks.getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '/about');
    expect(quickLinks.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
    expect(quickLinks.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');

    const systemLinks = within(footerContent.getByRole('navigation', { name: 'System' }));
    expect(systemLinks.getByRole('link', { name: 'Asset Management' })).toHaveAttribute('href', '/services');
    expect(systemLinks.getByRole('link', { name: 'Inventory' })).toHaveAttribute('href', '/services');

    const supportLinks = within(footerContent.getByRole('navigation', { name: 'Support' }));
    expect(supportLinks.getByRole('link', { name: 'Help Center' })).toHaveAttribute('href', '/help');
    expect(supportLinks.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/help');
    expect(supportLinks.getByRole('link', { name: 'Contact Support' })).toHaveAttribute('href', '/contact');

    expect(footerContent.getByRole('heading', { name: /Support/i })).toBeInTheDocument();
    expect(footerContent.getByRole('heading', { name: 'Legal' })).toBeInTheDocument();
    expect(footerContent.getByText('Privacy Policy')).toBeInTheDocument();
    expect(footerContent.getByText('Terms of Use')).toBeInTheDocument();
    expect(footerContent.getByText(/Legal pages are not configured/i)).toBeInTheDocument();
    expect(footerContent.queryByRole('group', { name: 'Language' })).not.toBeInTheDocument();
  });
});
