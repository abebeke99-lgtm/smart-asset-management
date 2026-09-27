import React from 'react';
import { render, screen, within } from '@testing-library/react';
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

    expect(screen.getByRole('heading', { name: /University Asset Management System/i })).toBeInTheDocument();
    expect(screen.getByText(/Asset registration/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Operational services built for the university/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why Departments Choose This System' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Centralized Asset Records' })).toBeInTheDocument();
    expect(screen.getByText('Manage accurate university asset information in one centralized platform.')).toBeInTheDocument();
    expect(screen.getByText('Track who is responsible for each asset and maintain clear accountability.')).toBeInTheDocument();
    expect(screen.getByText('Support efficient coordination between departments, colleges, stores, ICT, finance, and maintenance.')).toBeInTheDocument();
    expect(screen.getByText('Provide organized information for operational and financial decision-making.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How the System Works' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Built for Every Role' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Secure by Design' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trusted by Mekdela Amba University' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quick Links' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ready to Get Started?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View the full asset lifecycle/i })).toHaveAttribute('href', '/about#lifecycle');
    expect(screen.getByRole('link', { name: /View role responsibilities/i })).toHaveAttribute('href', '/about#about-roles-title');
    expect(screen.getByRole('link', { name: /Help/i })).toHaveAttribute('href', '/help');
    expect(screen.getByRole('link', { name: /Contact/i })).toHaveAttribute('href', '/contact');
    expect(screen.getAllByRole('link', { name: /Login/i })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /Login/i })[0]).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /Learn More/i })).toHaveAttribute('href', '/about');
  });

  it('renders Amharic page content from the shared language context', () => {
    localStorage.setItem('language', 'am');
    render(
      <MemoryRouter>
        <UIProvider><Home /></UIProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት' })).toBeInTheDocument();
    expect(screen.getByText('ንብረት መመዝገብ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ስርዓቱ እንዴት ይሰራል?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ለሁሉም ሚናዎች የተዘጋጀ' })).toBeInTheDocument();
    expect(screen.getByText('ትክክለኛ የዩኒቨርሲቲ ንብረት መረጃን በአንድ ማዕከላዊ መድረክ ያስተዳድሩ።')).toBeInTheDocument();
    expect(screen.getByText('ለእያንዳንዱ ንብረት ተጠያቂውን ይከታተሉ እና ግልጽ ተጠያቂነትን ያስጠብቁ።')).toBeInTheDocument();
    expect(screen.getByText('የአስተዳደርና የፋይናንስ ኦዲት መዝገቦች')).toBeInTheDocument();
  });

  it('renders the shared public footer with navigation, legal notice, and language controls', () => {
    render(<App />);

    const footer = screen.getByRole('contentinfo');
    const footerContent = within(footer);

    expect(footerContent.getByText('University Asset Management System')).toBeInTheDocument();
    const quickLinks = within(footerContent.getByRole('navigation', { name: 'Quick Links' }));
    expect(quickLinks.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home');
    expect(quickLinks.getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '/about');
    expect(quickLinks.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '/features');
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
    expect(footerContent.getByRole('button', { name: 'Switch language to English' })).toBeInTheDocument();
    expect(footerContent.getByRole('button', { name: 'Switch language to Amharic' })).toBeInTheDocument();
  });
});
