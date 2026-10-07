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

  it('renders the university identity and each requested section once', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Mekdela Amba University' })).toBeInTheDocument();
    expect(screen.getByText('University Asset Management System')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Help & Support' })).toBeInTheDocument();
    expect(screen.getByText('Practical guidance for signing in and using the asset workflows available to your role.')).toBeInTheDocument();
    ['Quick Actions', 'Help Topics', 'Development Demo Accounts', 'Password Reset', 'Frequently Asked Questions', 'Roles and Access', 'Need More Help?'].forEach((title) => {
      expect(screen.getAllByRole('heading', { name: title })).toHaveLength(1);
    });
    expect(screen.queryByText('Official contact details have not been configured.')).not.toBeInTheDocument();
    expect(screen.queryByText('Public message submission is unavailable.')).not.toBeInTheDocument();
  });

  it('keeps all public action routes and contact/home links', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);

    expect(screen.getByRole('link', { name: /Login/ })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /Forgot Password/ })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: /Contact Support/ })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: /Open password recovery/ })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: /View Contact Information/ })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: /Back to Home/ })).toHaveAttribute('href', '/');
  });

  it('includes the specified workflows, FAQ guidance, and role descriptions', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);

    const workflow = screen.getByRole('heading', { name: 'Asset Workflows' }).closest('article');
    ['Asset assignment', 'Asset transfer', 'Asset verification', 'Maintenance requests', 'Asset returns', 'Asset disposal'].forEach((item) => {
      expect(within(workflow).getByText(item)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'How do I request a transfer?' })).toBeInTheDocument();
    expect(screen.getByText('Your dashboard and available actions depend on your assigned role.')).toBeInTheDocument();
    expect(screen.getByText('System administration and broad asset-management workflows according to assigned permissions.')).toBeInTheDocument();
  });

  it('documents local demo usernames and safe password reset guidance without exposing a password', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);

    const demoAccounts = screen.getByRole('heading', { name: 'Development Demo Accounts' }).parentElement;
    ['admin', 'ict_officer', 'college_manager', 'department_head', 'finance', 'store_manager', 'maintenance', 'infrastructure'].forEach((username) => {
      expect(within(demoAccounts).getByText(username)).toBeInTheDocument();
    });
    expect(within(demoAccounts).getByText(/SEED_DEMO_PASSWORD/)).toBeInTheDocument();
    expect(within(demoAccounts).getByText(/resets every listed demo account/i)).toBeInTheDocument();
  });

  it('expands and collapses FAQ answers', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);
    const question = screen.getByRole('button', { name: 'How do I register an asset?' });
    const answer = question.parentElement.querySelector('.help-faq-answer');

    expect(answer).not.toBeVisible();
    fireEvent.click(question);
    expect(answer).toBeVisible();
    fireEvent.click(question);
    expect(answer).not.toBeVisible();
  });

  it('retains the Amharic page content and public links', () => {
    mockLanguage = 'am';
    render(<MemoryRouter><Help /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'እገዛና ድጋፍ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'የእገዛ ርዕሶች' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /የይለፍ ቃል ረሳሁ/ })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: /ወደ መነሻ ገጽ/ })).toHaveAttribute('href', '/');
  });
});