import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Help from './Help';

let mockLanguage = 'en';

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: mockLanguage }),
  useTheme: () => ({ theme: 'light' })
}));

describe('Help page', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  it('shows the documented help hero and support messaging', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: /Mekdela Amba University/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /University Asset Management System/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Help & Support/i })).toBeInTheDocument();
    expect(screen.getByText(/Guidance for the asset records and workflows available in your role/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Roles and Access' })).toBeInTheDocument();
    expect(screen.getByText('Official contact details have not been configured.')).toBeInTheDocument();
    expect(screen.getByText('Public message submission is unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Contact Information' })).toHaveAttribute('href', '/contact');
  });

  it('filters help content in real time and handles empty results with the documented empty state', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);
    const search = screen.getByPlaceholderText('Search help topics or questions...');

    fireEvent.change(search, { target: { value: 'transfer' } });
    expect(screen.getByText('How do I transfer an asset?')).toBeInTheDocument();
    expect(screen.queryByText('How do I report a maintenance issue?')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'maintenance' } });
    expect(screen.getByText('How do I report a maintenance issue?')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'not-a-real-help-topic' } });
    expect(screen.getByText('No matching help topics found.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('How do I transfer an asset?')).toBeInTheDocument();
  });

  it('supports role filtering and keeps all documented roles visible', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'All Roles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Store Manager' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maintenance' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Maintenance' }));
    expect(screen.getByText('Coordinates service requests, inspections, work orders, and repairs.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All Roles' }));
    expect(screen.getByText('ICT Officer')).toBeInTheDocument();
  });

  it('renders the documented Amharic language strings', () => {
    mockLanguage = 'am';
    render(<MemoryRouter><Help /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'እገዛና ድጋፍ' })).toBeInTheDocument();
    expect(screen.getByText('የእገዛ ርዕሶች')).toBeInTheDocument();
  });
});