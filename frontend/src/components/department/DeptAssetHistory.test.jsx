import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeptAssetHistory from './DeptAssetHistory';
import { apiClient } from '../../utils/api';

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 42,
      role: 'department_head',
      department: 'Engineering',
    },
  }),
}));

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DeptAssetHistory', () => {
  beforeEach(() => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/api/department/transfers') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 101,
                assetName: 'Laptop-01',
                assetCode: 'AST-1001',
                sourceDepartment: 'Engineering',
                destinationDepartment: 'Finance',
                currentLocation: 'Room A1',
                newLocation: 'Room B2',
                transferReason: 'Department relocation',
                status: 'Approved',
                requestedByName: 'Jane Doe',
                transferDate: '2025-01-15T00:00:00.000Z',
              },
            ],
          },
        });
      }

      if (url === '/api/department/assets') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 12,
                name: 'Laptop-01',
                assetCode: 'AST-1001',
                department: 'Engineering',
                location: 'Room A1',
                status: 'available',
              },
            ],
          },
        });
      }

      if (url === '/api/departments') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { id: 3, name: 'Finance' },
              { id: 5, name: 'Procurement' },
            ],
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: [] } });
    });
  });

  it('renders the department movement dashboard using real movement records', async () => {
    render(<DeptAssetHistory />);

    await waitFor(() => expect(screen.getByRole('heading', { name: /asset movement/i })).toBeInTheDocument());
    expect(screen.getByText('Laptop-01')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Department relocation')).toBeInTheDocument();
  });
});
