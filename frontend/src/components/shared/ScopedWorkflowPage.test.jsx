import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScopedWorkflowPage from './ScopedWorkflowPage';
import { apiClient } from '../../utils/api';
import { getAllAssets } from '../../services/assetApi';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../contexts/UiContext', () => ({ useLanguage: () => ({ language: 'en' }) }));
jest.mock('../../utils/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('../../services/assetApi', () => ({ getAllAssets: jest.fn() }));

describe('ScopedWorkflowPage transfers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: 17, role: 'department_head', departmentId: 4, fullName: 'Taylor User' },
    });
    getAllAssets.mockResolvedValue([{
      id: 31,
      name: 'Projector',
      assetCode: 'AV-031',
      status: 'available',
      departmentId: 4,
      department: 'Media',
      location: 'Room 2',
    }]);
    apiClient.get.mockImplementation((url) => {
      if (url === '/api/department-head/transfers') {
        return Promise.resolve({
          data: {
            data: [],
            pagination: { page: 1, pages: 1, total: 0 },
            summary: { total: 0, pending: 0, approved: 0, received: 0, rejectedCancelled: 0 },
          },
        });
      }
      if (url === '/api/departments') {
        return Promise.resolve({
          data: {
            data: [{ id: 8, name: 'Laboratory', status: 'active' }, { id: 9, name: 'Closed', status: 'inactive' }],
            pagination: { page: 1, pages: 1 },
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    apiClient.post.mockResolvedValue({ data: { success: true } });
  });

  it('creates a scoped transfer using the real asset and active department without a quantity field', async () => {
    render(<ScopedWorkflowPage scope="department" type="transfers" />);

    expect(await screen.findByText('New transfer requests will appear here')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New Transfer' }));

    expect(await screen.findByRole('option', { name: 'Projector (AV-031)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Laboratory' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Closed' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Asset'), { target: { value: '31' } });
    fireEvent.change(screen.getByLabelText('Destination department'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Destination location'), { target: { value: 'Lab 1' } });
    fireEvent.change(screen.getByLabelText('Transfer reason / notes'), { target: { value: 'Move for scheduled testing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Transfer' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/department-head/transfers', expect.objectContaining({
        asset_id: 31,
        destination_department_id: 8,
        destination_location: 'Lab 1',
        reason: 'Move for scheduled testing',
        transfer_date: expect.any(String),
      }));
    });
    expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('quantity');
    expect(await screen.findByText('Transfer created successfully.')).toBeInTheDocument();
  });
});
