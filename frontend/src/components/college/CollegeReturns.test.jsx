import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { UiProvider } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import CollegeReturns from './CollegeReturns';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const returnList = {
  data: {
    success: true,
    data: {
      summary: { total: 1, byStatus: { Requested: 1 } },
      returns: [{
        id: 9,
        return_number: 'RET-2026-9',
        returnNumber: 'RET-2026-9',
        asset_id: 29,
        asset_name: 'Microscope',
        Asset: { id: 29, name: 'Microscope', assetCode: 'AST-029', serialNumber: 'SN-029' },
        returning_person_name: 'Staff Member',
        returning_person: { id: 18, fullName: 'Staff Member' },
        return_date: '2026-10-05',
        returnDate: '2026-10-05',
        condition: 'Good',
        reason: 'End of Assignment',
        quantity: 1,
        status: 'Requested',
        notes: 'End of term',
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
  },
};

const returnOptions = {
  data: {
    success: true,
    data: [{
      id: 29,
      name: 'Microscope',
      assetCode: 'AST-029',
      serialNumber: 'SN-029',
      departmentId: 14,
      availableQuantity: 2,
      custodian: { id: 18, name: 'Staff Member' },
    }],
  },
};

const renderPage = () => render(<UiProvider><CollegeReturns /></UiProvider>);

beforeEach(() => {
  localStorage.setItem('language', 'en');
  apiClient.get.mockReset();
  apiClient.post.mockReset();
  apiClient.get.mockImplementation((url) => Promise.resolve(url === '/api/college/returns/options' ? returnOptions : returnList));
  apiClient.post.mockResolvedValue({ data: { success: true, message: 'Return request created' } });
  window.confirm = jest.fn(() => true);
  useAuth.mockReturnValue({
    user: { id: 7, role: 'college_manager' },
    hasPermission: (permission) => ['college.returns.view', 'college.returns.manage'].includes(permission),
  });
});

test('College Manager lists returns and registers a new return through the college API', async () => {
  renderPage();

  expect(await screen.findByRole('heading', { name: 'Asset Returns' })).toBeInTheDocument();
  expect(screen.getByText('Microscope')).toBeInTheDocument();
  expect(screen.getByText('RET-2026-9')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Register Return' }));
  const dialog = await screen.findByRole('dialog', { name: 'Register an asset return' });
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/college/returns/options'));

  fireEvent.change(within(dialog).getByLabelText('Asset *'), { target: { value: '29' } });
  await waitFor(() => expect(within(dialog).getByDisplayValue('Staff Member')).toBeInTheDocument());
  fireEvent.change(within(dialog).getByLabelText('Quantity'), { target: { value: '2' } });
  fireEvent.change(within(dialog).getByLabelText('Return date *'), { target: { value: '2026-10-06' } });
  fireEvent.change(within(dialog).getByLabelText('Condition *'), { target: { value: 'Damaged' } });
  fireEvent.change(within(dialog).getByLabelText('Return reason *'), { target: { value: 'Damage' } });
  fireEvent.change(within(dialog).getByLabelText('Notes'), { target: { value: 'Cracked screen' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Register Return' }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/college/returns', expect.objectContaining({
    asset_id: 29,
    quantity: 2,
    return_date: '2026-10-06',
    condition: 'Damaged',
    reason: 'Damage',
    notes: 'Cracked screen',
  })));
  await waitFor(() => expect(apiClient.get.mock.calls.filter(([url]) => url === '/api/college/returns').length).toBeGreaterThan(1));
});

test('College Manager approves a requested return from the row actions', async () => {
  renderPage();

  await screen.findByText('Microscope');
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/college/returns/9/approve', {}));
  expect(window.confirm).toHaveBeenCalled();
});

test('regular College users can view returns but cannot register, approve, or reject them', async () => {
  useAuth.mockReturnValue({
    user: { id: 8, role: 'college' },
    hasPermission: (permission) => permission === 'college.returns.view',
  });
  renderPage();

  expect(await screen.findByText('Microscope')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Register Return' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
});

test('rejecting a requested return requires a reason before calling the API', async () => {
  renderPage();

  await screen.findByText('Microscope');
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

  const dialog = await screen.findByRole('dialog', { name: 'Reject this asset return?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
  expect(await within(dialog).findByText('A rejection reason is required.')).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalledWith('/api/college/returns/9/reject', expect.anything());

  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Asset still in use' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/college/returns/9/reject', { reason: 'Asset still in use' }));
});

test('Amharic labels are used and an empty result reports clearly', async () => {
  localStorage.setItem('language', 'am');
  apiClient.get.mockImplementation((url) => Promise.resolve(url === '/api/college/returns/options'
    ? returnOptions
    : { data: { success: true, data: { summary: { total: 0, byStatus: {} }, returns: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } } }));
  renderPage();

  expect(await screen.findByRole('heading', { name: 'የንብረት መመለሻዎች' })).toBeInTheDocument();
  expect(screen.getByText('የንብረት መመለሻ አልተገኘም።')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'መመለሻ መዝግብ' })).toBeInTheDocument();
});
