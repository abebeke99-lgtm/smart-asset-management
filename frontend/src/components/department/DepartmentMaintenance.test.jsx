import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import DepartmentMaintenance from './DepartmentMaintenance';

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-toastify', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('Department Head Service Requests route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 12, role: 'department_head', departmentId: 4 } });
    apiClient.get.mockResolvedValue({ data: { success: true, data: [], summary: { total: 0 } } });
    apiClient.post.mockResolvedValue({ data: { success: true, data: { requestCode: 'SR-2026-100001' }, notificationStatus: 'sent' } });
  });

  it.each(['/department-head/maintenance-requests', '/department-head/service-requests'])(
    'loads the service request workflow at %s',
    async (path) => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/department-head/*" element={<DepartmentMaintenance />} />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByRole('heading', { name: 'Service Requests' })).toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: 'No maintenance records found' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Request maintenance' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'New request' })).toBeInTheDocument();
      expect(document.querySelectorAll('.maintenance-empty > svg')).toHaveLength(0);
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/api/service-requests', {
          params: { limit: 100, status: undefined, priority: undefined, search: undefined },
        });
      });
      expect(apiClient.get).not.toHaveBeenCalledWith('/api/department/maintenance', expect.anything());
      expect(apiClient.get).not.toHaveBeenCalledWith('/api/department/assets', expect.anything());
    }
  );

  it('loads eligible roles and users, then submits the selected assignment', async () => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/api/service-requests/routing-options') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              categories: ['Facilities'],
              roles_by_category: {
                Facilities: [{ id: 14, name: 'infrastructure', displayName: 'Infrastructure / Facilities', description: 'Facilities work' }],
              },
            },
          },
        });
      }
      if (url === '/api/service-requests/eligible-assignees') {
        return Promise.resolve({ data: { success: true, data: [{ id: 55, name: 'Facilities Officer', role: 'infrastructure' }] } });
      }
      return Promise.resolve({ data: { success: true, data: [], summary: { total: 0 } } });
    });

    render(
      <MemoryRouter initialEntries={['/department-head/service-requests']}>
        <Routes>
          <Route path="/department-head/*" element={<DepartmentMaintenance />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'New request' }));
    expect(await screen.findByRole('option', { name: 'Infrastructure / Facilities — Facilities work' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('option', { name: 'Facilities Officer' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('textbox', { name: 'Request title' }), { target: { value: 'Repair the classroom projector' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Request details' }), { target: { value: 'The projector no longer powers on.' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Responsible user' }), { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/service-requests', expect.objectContaining({
      title: 'Repair the classroom projector',
      responsibleRoleId: 14,
      assignedTo: 55,
      requestType: 'maintenance',
    })));
  });
});
