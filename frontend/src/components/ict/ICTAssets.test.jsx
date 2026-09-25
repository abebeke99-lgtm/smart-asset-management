import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import ICTAssets from './ICTAssets';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('react-toastify', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

describe('ICTAssets workspace', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: { role: 'ict_officer' },
    });

    apiClient.get.mockImplementation((url) => {
      if (url === '/api/ict/assets') {
        return Promise.resolve({
          data: {
            assets: [
              {
                id: 1,
                name: 'Laptop',
                assetTag: 'AST-001',
                category: 'Computer',
                serialNumber: 'SN-1001',
                department: 'ICT',
                location: 'Main Lab',
                assignedTo: 'Alemu',
                condition: 'Good',
                status: 'Assigned',
                updatedAt: '2026-09-24T00:00:00.000Z',
              },
            ],
            total: 1,
            pagination: { page: 1, pages: 1, limit: 25 },
            summary: { total: 1, available: 0, assigned: 1, maintenance: 0, damaged: 0, missing: 0 },
          },
        });
      }

      if (url === '/api/ict/assets/options') {
        return Promise.resolve({
          data: {
            categories: [{ id: 1, name: 'Computer' }],
            departments: [{ id: 1, name: 'ICT' }],
            statuses: ['Available', 'Assigned', 'In Maintenance', 'Missing'],
            conditions: ['Good', 'Fair', 'Poor'],
          },
        });
      }

      return Promise.resolve({ data: {} });
    });
  });

  it('renders the formal ICT asset register heading and includes sorting controls', async () => {
    render(
      <MemoryRouter>
        <ICTAssets />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'ICT Assets' })).toBeInTheDocument();
    expect(screen.getByText('Manage, track, assign, transfer, maintain, and verify university ICT assets.')).toBeInTheDocument();
    expect(screen.queryByText('Total Equipment')).not.toBeInTheDocument();
    expect(screen.getByText('Asset register')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort ICT assets by')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort direction')).toBeInTheDocument();
  });

  it('shows the required summary cards and uses the professional ICT asset labels', async () => {
    render(
      <MemoryRouter>
        <ICTAssets />
      </MemoryRouter>
    );

    const summary = await screen.findByRole('region', { name: 'ICT asset summary' });
    expect(within(summary).getByText('Total Assets')).toBeInTheDocument();
    expect(within(summary).getByText('Assigned')).toBeInTheDocument();
    expect(within(summary).getByText('Available')).toBeInTheDocument();
    expect(within(summary).getByText('Maintenance')).toBeInTheDocument();
    expect(within(summary).getByText('Missing')).toBeInTheDocument();
    expect(screen.queryByText(/svg/i)).not.toBeInTheDocument();
  });
});
