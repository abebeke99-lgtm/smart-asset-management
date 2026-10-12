import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  'technical_assistant',
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
    if (url.startsWith('/api/users?')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const page = Number(params.get('page')) || 1;
      const limit = Number(params.get('limit')) || 10;
      const start = (page - 1) * limit;
      return Promise.resolve({ data: {
        users: usersResponse.slice(start, start + limit),
        pagination: { page, limit, total: usersResponse.length, pages: Math.ceil(usersResponse.length / limit) },
      } });
    }
    if (url === '/api/users/stats') {
      const countByStatus = (status) => usersResponse.filter((user) => (
        String(user.status || (user.active === false ? 'inactive' : 'active')).toLowerCase() === status
      )).length;
      return Promise.resolve({ data: { data: {
        total: usersResponse.length,
        active: countByStatus('active'),
        inactive: countByStatus('inactive'),
        suspended: countByStatus('suspended'),
      } } });
    }
    if (url === '/api/users/store-manager-accounts') {
      const storeManagerUsers = usersResponse.filter((user) => user.role === 'store_manager');
      return Promise.resolve({ data: { data: { count: storeManagerUsers.length, limit: 8, users: storeManagerUsers } } });
    }
    if (url === '/api/roles') return Promise.resolve({ data: { roles: roleNames.map((name) => ({
      name,
      displayName: ({ staff: 'Staff', student: 'Student', technical_assistant: 'Technical Assistant', maintenance: 'Maintenance' })[name] || name,
    })) } });
    if (/^\/api\/colleges\/\d+\/departments$/.test(url)) return Promise.resolve({ data: { departments: [{ id: 8, name: 'Computer Science' }] } });
    if (url.startsWith('/api/colleges')) return Promise.resolve({ data: { colleges: [{ id: 3, collegeName: 'College of Engineering' }] } });
    return Promise.resolve({ data: { departments: [] } });
  });
};

const openCreateForm = async () => {
  render(<Users />);
  fireEvent.click(await screen.findByRole('button', { name: /add user/i }));
  await screen.findByLabelText('Password *');
  await screen.findAllByRole('option', { name: 'ict_officer' });
};

const fillValidNewUser = () => {
  fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'New User' } });
  fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'new.user' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new.user@example.edu' } });
  fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'ict_officer' } });
  fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'ManageMe#42' } });
  fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'ManageMe#42' } });
};

beforeEach(() => {
  apiClient.request.mockReset();
  usersResponse = [];
  respondToApiRequests();
});

test('closes the add-user dialog with Escape', async () => {
  await openCreateForm();

  fireEvent.keyDown(window, { key: 'Escape' });

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('shows organization fields only when an existing account is being edited or its selected role requires scope', async () => {
  await openCreateForm();

  expect(screen.queryByLabelText('College')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Department')).not.toBeInTheDocument();
  const roleSelect = document.querySelector('[name="roleId"]');
  const visibleRoleNames = Array.from(roleSelect.options).slice(1).map((option) => option.value);
  expect(visibleRoleNames).toEqual(roleNames.filter((name) => !['staff', 'student', 'technical_assistant'].includes(name)));
  expect(visibleRoleNames).toContain('admin');
  expect(visibleRoleNames).toContain('ict_officer');
  expect(within(roleSelect).queryByRole('option', { name: 'Staff' })).not.toBeInTheDocument();
  expect(within(roleSelect).queryByRole('option', { name: 'Student' })).not.toBeInTheDocument();
  expect(within(roleSelect).queryByRole('option', { name: 'Technical Assistant' })).not.toBeInTheDocument();

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

test('assigns a Department Head to a selected college and department during account creation', async () => {
  await openCreateForm();
  fillValidNewUser();
  fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'department_head' } });

  fireEvent.change(await screen.findByLabelText('College'), { target: { value: '3' } });
  await screen.findByRole('option', { name: 'Computer Science' });
  fireEvent.change(await screen.findByLabelText('Department'), { target: { value: '8' } });
  fireEvent.submit(document.querySelector('form'));

  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users',
    method: 'POST',
    data: expect.objectContaining({
      role: 'department_head',
      collegeId: '3',
      departmentId: '8',
    }),
  })));
});

test('rejects mismatched passwords without submitting', async () => {
  await openCreateForm();
  fireEvent.change(document.querySelector('[name="name"]'), { target: { value: 'New User' } });
  fireEvent.change(document.querySelector('[name="username"]'), { target: { value: 'new.user' } });
  fireEvent.change(document.querySelector('[name="email"]'), { target: { value: 'new.user@example.edu' } });
  fireEvent.change(document.querySelector('[name="roleId"]'), { target: { value: 'ict_officer' } });
  fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'ManageMe#42' } });
  fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'Different#42' } });

  fireEvent.submit(document.querySelector('form'));

  expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
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
  fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'ict_officer' } });
  fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'weakpass' } });
  fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'weakpass' } });
  fireEvent.submit(document.querySelector('form'));

  expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
  expect(screen.getByText('Password must contain at least one letter and one number.')).toBeInTheDocument();
  expect(apiClient.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
});

test('submits the add-user form, closes it, and refreshes the visible user list', async () => {
  await openCreateForm();
  fillValidNewUser();

  fireEvent.submit(document.querySelector('form'));

  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users',
    method: 'POST',
    data: expect.objectContaining({
      username: 'new.user',
      email: 'new.user@example.edu',
      role: 'ict_officer',
      password: 'ManageMe#42',
    }),
  })));

  const createRequest = apiClient.request.mock.calls.find(([request]) => request.method === 'POST')[0];
  expect(createRequest.data.confirmPassword).toBe('ManageMe#42');
  expect(createRequest.data).not.toHaveProperty('collegeId');
  expect(createRequest.data).not.toHaveProperty('departmentId');
  await waitFor(() => expect(screen.queryByLabelText('Password *')).not.toBeInTheDocument());
  expect(await screen.findByText('new.user@example.edu')).toBeInTheDocument();
});

test('creates and displays a Maintenance user using the canonical role identifier', async () => {
  await openCreateForm();
  expect(within(screen.getByLabelText('Role *')).getByRole('option', { name: 'Maintenance' })).toHaveValue('maintenance');

  fillValidNewUser();
  fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'maintenance' } });
  fireEvent.submit(document.querySelector('form'));

  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users',
    method: 'POST',
    data: expect.objectContaining({ role: 'maintenance' }),
  })));

  const userEmail = await screen.findByText('new.user@example.edu');
  expect(within(userEmail.closest('tr')).getByText('Maintenance')).toBeInTheDocument();
});

test('updates an existing user to the canonical Maintenance role', async () => {
  usersResponse = [{
    id: 17,
    fullName: 'Existing User',
    username: 'existing.user',
    email: 'existing@example.edu',
    role: 'staff',
    active: true,
  }];
  render(<Users />);

  fireEvent.click(await screen.findByRole('button', { name: 'Edit Existing User' }));
  const roleSelect = await screen.findByLabelText('Role *');
  fireEvent.change(roleSelect, { target: { value: 'maintenance' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users/17',
    method: 'PUT',
    data: expect.objectContaining({ role: 'maintenance' }),
  })));
});

test('administrator Store Manager creation refreshes the account count from the existing API workflow', async () => {
  await openCreateForm();
  fillValidNewUser();
  fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'store_manager' } });
  fireEvent.submit(document.querySelector('form'));

  expect(await screen.findByText('1 of 8')).toBeInTheDocument();
  expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users',
    method: 'POST',
    data: expect.objectContaining({ role: 'store_manager' }),
  }));
  expect(await screen.findByText('new.user@example.edu')).toBeInTheDocument();
});

test('allows creating an inactive user and refreshes the user list and status counts', async () => {
  await openCreateForm();
  expect(within(screen.getByLabelText('Account Status')).getByRole('option', { name: 'Inactive' })).toBeInTheDocument();
  fillValidNewUser();
  fireEvent.change(screen.getByLabelText('Account Status'), { target: { value: 'Inactive' } });

  fireEvent.submit(document.querySelector('form'));

  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users',
    method: 'POST',
    data: expect.objectContaining({ role: 'ict_officer', status: 'inactive' }),
  })));
  expect(await screen.findByText('new.user@example.edu')).toBeInTheDocument();
  expect(screen.getByText('Inactive Users').parentElement).toHaveTextContent('1');
  expect(screen.getByText('Inactive', { selector: '.status-badge' })).toBeInTheDocument();
});

test('shows the newly created account on its page when the user list is paginated', async () => {
  usersResponse = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    fullName: `Existing User ${index + 1}`,
    username: `existing.user.${index + 1}`,
    role: 'staff',
    status: 'active',
  }));
  await openCreateForm();
  fillValidNewUser();

  fireEvent.submit(document.querySelector('form'));

  expect(await screen.findByText('new.user@example.edu')).toBeInTheDocument();
  expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users?page=2&limit=10',
  }));
});

test('shows the Store Manager account count and prevents an administrator from exceeding the limit in the form', async () => {
  usersResponse = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    role: 'store_manager',
    username: `store.manager.${index + 1}`,
    fullName: `Store Manager ${index + 1}`,
    status: 'active',
  }));
  await openCreateForm();

  expect(screen.getByText('8 of 8')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'store_manager' } });

  expect(screen.getByRole('alert')).toHaveTextContent('maximum of 8 Store Manager accounts');
  expect(screen.getByRole('button', { name: /create user/i })).toBeDisabled();
  expect(apiClient.request).not.toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users',
    method: 'POST',
  }));
});

test('keeps college, department, and existing roles available when editing a user', async () => {
  usersResponse = [{
    id: 17,
    fullName: 'Existing User',
    username: 'existing.user',
    email: 'existing@example.edu',
    role: 'staff',
    collegeId: 3,
    departmentId: 8,
    active: true,
  }];
  render(<Users />);

  fireEvent.click(await screen.findByRole('button', { name: 'Edit Existing User' }));

  expect(await screen.findByLabelText('College')).toHaveValue('3');
  await screen.findByRole('option', { name: 'Computer Science' });
  expect(screen.getByLabelText('Department')).toHaveValue('8');
  expect(Array.from(document.querySelector('[name="roleId"]').options).map((option) => option.value)).toContain('staff');

  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/users/17',
    method: 'PUT',
    data: expect.objectContaining({ collegeId: 3, departmentId: 8, role: 'staff' }),
  })));
});

test('keeps the add-user form open and shows the API error when user creation is rejected', async () => {
  await openCreateForm();
  fillValidNewUser();
  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+251 911 234 567' } });
  fireEvent.change(screen.getByLabelText('Account Status'), { target: { value: 'Suspended' } });
  apiClient.request.mockImplementation(({ url, method }) => {
    if (method === 'POST' && url === '/api/users') {
      return Promise.resolve({
        data: { success: false, message: 'Username or email is already in use' },
      });
    }
    if (url.startsWith('/api/users?')) return Promise.resolve({ data: { users: usersResponse, pagination: { total: usersResponse.length, pages: 1 } } });
    if (url === '/api/users/stats') return Promise.resolve({ data: { data: { total: usersResponse.length, active: usersResponse.length, inactive: 0, suspended: 0 } } });
    if (url === '/api/roles') return Promise.resolve({ data: { roles: roleNames.map((name) => ({ name, displayName: name })) } });
    if (url === '/api/colleges') return Promise.resolve({ data: { colleges: [{ id: 3, collegeName: 'College of Engineering' }] } });
    if (url.endsWith('/departments')) return Promise.resolve({ data: { departments: [{ id: 8, name: 'Computer Science' }] } });
    return Promise.resolve({ data: { departments: [] } });
  });

  fireEvent.submit(document.querySelector('form'));

  expect(await screen.findByRole('alert')).toHaveTextContent('Username or email is already in use');
  expect(screen.getByLabelText(/Full Name/)).toHaveValue('New User');
  expect(screen.getByLabelText('Username *')).toHaveValue('new.user');
  expect(screen.getByLabelText('Email')).toHaveValue('new.user@example.edu');
  expect(screen.getByLabelText('Phone')).toHaveValue('+251 911 234 567');
  expect(screen.getByLabelText('Role *')).toHaveValue('ict_officer');
  expect(screen.queryByLabelText('College')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Department')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Account Status')).toHaveValue('Suspended');
  expect(screen.getByLabelText('Password *')).toHaveValue('');
  expect(screen.getByLabelText('Confirm Password *')).toHaveValue('');
  expect(apiClient.request.mock.calls.filter(([request]) => request.method === 'POST' && request.url === '/api/users')).toHaveLength(1);
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
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();

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
