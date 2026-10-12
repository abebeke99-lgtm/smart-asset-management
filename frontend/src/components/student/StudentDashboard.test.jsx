import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import StudentDashboard from './StudentDashboard';
import apiClient from '../../services/apiClient';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const response = {
  data: {
    success: true,
    data: {
      summary: { assignedAssets: 1, totalRequests: 2, openRequests: 1 },
      assets: [{
        id: 9,
        status: 'active',
        asset: { id: 11, assetCode: 'STU-11', name: 'Personal Laptop', category: 'Computing', status: 'assigned' },
      }],
      requests: [{
        id: 15,
        requestCode: 'REQ-15',
        title: 'Laptop setup',
        requestType: 'support',
        status: 'submitted',
        createdAt: '2026-10-01T00:00:00.000Z',
      }],
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockResolvedValue(response);
});

test('renders only the personal assignments and requests returned by the student dashboard API', async () => {
  render(<StudentDashboard />);

  expect(await screen.findByRole('heading', { name: 'My Dashboard' })).toBeInTheDocument();
  expect(screen.getByText('Personal Laptop')).toBeInTheDocument();
  expect(screen.getByText('Laptop setup')).toBeInTheDocument();
  expect(screen.queryByText('STU-11')).not.toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/student/dashboard');
});

test('shows an error and retry action instead of fabricated zero counts on API failure', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  apiClient.get
    .mockRejectedValueOnce(new Error('database offline'))
    .mockResolvedValueOnce(response);
  render(<StudentDashboard />);

  expect(await screen.findByRole('alert')).toHaveTextContent('database offline');
  expect(screen.queryByText('Assigned Assets')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Personal Laptop')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledTimes(2);
  expect(errorLog).toHaveBeenCalledWith('Student dashboard request failed:', { status: 0, message: 'database offline' });
});

test('treats an incomplete successful API response as an error', async () => {
  apiClient.get.mockResolvedValue({ data: { success: true, data: {} } });
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<StudentDashboard />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Student dashboard response was incomplete.');
  expect(screen.queryByText('You have not submitted any requests.')).not.toBeInTheDocument();
  expect(errorLog).toHaveBeenCalled();
});
