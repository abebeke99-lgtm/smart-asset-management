import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UIProvider, useLanguage } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';
import Register from './Register';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const LanguageControl = () => {
  const { setLanguage } = useLanguage();
  return <button type="button" onClick={() => setLanguage('am')}>Amharic</button>;
};

describe('Register page translations', () => {
  beforeEach(() => localStorage.clear());

  beforeEach(() => {
    apiClient.post.mockReset();
    apiClient.post.mockResolvedValue({ data: { success: true, user: { id: 5, role: 'student' } } });
  });

  it('updates the account registration page title and description when the language changes', () => {
    render(
      <MemoryRouter>
        <UIProvider>
          <Register />
          <LanguageControl />
        </UIProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByText(/Register as a student or staff member/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Amharic' }));

    expect(screen.getByRole('heading', { name: 'ይመዝገቡ' })).toBeInTheDocument();
    expect(screen.getByText(/እንደ ተማሪ ወይም ሰራተኛ/)).toBeInTheDocument();
  });

  it('creates public staff accounts through the restricted public registration API', async () => {
    render(<MemoryRouter><UIProvider><Register /></UIProvider></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'Example Staff' } });
    fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'example.staff' } });
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'example@example.edu' } });
    fireEvent.change(screen.getByLabelText('Account type *'), { target: { value: 'staff' } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'ValidPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'ValidPass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      username: 'example.staff',
      role: 'staff',
      email: 'example@example.edu',
    })));
    expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('collegeId');
    expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('departmentId');
    expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('confirmPassword');
    expect(await screen.findByRole('status')).toHaveTextContent('Account created. You can now sign in.');
  });
});
