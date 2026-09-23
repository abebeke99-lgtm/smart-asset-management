import { extractRows, extractPagination } from './FinanceInvoices';

describe('FinanceInvoices response parsing', () => {
  test('accepts the backend list payload shape used by finance/invoices', () => {
    const response = {
      data: {
        success: true,
        data: [
          { id: 1, invoiceNumber: 'INV-1001', supplierName: 'Acme' },
          { id: 2, invoiceNumber: 'INV-1002', supplierName: 'Beta' },
        ],
        summary: { total: 2, totalValue: 1000, outstanding: 200 },
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    };

    expect(extractRows(response)).toHaveLength(2);
    expect(extractPagination(response, 0, 1, 10)).toMatchObject({ total: 2, page: 1, pageSize: 10, totalPages: 1 });
  });

  test('accepts nested invoice payloads when the backend wraps records under data.invoices', () => {
    const response = {
      data: {
        success: true,
        data: {
          invoices: [
            { id: 3, invoiceNumber: 'INV-2001', supplierName: 'Gamma' },
          ],
        },
        summary: { total: 1, totalValue: 250, outstanding: 50 },
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    };

    expect(extractRows(response)).toEqual([
      { id: 3, invoiceNumber: 'INV-2001', supplierName: 'Gamma' },
    ]);
    expect(extractPagination(response, 0, 1, 10).total).toBe(1);
  });
});
