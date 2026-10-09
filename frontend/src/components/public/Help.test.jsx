import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Help from './Help';

let mockLanguage = 'en';

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: mockLanguage }),
  useTheme: () => ({ theme: 'light' })
}));

const renderHelp = () => render(<MemoryRouter><Help /></MemoryRouter>);

describe('Help page', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  it('renders the page introduction and all eight help topic categories', () => {
    renderHelp();

    expect(screen.getByRole('heading', { name: 'Help & Support', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Mekdela Amba University · University Asset Management System')).toBeInTheDocument();
    expect(screen.getByText('Find guidance for managing university assets and using the tools available to your role.')).toBeInTheDocument();
    [
      'Asset Registration and Management',
      'Asset Assignment and Return',
      'Asset Transfer and Verification',
      'Maintenance Requests',
      'Inventory and Stock Management',
      'Asset Disposal',
      'User Accounts and Permissions',
      'Reports and Dashboards'
    ].forEach((title) => {
      expect(screen.getByRole('heading', { name: title, level: 3 })).toBeInTheDocument();
    });
  });

  it('includes the eleven requested questions in their topic accordions', () => {
    renderHelp();

    [
      'How do I register a new asset?',
      'How do I search for an existing asset?',
      'How do I assign an asset to a user or department?',
      'How do I request an asset transfer?',
      'How do I verify an asset?',
      'How do I report a maintenance problem?',
      'How do I return an assigned asset?',
      'How do I check inventory status?',
      'What can a Department Head access?',
      'How do I request asset disposal?',
      'What should I do if I cannot log in?'
    ].forEach((question) => {
      expect(screen.getByRole('button', { name: question })).toHaveAttribute('aria-expanded', 'false');
    });
    expect(screen.getAllByRole('button', { name: /^(How do I|What)/ })).toHaveLength(11);
  });

  it('preserves all public action routes and contact/home links', () => {
    renderHelp();

    expect(screen.getAllByRole('navigation', { name: 'Quick links' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Login' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Forgot Password' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Contact Support' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Forgot Password' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: 'Contact Support' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'View Contact Information' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('heading', { name: 'Need more help?' })).toBeInTheDocument();
    expect(screen.getByText('For account access or workflow questions, contact the support team or your system administrator.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View Contact Information' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Back to Home' })).toHaveLength(1);
  });

  it('filters questions by question text, answer text, category title, and keywords as the user types', () => {
    renderHelp();
    const search = screen.getByRole('searchbox', { name: 'Search help topics' });
    expect(search).toHaveAttribute(
      'placeholder',
      'Search by topic, question, or keyword (e.g., transfer, inventory, assignment)'
    );

    fireEvent.change(search, { target: { value: 'Department Head' } });
    expect(screen.getByRole('button', { name: 'What can a Department Head access?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'How do I register a new asset?' })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'Caps Lock' } });
    expect(screen.getByRole('button', { name: 'What should I do if I cannot log in?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'What can a Department Head access?' })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'Maintenance Requests' } });
    expect(screen.getByRole('heading', { name: 'Maintenance Requests', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How do I report a maintenance problem?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'How do I check inventory status?' })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'QR code' } });
    expect(screen.getByRole('button', { name: 'How do I verify an asset?' })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'asset department' } });
    expect(screen.getByRole('button', { name: 'How do I assign an asset to a user or department?' })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'Reports and Dashboards' } });
    expect(screen.getByRole('heading', { name: 'Reports and Dashboards', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('1 matching topic · 0 questions')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'INVENT' } });
    expect(screen.getByRole('heading', { name: 'Inventory and Stock Management', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How do I check inventory status?' })).toBeInTheDocument();
  });

  it('announces empty search results and restores all topics with the clear control', () => {
    renderHelp();
    const search = screen.getByRole('searchbox', { name: 'Search help topics' });

    fireEvent.change(search, { target: { value: 'no-such-help-topic' } });
    expect(screen.getByText('No results found. Try another keyword or clear your search.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'How do I register a new asset?' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear search' })[1]);
    expect(search).toHaveValue('');
    expect(screen.getAllByRole('button', { name: /^(How do I|What)/ })).toHaveLength(11);
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('expands and collapses FAQ answers with an accessible button state', () => {
    renderHelp();
    const question = screen.getByRole('button', { name: 'How do I register a new asset?' });
    const answerId = question.getAttribute('aria-controls');
    const answer = document.getElementById(answerId);

    expect(question).toHaveAttribute('aria-expanded', 'false');
    expect(answer).toHaveAttribute('hidden');
    fireEvent.click(question);
    expect(question).toHaveAttribute('aria-expanded', 'true');
    expect(answer).not.toHaveAttribute('hidden');
    expect(within(answer).getByRole('list')).toBeInTheDocument();
    fireEvent.click(question);
    expect(question).toHaveAttribute('aria-expanded', 'false');
    expect(answer).toHaveAttribute('hidden');
  });

  it('uses native keyboard-focusable FAQ controls', () => {
    renderHelp();
    const question = screen.getByRole('button', { name: 'How do I register a new asset?' });

    expect(question.tagName).toBe('BUTTON');
    expect(question).toHaveAttribute('type', 'button');
    expect(question).not.toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('searchbox', { name: 'Search help topics' }).tagName).toBe('INPUT');
  });

  it('does not display development demo accounts, credentials, or configuration instructions', () => {
    renderHelp();

    expect(screen.queryByText(/demo accounts|SEED_DEMO_PASSWORD|reset:demo-passwords|shared password/i)).not.toBeInTheDocument();
  });

  it('retains the Amharic page content and public links', () => {
    mockLanguage = 'am';
    renderHelp();

    expect(screen.getByRole('heading', { name: 'እገዛና ድጋፍ', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የእገዛ ርዕሶች', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /የይለፍ ቃል ረሳሁ/ })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: /ወደ መነሻ ገጽ/ })).toHaveAttribute('href', '/');
  });
});
