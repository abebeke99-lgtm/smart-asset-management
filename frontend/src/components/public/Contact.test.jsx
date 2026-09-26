import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Contact from './Contact';
import { UiProvider } from '../../contexts/UiContext';

const renderContact = () => render(
  <MemoryRouter>
    <UiProvider>
      <Contact />
    </UiProvider>
  </MemoryRouter>
);

describe('Contact', () => {
  beforeEach(() => localStorage.clear());

  it('shows the configured university contact status without a public form or fake details', () => {
    renderContact();

    expect(screen.getByRole('heading', { name: /Contact & Support/i })).toBeInTheDocument();
    expect(screen.getByText(/Official contact channels are shown only when configured by the university/i)).toBeInTheDocument();
    expect(screen.getByText('Not yet configured')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send|submit/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Help/i })).toHaveAttribute('href', '/help');
    expect(screen.getByRole('link', { name: /Back to Home/i })).toHaveAttribute('href', '/');
  });

  it('renders the contact content in Amharic using the shared language setting', () => {
    localStorage.setItem('language', 'am');
    renderContact();

    expect(screen.getByRole('heading', { name: /ግንኙነትና ድጋፍ/i })).toBeInTheDocument();
    expect(screen.getByText(/ይፋዊ የግንኙነት መንገዶች በዩኒቨርሲቲው ሲዋቀሩ ብቻ ይታያሉ/i)).toBeInTheDocument();
    expect(screen.getByText('አልተዋቀረም')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ወደ እገዛ/i })).toHaveAttribute('href', '/help');
  });
});