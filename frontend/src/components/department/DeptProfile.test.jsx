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

const recentActivities = [
  { id: 'approval-1', user: 'Alex User', action: 'Approval submission', entity: 'Laptop request', status: 'Pending', date: '2026-10-06T10:00:00.000Z' },
  { id: 'assignment-2', user: 'Sam User', action: 'Asset assignment', entity: 'Workstation', status: 'Active', date: '2026-10-05T10:00:00.000Z' },
];
const successfulProfileResponse = (data = profile) => ({ data: { success: true, data } });
const successfulActivityResponse = (data = recentActivities) => ({ data: { success: true, data } });
const successfulLocationsResponse = (data) => ({
  data: { success: true, data, pagination: { pages: 1 } },
});
const setProfileResponse = (response) => apiClient.get.mockImplementation((url) => (
  url === '/department-head/dashboard/recent-activities'
    ? Promise.resolve(successfulActivityResponse())
    : Promise.resolve(response)
));

describe('Department Head profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: 10, role: 'department_head', departmentId: 3, permissions: ['department.profile.update'] },
      hasPermission: (permission) => permission === 'department.profile.update',
    });
    useLanguage.mockReturnValue({ language: 'en' });
    setProfileResponse(successfulProfileResponse());
  });

  it('loads and displays the authorized department details and database counts', async () => {
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
    expect(screen.getByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/profile');
  });

  it('renders all ten profile fields, including the linked head and editable contact details', async () => {
    setProfileResponse(successfulProfileResponse({
      ...profile,
      description: 'Provides computing services.',
      phone: '+1 555 123 4567',
      email: 'it@example.test',
      office: 'Room 204',
      status: 'inactive',
    }));

    render(<DeptProfile />);

    expect(await screen.findByText('3', { selector: 'dd' })).toBeInTheDocument();
    for (const field of ['Department ID', 'Department Name', 'Department Code', 'College', 'Department Head', 'Contact', 'Email', 'Office', 'Description', 'Status']) {
      expect(screen.getByText(field)).toBeInTheDocument();
    }
    expect(screen.getByText('+1 555 123 4567')).toBeInTheDocument();
    expect(screen.getByText('it@example.test')).toBeInTheDocument();
    expect(screen.getByText('Room 204')).toBeInTheDocument();
    expect(screen.getByText('Provides computing services.')).toBeInTheDocument();
    expect(screen.getAllByText('Inactive')).toHaveLength(2);
  });

  it('shows the five newest activities returned by the scoped dashboard endpoint', async () => {
    const activityRows = Array.from({ length: 6 }, (_, index) => ({
      id: `activity-${index}`,
      user: `User ${index}`,
      action: `Action ${index}`,
      entity: `Asset ${index}`,
      status: 'Active',
      date: `2026-10-0${index + 1}T10:00:00.000Z`,
    }));
    apiClient.get.mockImplementation((url) => (
      url === '/department-head/dashboard/recent-activities'
        ? Promise.resolve(successfulActivityResponse(activityRows))
        : Promise.resolve(successfulProfileResponse())
    ));

    render(<DeptProfile />);

    expect(await screen.findByRole('heading', { name: 'Recent Department Activity' })).toBeInTheDocument();
    expect(await screen.findByText('Action 0')).toBeInTheDocument();
    expect(screen.getByText('Action 4')).toBeInTheDocument();
    expect(screen.queryByText('Action 5')).not.toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/dashboard/recent-activities');
    expect(apiClient.get.mock.calls.find(([url]) => url === '/department-head/dashboard/recent-activities')[1]).toBeUndefined();
  });

  it('retries recent activity independently when its request fails', async () => {
    let activityAttempts = 0;
    apiClient.get.mockImplementation((url) => {
      if (url === '/department-head/dashboard/recent-activities') {
        activityAttempts += 1;
        return activityAttempts === 1
          ? Promise.reject({ response: { status: 500 } })
          : Promise.resolve(successfulActivityResponse());
      }
      return Promise.resolve(successfulProfileResponse());
    });

    render(<DeptProfile />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load recent activity.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Approval submission')).toBeInTheDocument();
    expect(activityAttempts).toBe(2);
  });

  it('does not invent a department head name when the department has no linked head record', async () => {
    setProfileResponse(successfulProfileResponse({ ...profile, head: null }));

    render(<DeptProfile />);

    expect(await screen.findByText('Department Head')).toBeInTheDocument();
    expect(screen.getByText('Department Head').parentElement).toHaveTextContent('Not provided');
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
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/department-head/profile')).toHaveLength(1);
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/department-head/dashboard/recent-activities')).toHaveLength(1);
  });

  it('does not refetch profile data when the language changes', async () => {
    const { rerender } = render(<DeptProfile />);

    expect(await screen.findByText('Engineering College')).toBeInTheDocument();
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/department-head/profile')).toHaveLength(1);
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/department-head/dashboard/recent-activities')).toHaveLength(1);

    useLanguage.mockReturnValue({ language: 'am' });
    rerender(<DeptProfile />);

    expect(screen.getByRole('heading', { name: 'የመምሪያ መገለጫ' })).toBeInTheDocument();
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/department-head/profile')).toHaveLength(1);
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/department-head/dashboard/recent-activities')).toHaveLength(1);
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/department-head/locations')).toHaveLength(1);
  });

  it('maps authorization errors to an error state and retries the same scoped request', async () => {
    let profileAttempts = 0;
    apiClient.get.mockImplementation((url) => {
      if (url === '/department-head/dashboard/recent-activities') return Promise.resolve(successfulActivityResponse());
      if (url === '/department-head/locations') return Promise.resolve(successfulLocationsResponse([]));
      if (url !== '/department-head/profile') return Promise.resolve({ data: { success: true, data: [] } });
      profileAttempts += 1;
      return profileAttempts === 1
        ? Promise.reject({ response: { status: 403 } })
        : Promise.resolve(successfulProfileResponse());
    });

    render(<DeptProfile />);
    expect(await screen.findByRole('alert')).toHaveTextContent('You are not authorized to view this department.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Engineering College')).toBeInTheDocument();
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/department-head/profile')).toHaveLength(2);
    expect(profileAttempts).toBe(2);
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/profile');
  });

  it('lets the API report a missing authenticated department assignment', async () => {
    useAuth.mockReturnValue({ user: { id: 10, role: 'department_head' } });
    apiClient.get.mockRejectedValue({ response: { status: 404 } });

    render(<DeptProfile />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Department profile not found.');
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/profile');
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

  it('renders a not-found state when the service has no profile payload', async () => {
    setProfileResponse({ data: { success: true, data: null } });

    render(<DeptProfile />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Department profile not found.');
  });

  it('allows profile editing only when the department head has the update permission', async () => {
    useAuth.mockReturnValue({
      user: { id: 10, role: 'department_head', departmentId: 3, permissions: ['department.profile.update'] },
      hasPermission: (permission) => permission === 'department.profile.update',
    });

    render(<DeptProfile />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }));
    expect(screen.getByLabelText('Contact')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Office')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.queryByLabelText('Department ID')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Department Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Department Code')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('College')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Department Head')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument());
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  it('does not render the edit action without the profile update permission', async () => {
    useAuth.mockReturnValue({
      user: { id: 10, role: 'department_head', departmentId: 3, permissions: [] },
      hasPermission: () => false,
    });

    render(<DeptProfile />);

    expect(await screen.findByText('Engineering College')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Profile' })).not.toBeInTheDocument();
  });

  it('saves only editable fields through the department-head endpoint and displays its updated profile', async () => {
    useAuth.mockReturnValue({
      user: { id: 10, role: 'department_head', departmentId: 3, permissions: ['department.profile.view', 'department.profile.update'] },
      hasPermission: (permission) => ['department.profile.view', 'department.profile.update'].includes(permission),
    });
    apiClient.put.mockResolvedValue({ data: { success: true, data: { ...profile, email: 'engineering@example.test' } } });

    render(<DeptProfile />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }));
    expect(screen.getByText('Department ID')).toBeInTheDocument();
    expect(screen.queryByLabelText('Department ID')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'engineering@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Department profile updated successfully.')).toBeInTheDocument();
    expect(apiClient.put).toHaveBeenCalledWith('/department-head/profile', expect.objectContaining({
      email: 'engineering@example.test',
    }));
    expect(apiClient.put.mock.calls[0][1]).toEqual({ email: 'engineering@example.test' });
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/department-head/profile')).toHaveLength(1);
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/department-head/dashboard/recent-activities')).toHaveLength(1);
    expect(screen.getByText('engineering@example.test')).toBeInTheDocument();
  });

  it('offers only the authorized department office location and saves the selected value', async () => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/department-head/locations') {
        return Promise.resolve(successfulLocationsResponse([
          { id: 12, name: 'North Office', status: 'active', recordType: 'department_location' },
          { id: 25, name: 'Lab 25', status: 'active', recordType: 'room' },
        ]));
      }
      if (url === '/department-head/dashboard/recent-activities') {
        return Promise.resolve(successfulActivityResponse());
      }
      return Promise.resolve(successfulProfileResponse());
    });
    apiClient.put.mockResolvedValue({ data: { success: true, data: { ...profile, office: 'North Office' } } });

    render(<DeptProfile />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }));

    const officeSelect = await screen.findByLabelText('Office');
    expect(screen.getByRole('option', { name: 'North Office' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Lab 25' })).not.toBeInTheDocument();
    fireEvent.change(officeSelect, { target: { value: 'North Office' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/department-head/profile', { office: 'North Office' }));
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/locations', { params: { page: 1, limit: 100 } });
  });

  it('allows retrying the authorized office-location list when it fails', async () => {
    let locationAttempts = 0;
    apiClient.get.mockImplementation((url) => {
      if (url === '/department-head/locations') {
        locationAttempts += 1;
        return locationAttempts === 1
          ? Promise.reject({ response: { status: 500 } })
          : Promise.resolve(successfulLocationsResponse([
            { id: 12, name: 'North Office', status: 'active', recordType: 'department_location' },
          ]));
      }
      if (url === '/department-head/dashboard/recent-activities') {
        return Promise.resolve(successfulActivityResponse());
      }
      return Promise.resolve(successfulProfileResponse());
    });

    render(<DeptProfile />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }));

    expect(await screen.findByText('Unable to load authorized office locations.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('option', { name: 'North Office' })).toBeInTheDocument();
    expect(locationAttempts).toBe(2);
  });

  it('shows field-level save validation errors and leaves the editable profile open', async () => {
    useAuth.mockReturnValue({
      user: { id: 10, role: 'department_head', departmentId: 3, permissions: ['department.profile.view', 'department.profile.update'] },
      hasPermission: (permission) => ['department.profile.view', 'department.profile.update'].includes(permission),
    });
    apiClient.put.mockRejectedValue({ response: { status: 422, data: { message: 'Please correct the department profile fields.', errors: { email: 'Enter a valid email address.' } } } });

    render(<DeptProfile />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'valid@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('uses the Amharic catalog for profile fields and status', async () => {
    useLanguage.mockReturnValue({ language: 'am' });

    render(<DeptProfile />);

    expect(await screen.findByRole('heading', { name: 'የመምሪያ መገለጫ' })).toBeInTheDocument();
    expect(screen.getByText('የመምሪያ መረጃ')).toBeInTheDocument();
    expect(screen.getByText('የመምሪያ ማጠቃለያ')).toBeInTheDocument();
    expect(await screen.findByText('ENGINEER')).toBeInTheDocument();
    expect(await screen.findByText('ኮሌጅ')).toBeInTheDocument();
    for (const label of ['የመምሪያ መለያ', 'የመምሪያ ስም', 'የመምሪያ ኮድ', 'የመምሪያ ኃላፊ', 'የመገኛ ስልክ', 'ኢሜይል', 'ቢሮ', 'መግለጫ', 'ሁኔታ']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('ንቁ')).toHaveLength(2);
    expect(screen.getAllByText('አልተገለጸም')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'መገለጫ አስተካክል' }));
    expect(screen.getByLabelText('የመገኛ ስልክ')).toBeInTheDocument();
    expect(screen.getByLabelText('ኢሜይል')).toBeInTheDocument();
    expect(screen.getByLabelText('ቢሮ')).toBeInTheDocument();
    expect(screen.getByLabelText('መግለጫ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ለውጦችን አስቀምጥ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ሰርዝ' })).toBeInTheDocument();
  });
});
