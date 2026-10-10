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
    <MemoryRouter initialEntries={['/store/receive']}>
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

test('opens its independent delivery receipt form and saves validated receipt details', async () => {
  renderPage();

  fireEvent.click((await screen.findAllByRole('button', { name: 'Receive Delivery' }))[0]);
  const dialog = await screen.findByRole('dialog');
  expect(screen.getByLabelText('Product')).toBeInTheDocument();
  expect(screen.getByLabelText('Quantity')).toBeInTheDocument();
  expect(screen.getByLabelText('Unit Cost')).toBeInTheDocument();
  expect(screen.getByLabelText('Total Cost')).toHaveValue('');
  expect(screen.getByLabelText('Batch Number')).toBeInTheDocument();
  expect(screen.getByLabelText('Expiry Date')).toBeInTheDocument();
  expect(screen.getByLabelText('Supplier')).toBeInTheDocument();
  expect(screen.getByLabelText('Notes')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Receiving Reference / GRN'), { target: { value: 'GRN-22' } });
  fireEvent.change(screen.getByLabelText('Product'), { target: { value: '22' } });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Unit Cost'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Storage Location'), { target: { value: 'Store A' } });
  fireEvent.change(screen.getByLabelText('Batch Number'), { target: { value: 'LOT-2030' } });
  fireEvent.change(screen.getByLabelText('Expiry Date'), { target: { value: '2030-12-31' } });
  fireEvent.submit(dialog.querySelector('form'));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/store/receive', expect.objectContaining({
    asset_id: 22,
    quantity: 3,
    unit_price: 0,
    supplier_id: '5',
    reference: 'GRN-22',
    batch_number: 'LOT-2030',
    expiry_date: '2030-12-31',
    submission_id: expect.stringMatching(/^stock-\d+-[a-z0-9]+$/),
    to_location: 'Store A',
  })));
  expect(await screen.findByRole('status')).toHaveTextContent('Stock receipt saved successfully.');
});

test('Add Stock query parameters do not open or substitute for the Receive workflow', async () => {
  render(
    <UiProvider>
      <MemoryRouter initialEntries={['/store/receive?addStock=true']}>
        <StoreReceivePage />
      </MemoryRouter>
    </UiProvider>,
  );

  await screen.findByRole('heading', { name: 'Receive Assets', level: 1 });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('rejects invalid stock values and cancellation does not submit', async () => {
  renderPage();
  fireEvent.click((await screen.findAllByRole('button', { name: 'Receive Delivery' }))[0]);
  const dialog = await screen.findByRole('dialog');
  const form = dialog.querySelector('form');

  fireEvent.change(screen.getByLabelText('Receiving Reference / GRN'), { target: { value: 'GRN-22' } });
  fireEvent.change(screen.getByLabelText('Storage Location'), { target: { value: 'Store A' } });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '0' } });
  fireEvent.submit(form);
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a receiving reference, select a product, enter a positive whole-number quantity, and provide a receiving location.');
  expect(apiClient.post).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Product'), { target: { value: '22' } });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Unit Cost'), { target: { value: '-1' } });
  fireEvent.submit(form);
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid non-negative unit price.');
  expect(apiClient.post).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Unit Cost'), { target: { value: '4.5' } });
  expect(screen.getByLabelText('Total Cost')).toHaveValue('9.00');
  fireEvent.change(screen.getByLabelText('Batch Number'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Expiry Date'), { target: { value: '2030-12-31' } });
  fireEvent.submit(form);
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid expiry date on or after the received date and provide its batch number.');
  expect(apiClient.post).not.toHaveBeenCalled();

  fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[1]);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('requires a receiving reference and location before submitting', async () => {
  renderPage();
  fireEvent.click((await screen.findAllByRole('button', { name: 'Receive Delivery' }))[0]);
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(screen.getByLabelText('Product'), { target: { value: '22' } });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
  fireEvent.submit(dialog.querySelector('form'));

  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a receiving reference, select a product, enter a positive whole-number quantity, and provide a receiving location.');
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('displays persisted receipt cost and batch metadata in receipt details', async () => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/store/receive/suppliers') return Promise.resolve({ data: { data: suppliers } });
    if (url === '/api/store/inventory') return Promise.resolve({ data: { data: inventory } });
    return Promise.resolve({
      data: {
        data: {
          items: [{
            id: 12,
            receiptNumber: 'GRN-12',
            date: '2026-10-10',
            asset: 'Printer paper',
            assetCode: 'P-22',
            category: 'Supplies',
            unit: 'pack',
            supplier: 'Campus Supplies',
            quantity: 2,
            unitPrice: 2.5,
            totalCost: 5,
            batchNumber: 'LOT-12',
            expiryDate: '2027-10-10',
            location: 'Store A',
            receivedBy: 'Store Manager',
          }],
          summary: { receivedToday: 2, receivedThisMonth: 2, pendingInspection: 0 },
          pagination: { page: 1, total: 1, totalPages: 1 },
        },
      },
    });
  });

  renderPage();
  await screen.findByText('GRN-12');
  fireEvent.click(screen.getByRole('button', { name: 'View' }));

  const detail = await screen.findByRole('dialog');
  expect(detail).toHaveTextContent('Supplies');
  expect(detail).toHaveTextContent('pack');
  expect(detail).toHaveTextContent('5');
  expect(detail).toHaveTextContent('LOT-12');
  expect(detail).toHaveTextContent('2027-10-10');
});
