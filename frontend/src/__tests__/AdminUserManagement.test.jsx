import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Users from '../components/admin/AdminUserManagement';
import apiClient from '../services/apiClient';

jest.mock('../services/apiClient', () => ({
  __esModule: true,
  default: { request: jest.fn() },
  getApiErrorMessage: (error, fallback) => fallback,
}));

const roleNames = [
  'admin',
  'ict_officer',
  'college',
  'college_manager',
  'department_head',
  'finance',
  'store_manager',
  'maintenance',
  'infrastructure',
  'staff',
  'student',
];

let usersResponse = [];

const respondToApiRequests = () => {
  apiClient.request.mockImplementation(({ url, method, data }) => {
    if (method === 'POST' && url === '/api/users') {
      usersResponse = [...usersResponse, { id: 77, ...data, active: data.status === 'active' }];
      return Promise.resolve({ data: { success: true, data: { id: 77, ...data } } });
    }
    if (method === 'POST') return Promise.resolve({ data: { success: true } });
    if (url.endsWith('/activity')) return Promise.resolve({ data: { logs: [{ id: 7, action: 'CREATE_USER', entity: 'user:7', userId: 1, createdAt: '2026-10-02T12:00:00.000Z' }] } });
    if (url.startsWith('/api/users?')) return Promise.resolve({ data: { users: usersResponse, pagination: { total: usersResponse.length, pages: 1 } } });
    if (url === '/api/users/stats') return Promise.resolve({ data: { data: { total: usersResponse.length, active: usersResponse.length, inactive: 0, suspended: 0 } } });
    if (url === '/api/roles') return Promise.resolve({ data: { roles: roleNames.map((name) => ({ name, displayName: name })) } });
    if (/^\/api\/colleges\/\d+\/departments$/.test(url)) return Promise.resolve({ data: { departments: [{ id: 8, name: 'Computer Science' }] } });
    if (url.startsWith('/api/colleges')) return Promise.resolve({ data: { colleges: [{ id: 3, collegeName: 'College of Engineering' }] } });
    return Promise.resolve({ data: { departments: [] } });
  });
};

const openCreateForm = async () => {
  render(<Users />);
  fireEvent.click(await screen.findByRole('button', { name: /add user/i }));
  await screen.findByLabelText('Password *');
  await screen.findAllByRole('option', { name: 'staff' });
};

const fillValidNewUser = () => {
  fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'New User' } });
  fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'new.user' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new.user@example.edu' } });
  fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'staff' } });
  fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'ManageMe#42' } });
  fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'ManageMe#42' } });
};

beforeEach(() => {
  apiClient.request.mockReset();
  usersResponse = [];
  respondToApiRequests();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('shows required passwords, exact role options, and independent visibility controls', async () => {
  await openCreateForm();

  const roleSelect = document.querySelector('[name="roleId"]');
  expect(Array.from(roleSelect.options).slice(1).map((option) => option.value)).toEqual(roleNames);

  const password = screen.getByLabelText('Password *');
  const confirmPassword = screen.getByLabelText('Confirm Password *');
  expect(password).toBeRequired();
  expect(confirmPassword).toBeRequired();
  expect(password).toHaveAttribute('type', 'password');
  expect(confirmPassword).toHaveAttribute('type', 'password');

  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(password).toHaveAttribute('type', 'text');
  expect(confirmPassword).toHaveAttribute('type', 'password');

  fireEvent.click(screen.getByRole('button', { name: 'Show confirm password' }));
  expect(confirmPassword).toHaveAttribute('type', 'text');
});

test('rejects mismatched passwords without submitting', async () => {
  await openCreateForm();
  fireEvent.change(document.querySelector('[name="name"]'), { target: { value: 'New User' } });
  fireEvent.change(document.querySelector('[name="username"]'), { target: { value: 'new.user' } });
  fireEvent.change(document.querySelector('[name="email"]'), { target: { value: 'new.user@example.edu' } });
  fireEvent.change(document.querySelector('[name="roleId"]'), { target: { value: 'staff' } });
  fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'ManageMe#42' } });
  fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'Different#42' } });

  fireEvent.submit(document.querySelector('form'));

  expect(await screen.findByText('Password and Confirm Password must match.')).toBeInTheDocument();
  expect(apiClient.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
});

test('validates required fields, email format, and password policy before submitting', async () => {
  await openCreateForm();
  fireEvent.submit(document.querySelector('form'));
  expect(await screen.findByText('Full name is required.')).toBeInTheDocument();
  expect(screen.getByText('Username is required.')).toBeInTheDocument();
  expect(screen.getByText('Role is required.')).toBeInTheDocument();
  expect(apiClient.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));

  fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'New User' } });
  fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'new.user' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invalid-email' } });
  fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'staff' } });
  fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'weakpass' } });
  fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'weakpass' } });
  fireEvent.submit(document.querySelector('form'));

  expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
  expect(screen.getByText('Password must contain an uppercase letter.')).toBeInTheDocument();
  expect(apiClient.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
});

test('submits the add-user form, closes it, and refreshes the visible user list', async () => {
  await openCreateForm();
  fillValidNewUser();
  fireEvent.change(screen.getByLabelText('College'), { target: { value: '3' } });
  await screen.findByRole('option', { name: 'Computer Science' });
  fireEvent.change(screen.getByLabelText('Department'), { target: { value: '8' } });

  fireEvent.submit(document.querySelector('form'));

  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users',
    method: 'POST',
    data: expect.objectContaining({
      username: 'new.user',
      email: 'new.user@example.edu',
      role: 'staff',
      collegeId: '3',
      departmentId: '8',
      password: 'ManageMe#42',
    }),
  })));

  const createRequest = apiClient.request.mock.calls.find(([request]) => request.method === 'POST')[0];
  expect(createRequest.data.confirmPassword).toBe('ManageMe#42');
  await waitFor(() => expect(screen.queryByLabelText('Password *')).not.toBeInTheDocument());
  expect(await screen.findByText('new.user@example.edu')).toBeInTheDocument();
});

test('prevents duplicate add-user submissions while the create request is pending', async () => {
  await openCreateForm();
  fillValidNewUser();
  let finishCreate;
  apiClient.request.mockImplementation(({ url, method }) => {
    if (method === 'POST' && url === '/api/users') {
      return new Promise((resolve) => { finishCreate = () => resolve({ data: { success: true } }); });
    }
    if (url.startsWith('/api/users?')) return Promise.resolve({ data: { users: usersResponse, pagination: { total: usersResponse.length, pages: 1 } } });
    if (url === '/api/users/stats') return Promise.resolve({ data: { data: { total: usersResponse.length, active: usersResponse.length, inactive: 0, suspended: 0 } } });
    if (url === '/api/roles') return Promise.resolve({ data: { roles: roleNames.map((name) => ({ name, displayName: name })) } });
    if (url === '/api/colleges') return Promise.resolve({ data: { colleges: [] } });
    return Promise.resolve({ data: { departments: [] } });
  });

  const form = document.querySelector('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(apiClient.request.mock.calls.filter(([request]) => request.method === 'POST' && request.url === '/api/users')).toHaveLength(1);

  await waitFor(() => expect(finishCreate).toBeDefined());
  finishCreate();
  await waitFor(() => expect(screen.queryByLabelText('Password *')).not.toBeInTheDocument());
});

test('keeps reset-password and activity workflows connected to their existing endpoints', async () => {
  usersResponse = [{ id: 17, fullName: 'Existing User', email: 'existing@example.edu', role: 'staff', active: true }];
  render(<Users />);

  fireEvent.click(await screen.findByRole('button', { name: 'Reset password for Existing User' }));
  fireEvent.change(screen.getByLabelText('Temporary Password *'), { target: { value: 'ChangeMe#42' } });
  fireEvent.change(screen.getByLabelText('Confirm Temporary Password *'), { target: { value: 'ChangeMe#42' } });
  fireEvent.submit(document.querySelector('form'));

  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users/17/reset-password',
    method: 'POST',
    data: { password: 'ChangeMe#42', confirmPassword: 'ChangeMe#42' },
  })));
  await waitFor(() => expect(screen.queryByLabelText('Temporary Password *')).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'View activity for Existing User' }));
  expect(await screen.findByText('CREATE_USER')).toBeInTheDocument();
  expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users/17/activity',
    method: 'GET',
  }));
});

test('shows the underlying error when a user-management request fails without an HTTP response', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  apiClient.request.mockRejectedValueOnce(new Error('Connection was refused'));
  render(<Users />);

  expect(await screen.findByText('Connection was refused')).toBeInTheDocument();
  expect(errorLog).toHaveBeenCalledWith('User management API request failed', expect.objectContaining({
    status: 0,
    code: '',
  }));
});
