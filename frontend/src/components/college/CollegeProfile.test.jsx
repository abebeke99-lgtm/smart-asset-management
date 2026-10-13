import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CollegeProfile from './CollegeProfile';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const profile = {
  id: 4,
  collegeName: 'Engineering College',
  description: 'Engineering',
  location: 'Main Campus',
  phone: '',
  email: 'engineering@example.test',
  status: 'active',
};

describe('CollegeProfile phone validation', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ hasPermission: () => true });
    api.get.mockResolvedValue({ data: { data: profile } });
    api.put.mockResolvedValue({ data: { data: profile } });
  });

  it('rejects malformed phone values before sending a profile update', async () => {
    render(<CollegeProfile />);
    await screen.findByRole('heading', { name: 'College Profile' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+++++++' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Enter a valid phone number with 7 to 15 digits.')).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('submits a valid international phone format to the profile API', async () => {
    render(<CollegeProfile />);
    await screen.findByRole('heading', { name: 'College Profile' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
    const phone = '+251 (911) 234-567';
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: phone } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/college/profile', {
      collegeName: profile.collegeName,
      description: profile.description,
      location: profile.location,
      phone,
      email: profile.email,
    }));
  });
});
