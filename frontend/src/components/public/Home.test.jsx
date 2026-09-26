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
    expect(screen.getByText('የአስተዳደርና የፋይናንስ ኦዲት መዝገቦች')).toBeInTheDocument();
  });

  it('renders a unified public footer with verified support and security content', () => {
    render(<App />);

    const footer = screen.getByRole('contentinfo');
    const footerContent = within(footer);

    expect(footerContent.getByText('University Asset Management System')).toBeInTheDocument();
    expect(footerContent.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/home');
    expect(footerContent.getByRole('link', { name: /About Us/i })).toHaveAttribute('href', '/about');
    expect(footerContent.getByRole('link', { name: /Services/i })).toHaveAttribute('href', '/about#services');
    expect(footerContent.getByRole('link', { name: /Features/i })).toHaveAttribute('href', '/about#features');
    expect(footerContent.getByRole('link', { name: /Help/i })).toHaveAttribute('href', '/help');
    expect(footerContent.getByRole('link', { name: /Contact/i })).toHaveAttribute('href', '/contac');
    expect(footerContent.getByRole('heading', { name: /Support/i })).toBeInTheDocument();
    expect(footerContent.getByText(/Secure Asset Management/i)).toBeInTheDocument();
    expect(footerContent.getByText(/Role-Based Access Control/i)).toBeInTheDocument();
    expect(footerContent.getByText(/Audit & Accountability/i)).toBeInTheDocument();
    expect(footerContent.queryByRole('button', { name: /English|አማርኛ/i })).not.toBeInTheDocument();
  });
});
