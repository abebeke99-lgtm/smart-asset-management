import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import CollegeSelfRegistration from './CollegeSelfRegistration';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const validForm = {
  'College name': 'College of Natural Sciences',
  'College code': 'CNS-01',
  'Official college email': 'science@example.edu',
  'Contact phone number': '+251 11 123 4567',
  'Office location': 'Main campus Building A',
  'Full name': 'Authorized Representative',
  Username: 'science.manager',
  'Email address': 'manager@example.edu',
  'Representative phone': '+251 91 234 5678',
  Password: 'ManagerPass123',
  'Confirm password': 'ManagerPass123',
};

const renderForm = async () => {
  const view = render(
    <MemoryRouter>
      <CollegeSelfRegistration />
    </MemoryRouter>
  );
  await screen.findByRole('option', { name: 'Main Campus' });
  return view;
};

const fillForm = () => {
  Object.entries(validForm).forEach(([label, value]) => {
    const selectors = {
      'Representative phone': /^Phone number/i,
      Password: /^Password/i,
      'Confirm password': /^Confirm password/i,
    };
    const input = screen.getByLabelText(selectors[label] || new RegExp(label, 'i'));
    fireEvent.change(input, { target: { value } });
  });
};

describe('College self-registration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiClient.get.mockReset();
    apiClient.post.mockReset();
    apiClient.get.mockImplementation((url) => {
      if (url === '/api/college-registration/campuses') {
        return Promise.resolve({ data: { campuses: [{ id: 2, campusName: 'Main Campus' }] } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
  });

  it('validates required fields and password confirmation before submitting', async () => {
    await renderForm();
    fireEvent.click(await screen.findByRole('button', { name: 'Submit for approval' }));

    expect(await screen.findByText('Enter the college name.')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('submits permitted college and representative data and displays pending status', async () => {
    apiClient.post.mockResolvedValue({
      data: {
        success: true,
        application: { id: 42, collegeName: validForm['College name'], status: 'pending', submittedAt: '2026-10-13T00:00:00Z' },
        statusToken: 'a'.repeat(64),
      },
    });
    apiClient.get.mockImplementation((url, options) => {
      if (url === '/api/college-registration/campuses') return Promise.resolve({ data: { campuses: [{ id: 2, campusName: 'Main Campus' }] } });
      if (url === '/api/college-registration/status/42') {
        expect(options.headers['X-Application-Status-Token']).toBe('a'.repeat(64));
        return Promise.resolve({ data: { application: { id: 42, collegeName: validForm['College name'], status: 'pending', submittedAt: '2026-10-13T00:00:00Z' } } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    await renderForm();
    fillForm();
    fireEvent.change(screen.getByLabelText(/Campus/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    const [url, payload] = apiClient.post.mock.calls[0];
    expect(url).toBe('/api/college-registration');
    expect(payload).toMatchObject({
      collegeCode: 'CNS-01',
      campusId: '2',
      representativeUsername: 'science.manager',
      representativeEmail: 'manager@example.edu',
      confirmPassword: validForm['Confirm password'],
    });
    expect(payload).not.toHaveProperty('role');
    expect(payload).not.toHaveProperty('collegeId');
    expect(payload).not.toHaveProperty('assets');
    expect(await screen.findByText('pending')).toBeInTheDocument();
    expect(sessionStorage.getItem('college-registration-status-id')).toBe('42');
    expect(sessionStorage.getItem('college-registration-status-token')).toBe('a'.repeat(64));
  });

  it('shows duplicate-registration feedback returned by the backend', async () => {
    apiClient.post.mockRejectedValue({
      response: { data: { message: 'A college with this code is already registered.' } },
    });
    await renderForm();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));

    expect(await screen.findByText('A college with this code is already registered.')).toBeInTheDocument();
  });
});
