import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('shows verified guidance, unavailable support status, and real quick-action routes', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);

    expect(screen.getByText('Mekdela Amba University')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /University Asset Management System/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Help & Support/i })).toBeInTheDocument();
    expect(screen.getByText(/Practical guidance for signing in/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Roles and Access' })).toBeInTheDocument();
    expect(screen.getByText('Official contact details have not been configured.')).toBeInTheDocument();
    expect(screen.getByText('Public message submission is unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Contact Information' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: /Login/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /Forgot Password/i })).toHaveAttribute('href', '/forgot-password');
  });

  it('filters help content in real time and clears empty results', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);
    const search = screen.getByPlaceholderText('Search help topics or questions...');

    fireEvent.change(search, { target: { value: 'transfer' } });
    expect(screen.getByText('How do I request a transfer?')).toBeInTheDocument();
    expect(screen.queryByText('How do I report a maintenance issue?')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'maintenance' } });
    expect(screen.getByText('How do I report a maintenance issue?')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'not-a-real-help-topic' } });
    expect(screen.getByText('No matching help topics found.')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear search' })[0]);
    expect(screen.getByText('How do I request a transfer?')).toBeInTheDocument();
  });

  it('supports role filtering with localized role names', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'All Roles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Administrator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Store Manager' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maintenance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Infrastructure' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Maintenance' }));
    expect(screen.getByText('Maintenance records, service requests, and repair workflows.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All Roles' }));
    expect(screen.getByRole('button', { name: 'ICT Officer' })).toBeInTheDocument();
  });

  it('renders Amharic content and matches English search terms', () => {
    mockLanguage = 'am';
    render(<MemoryRouter><Help /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'እገዛና ድጋፍ' })).toBeInTheDocument();
    expect(screen.getByText('የእገዛ ርዕሶች')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የይለፍ ቃል መመለስ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /የይለፍ ቃል ረሳሁ/ })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('button', { name: 'ሁሉም ሚናዎች' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/የእገዛ ርዕስ/), { target: { value: 'maintenance' } });
    expect(screen.getByText('የጥገና ችግርን እንዴት እዘግባለሁ?')).toBeInTheDocument();
    expect(screen.queryByText('የዝውውር ጥያቄ እንዴት አቀርባለሁ?')).not.toBeInTheDocument();
  });

  it('expands and collapses FAQ answers', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);
    const question = screen.getByText('How do I register an asset?');
    const disclosure = question.closest('.help-faq-card');

    expect(within(disclosure).getByText(/Asset creation is restricted/)).not.toBeVisible();
    fireEvent.click(question);
    expect(within(disclosure).getByText(/Asset creation is restricted/)).toBeVisible();
    fireEvent.click(question);
    expect(within(disclosure).getByText(/Asset creation is restricted/)).not.toBeVisible();
  });
});