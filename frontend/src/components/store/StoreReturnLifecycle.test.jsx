import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiClient } from '../../utils/api';
import StoreReturnLifecycle from './StoreReturnLifecycle';

jest.mock('../../utils/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const pendingReturn = {
  id: 14,
  returnNumber: 'RET-14',
  asset_name: 'Microscope',
  quantity: 2,
  status: 'Approved',
};

beforeEach(() => {
  apiClient.get.mockReset();
  apiClient.post.mockReset();
  apiClient.get.mockResolvedValue({ data: { success: true, data: [pendingReturn] } });
  apiClient.post.mockResolvedValue({ data: { success: true } });
});

test('store managers advance approved requests and reload committed workflow state', async () => {
  apiClient.get.mockImplementation(async () => ({
    data: { success: true, data: [pendingReturn] },
  }));
  render(<StoreReturnLifecycle />);
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/store/returns', { params: { page: 1, pageSize: 100 } }), { timeout: 10000 });
  fireEvent.click(await screen.findByRole('button', { name: 'Mark Ready for Return' }, { timeout: 10000 }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/store/returns/14/ready', {}));
  expect(await screen.findByRole('status')).toHaveTextContent('RET-14 updated.');
});

test('shows an API error and offers a working retry', async () => {
  apiClient.get.mockRejectedValueOnce({ response: { data: { message: 'Store unavailable.' } } });
  render(<StoreReturnLifecycle />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Store unavailable.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('button', { name: 'Mark Ready for Return' })).toBeInTheDocument();
});
