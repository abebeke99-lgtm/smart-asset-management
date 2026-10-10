import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UiProvider } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import StoreReceivePage from './StoreReceivePage';

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const inventory = [{ id: 22, asset_id: 22, asset_tag: 'P-22', name: 'Printer paper' }];
const suppliers = [{ id: 5, supplierName: 'Campus Supplies' }];

const renderPage = () => render(
  <UiProvider>
    <MemoryRouter initialEntries={['/store/receive?addStock=true']}>
      <StoreReceivePage />
    </MemoryRouter>
  </UiProvider>,
);

beforeEach(() => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/store/inventory') return Promise.resolve({ data: { data: inventory } });
    if (url === '/api/store/receive/suppliers') return Promise.resolve({ data: { data: suppliers } });
    return Promise.resolve({
      data: {
        data: {
          items: [],
          summary: { receivedToday: 0, receivedThisMonth: 0, pendingInspection: 0 },
          pagination: { page: 1, total: 0, totalPages: 0 },
        },
      },
    });
  });
  apiClient.post.mockResolvedValue({ data: { success: true } });
});

afterEach(() => jest.clearAllMocks());

test('opens Add Stock form from inventory navigation and submits validated stock', async () => {
  renderPage();

  const dialog = await screen.findByRole('dialog');
  expect(screen.getByLabelText('Product')).toBeInTheDocument();
  expect(screen.getByLabelText('Quantity')).toBeInTheDocument();
  expect(screen.getByLabelText('Unit Price')).toBeInTheDocument();
  expect(screen.getByLabelText('Supplier')).toBeInTheDocument();
  expect(screen.getByLabelText('Notes')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Product'), { target: { value: '22' } });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Unit Price'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: '5' } });
  fireEvent.submit(dialog.querySelector('form'));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/store/receive', expect.objectContaining({
    asset_id: 22,
    quantity: 3,
    unit_price: 0,
    supplier_id: '5',
  })));
  expect(await screen.findByRole('status')).toHaveTextContent('Stock added successfully.');
});

test('rejects invalid stock values and cancellation does not submit', async () => {
  renderPage();
  const dialog = await screen.findByRole('dialog');
  const form = dialog.querySelector('form');

  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '0' } });
  fireEvent.submit(form);
  expect(await screen.findByRole('alert')).toHaveTextContent('Select a product and enter a positive whole-number quantity.');
  expect(apiClient.post).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Product'), { target: { value: '22' } });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Unit Price'), { target: { value: '-1' } });
  fireEvent.submit(form);
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid non-negative unit price.');
  expect(apiClient.post).not.toHaveBeenCalled();

  fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[1]);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(apiClient.post).not.toHaveBeenCalled();
});
