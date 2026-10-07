import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
});
