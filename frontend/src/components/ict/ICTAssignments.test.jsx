import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { getAllAssets } from '../../services/assetApi';
import ICTAssignments from './ICTAssignments';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/assetApi', () => ({ getAllAssets: jest.fn() }));

const asset = { id: 7, name: 'Field laptop', assetCode: 'AST-007', status: 'available' };

const mockLookups = () => {
  axios.get.mockImplementation((url) => {
    if (url === '/api/users') return Promise.resolve({ data: { users: [] } });
    if (url === '/api/departments') return Promise.resolve({ data: { departments: [] } });
    if (url === '/api/assignments') return Promise.resolve({ data: { assignments: [] } });
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
};

describe('ICTAssignments asset loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1, role: 'ict_officer' } });
    mockLookups();
  });

  test('shows loading state while requests are pending', () => {
    getAllAssets.mockReturnValue(new Promise(() => {}));

    const { container } = render(<ICTAssignments />);

    expect(container.querySelector('.ia-skeletons')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asset Assignments' })).toBeInTheDocument();
  });

  test('renders successfully loaded assets in the asset selector', async () => {
    getAllAssets.mockResolvedValue([asset]);
    render(<ICTAssignments />);

    fireEvent.focus(await screen.findByRole('textbox', { name: 'Asset' }));

    expect(await screen.findByText('Field laptop AST-007 Available')).toBeInTheDocument();
  });

  test('shows an explicit empty-assets state after a successful empty response', async () => {
    getAllAssets.mockResolvedValue([]);
    render(<ICTAssignments />);

    expect(await screen.findByRole('status')).toHaveTextContent('No assets are currently available to assign.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('shows the API error and retry action without blanking the page', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Request failed with status code 400');
    error.response = { data: { message: 'limit must be 10, 25, or 50' } };
    getAllAssets.mockRejectedValue(error);
    render(<ICTAssignments />);

    expect(await screen.findByText('limit must be 10, 25, or 50')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asset Assignments' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Retry' }).length).toBeGreaterThan(0);
  });
});