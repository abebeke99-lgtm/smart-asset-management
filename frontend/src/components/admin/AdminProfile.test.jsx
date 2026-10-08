import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminProfile from './AdminProfile';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockedNavigate,
}));

describe('AdminProfile', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: {
        fullName: 'Admin User',
        username: 'admin',
        email: 'admin@example.test',
        role: 'admin',
        department: 'Administration',
      },
    });
    mockedNavigate.mockClear();
  });

  it('displays the signed-in user profile fields', () => {
    render(<MemoryRouter><AdminProfile /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'My Profile' })).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('admin@example.test')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('returns to the previous page when Back is selected', () => {
    render(<MemoryRouter><AdminProfile /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(mockedNavigate).toHaveBeenCalledWith(-1);
  });
});
