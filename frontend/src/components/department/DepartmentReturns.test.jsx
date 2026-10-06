import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiClient } from '../../utils/api';
import DepartmentReturns from './DepartmentReturns';

jest.mock('../../utils/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  resolveAssetUrl: jest.fn((value) => value),
}));

const assignment = {
  id: 8,
  asset_id: 22,
  asset_tag: 'L-22',
  asset_name: 'Department Laptop',
  assigned_to: 44,
  assigned_to_name: 'Returning Person',
  status: 'active',
};

const historyRecord = {
  id: 15,
  asset_id: 22,
  asset_name: 'Department Laptop',
  returning_person_name: 'Returning Person',
  returnDate: '2026-10-05',
  condition: 'Damaged',
  status: 'Requested',
  notes: 'Screen cracked',
};

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockImplementation((url) => Promise.resolve({
    data: url.includes('returns') ? { data: [] } : { assignments: [assignment] },
  }));
  apiClient.post.mockResolvedValue({ data: { success: true } });
});

test('records a damaged return against the assigned person and refreshes return history', async () => {
  render(<DepartmentReturns />);
  await screen.findByText('No return records found.');
  fireEvent.click(screen.getByRole('button', { name: 'Record Return' }));
  fireEvent.change(screen.getByLabelText('Asset'), { target: { value: '22' } });
  expect(screen.getByLabelText('Person returning')).toHaveValue('Returning Person');
  fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'Damaged' } });
  fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Screen cracked' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Return' }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/department-head/returns', expect.objectContaining({
    asset_id: 22,
    condition: 'Damaged',
    reason: 'End of Assignment',
    notes: 'Screen cracked',
    evidence_url: '',
  })));
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(4));
});

test('shows persisted department return history', async () => {
  apiClient.get.mockImplementation((url) => Promise.resolve({
    data: url.includes('returns') ? { data: [historyRecord] } : { assignments: [assignment] },
  }));
  render(<DepartmentReturns />);
  expect(await screen.findByText('Department Laptop')).toBeInTheDocument();
  expect(screen.getByText('Returning Person')).toBeInTheDocument();
  expect(screen.getByText('Damaged')).toBeInTheDocument();
});

test('uploads optional evidence and stores its returned URL with the return', async () => {
  apiClient.post.mockImplementation((url) => Promise.resolve(url === '/api/uploads'
    ? { data: { file: { url: '/uploads/return-photo.png' } } }
    : { data: { success: true } }));
  render(<DepartmentReturns />);
  await screen.findByText('No return records found.');
  fireEvent.click(screen.getByRole('button', { name: 'Record Return' }));
  fireEvent.change(screen.getByLabelText('Asset'), { target: { value: '22' } });
  const evidence = new File(['evidence'], 'return-photo.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Evidence (optional)'), { target: { files: [evidence] } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Return' }));

  await waitFor(() => expect(apiClient.post).toHaveBeenNthCalledWith(
    1,
    '/api/uploads',
    expect.any(FormData),
    { headers: { 'Content-Type': 'multipart/form-data' } },
  ));
  await waitFor(() => expect(apiClient.post).toHaveBeenNthCalledWith(
    2,
    '/api/department-head/returns',
    expect.objectContaining({ evidence_url: '/uploads/return-photo.png' }),
  ));
});
