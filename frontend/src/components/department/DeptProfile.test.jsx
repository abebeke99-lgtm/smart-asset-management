import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import DeptProfile from './DeptProfile';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../contexts/UiContext', () => ({ useLanguage: jest.fn() }));

const profile = {
  id: 3,
  name: 'Engineering',
  code: 'ENGINEER',
  description: 'Auto-created department scope for Department Manager',
  headId: 10,
  phone: '',
  email: '',
  status: 'active',
  userCount: 5,
  assetCount: 5,
  college: { id: 1, collegeName: 'Engineering College' },
  head: { id: 10, fullName: 'Department Manager', username: 'department', email: 'department@example.test' },
  locationRecord: null,
  summary: { totalStaff: 5, totalAssets: 5 },
};

const successfulProfileResponse = (data = profile) => ({ data: { success: true, data } });

describe('Department Head profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 10, role: 'department_head', departmentId: 3, permissions: [] } });
    useLanguage.mockReturnValue({ language: 'en' });
    apiClient.get.mockResolvedValue(successfulProfileResponse());
  });

  it('loads and displays the authorized department details and database counts without edit permission', async () => {
    render(<DeptProfile />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading department profile');
    expect(await screen.findByRole('heading', { name: 'Department Profile' })).toBeInTheDocument();
    expect(await screen.findByText('Engineering College')).toBeInTheDocument();
    expect(screen.getByText('3', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('Engineering', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('ENGINEER')).toBeInTheDocument();
    expect(screen.getByText('Engineering College')).toBeInTheDocument();
    expect(screen.getByText('Department Manager')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Total Staff').parentElement).toHaveTextContent('5');
    expect(screen.getByText('Total Assets').parentElement).toHaveTextContent('5');
    expect(screen.getAllByText('Not provided')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Edit Profile' })).not.toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/profile');
  });

  it('shows a loading state until the profile request resolves', async () => {
    let resolveRequest;
    apiClient.get.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));

    render(<DeptProfile />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading department profile');

    resolveRequest(successfulProfileResponse());
    expect(await screen.findByText('Engineering College')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('deduplicates the profile request under React Strict Mode effect replay', async () => {
    render(<React.StrictMode><DeptProfile /></React.StrictMode>);

    expect(await screen.findByText('Engineering College')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('does not refetch profile data when the language changes', async () => {
    const { rerender } = render(<DeptProfile />);

    expect(await screen.findByText('Engineering College')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(1);

    useLanguage.mockReturnValue({ language: 'am' });
    rerender(<DeptProfile />);

    expect(screen.getByRole('heading', { name: 'የዲፓርትመንት መገለጫ' })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('maps authorization errors to an error state and retries the same scoped request', async () => {
    apiClient.get
      .mockRejectedValueOnce({ response: { status: 403 } })
      .mockResolvedValueOnce(successfulProfileResponse());

    render(<DeptProfile />);
    expect(await screen.findByRole('alert')).toHaveTextContent('You are not authorized to view this department.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Engineering College')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/department-head/profile');
  });

  it('does not request or display another department when the authenticated account has no configured scope', async () => {
    useAuth.mockReturnValue({ user: { id: 10, role: 'department_head' } });

    render(<DeptProfile />);

    expect(await screen.findByRole('alert')).toHaveTextContent('You are not authorized to view this department.');
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
  });

  it('displays a not-found response rather than stale profile data for an out-of-scope department', async () => {
    apiClient.get.mockRejectedValue({ response: { status: 404 } });

    render(<DeptProfile />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Department profile not found.');
    expect(screen.queryByText('Engineering College')).not.toBeInTheDocument();
  });

  it('shows localized authentication, validation, and server failures', async () => {
    useLanguage.mockReturnValue({ language: 'am' });
    apiClient.get.mockRejectedValue({ response: { status: 401 } });

    const { rerender } = render(<DeptProfile />);
    expect(await screen.findByRole('alert')).toHaveTextContent('ማረጋገጫ ያስፈልጋል። እንደገና ይግቡ።');

    apiClient.get.mockRejectedValue({ response: { status: 500 } });
    rerender(<DeptProfile key="server-error" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('የዲፓርትመንት መገለጫን መጫን አልተቻለም።');
  });

  it('renders a distinct empty state when the service has no profile payload', async () => {
    apiClient.get.mockResolvedValue({ data: { success: true, data: null } });

    render(<DeptProfile />);

    expect(await screen.findByText('Department profile information is not available.')).toHaveAttribute('role', 'status');
  });

  it('allows editing only when the department head has the update permission', async () => {
    useAuth.mockReturnValue({ user: { id: 10, role: 'department_head', departmentId: 3, permissions: ['department.profile.update'] } });

    render(<DeptProfile />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }));
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument());
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  it('saves through the department-head endpoint and reloads the persisted profile', async () => {
    useAuth.mockReturnValue({ user: { id: 10, role: 'department_head', departmentId: 3, permissions: ['department.profile.update'] } });
    apiClient.get
      .mockResolvedValueOnce(successfulProfileResponse())
      .mockResolvedValueOnce(successfulProfileResponse({ ...profile, email: 'engineering@example.test' }));
    apiClient.put.mockResolvedValue({ data: { success: true } });

    render(<DeptProfile />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'engineering@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Department profile updated successfully.')).toBeInTheDocument();
    expect(apiClient.put).toHaveBeenCalledWith('/department-head/profile', expect.objectContaining({
      email: 'engineering@example.test',
    }));
    expect(Object.keys(apiClient.put.mock.calls[0][1]).sort()).toEqual(['description', 'email', 'office', 'phone']);
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(screen.getByText('engineering@example.test')).toBeInTheDocument();
  });

  it('shows a localized save validation error and leaves the editable profile open', async () => {
    useAuth.mockReturnValue({ user: { id: 10, role: 'department_head', departmentId: 3, permissions: ['department.profile.update'] } });
    useLanguage.mockReturnValue({ language: 'am' });
    apiClient.put.mockRejectedValue({ response: { status: 422, data: { message: 'Department email is invalid.' } } });

    render(<DeptProfile />);
    fireEvent.click(await screen.findByRole('button', { name: 'መገለጫ አርትዕ' }));
    fireEvent.change(screen.getByLabelText('ኢሜይል'), { target: { value: 'valid@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'ለውጦችን አስቀምጥ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('እባክዎ የተጠቆሙትን መስኮች ያስተካክሉ።');
    expect(screen.getByLabelText('ኢሜይል')).toBeInTheDocument();
    expect(screen.queryByText('Department email is invalid.')).not.toBeInTheDocument();
  });

  it('uses the Amharic catalog for profile fields and status', async () => {
    useLanguage.mockReturnValue({ language: 'am' });

    render(<DeptProfile />);

    expect(await screen.findByRole('heading', { name: 'የዲፓርትመንት መገለጫ' })).toBeInTheDocument();
    expect(await screen.findByText('ENGINEER')).toBeInTheDocument();
    expect(await screen.findByText('ኮሌጅ')).toBeInTheDocument();
    expect(screen.getByText('የዲፓርትመንት መለያ')).toBeInTheDocument();
    expect(screen.getByText('ኮሌጅ')).toBeInTheDocument();
    expect(screen.getAllByText('ንቁ')).toHaveLength(2);
    expect(screen.getAllByText('አልተገለጸም')).toHaveLength(4);
  });
});
