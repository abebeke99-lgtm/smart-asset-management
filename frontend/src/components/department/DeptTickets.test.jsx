import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { apiClient } from '../../utils/api';
import DeptTickets from './DeptTickets';

jest.mock('../../utils/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  getApiErrorMessage: (error, fallback) => error?.response?.data?.message || fallback,
}));

const ticket = {
  id: 4,
  ticketId: 'SR-2026-001',
  request: 'Repair network switch',
  category: 'Network',
  priority: 'high',
  status: 'scheduled',
  statusLabel: 'Scheduled',
  assignedTechnician: 'Alem Bekele',
  createdAt: '2026-10-01T09:00:00.000Z',
  acknowledgedAt: '2026-10-01T10:00:00.000Z',
  dueDate: '2026-10-03T10:00:00.000Z',
  escalationState: 'Escalated',
  description: 'Switch in Lab 2 is offline.',
  escalationReason: 'Past response deadline',
};
const escalatedTicket = {
  ...ticket,
  status: 'escalated',
  statusLabel: 'Escalated',
  currentOwner: 'Alem Bekele',
  escalationTime: '2026-10-04T09:00:00.000Z',
  followUp: 'Waiting for replacement equipment',
  followUps: [{ id: 9, comment: 'Waiting for replacement equipment', author: 'Department Head', createdAt: '2026-10-04T10:00:00.000Z' }],
  resolution: 'Replacement completed',
};

describe('DeptTickets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockImplementation((path) => {
      if (path === '/department-head/tickets') {
        return Promise.resolve({ data: { data: [ticket], pagination: { page: 1, pages: 1, total: 1 } } });
      }
      if (path === '/department-head/tickets/4') {
        return Promise.resolve({ data: { data: ticket } });
      }
      if (path === '/department-head/escalated-tickets') {
        return Promise.resolve({ data: { data: [escalatedTicket], pagination: { page: 1, pages: 1, total: 1 } } });
      }
      return Promise.reject(new Error(`Unexpected endpoint: ${path}`));
    });
    apiClient.post.mockResolvedValue({ data: { success: true } });
  });

  test('shows real ticket monitoring fields and filters by status and priority', async () => {
    render(<DeptTickets />);

    expect(await screen.findByText('SR-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Repair network switch')).toBeInTheDocument();
    expect(screen.getByText('Alem Bekele')).toBeInTheDocument();
    expect(screen.getAllByText('Escalated')).toHaveLength(2);
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/tickets', expect.objectContaining({
      params: expect.objectContaining({ page: 1, limit: 20 }),
    }));

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'scheduled' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/department-head/tickets', expect.objectContaining({
      params: expect.objectContaining({ status: 'scheduled' }),
    })));
    fireEvent.change(screen.getByLabelText('Filter by priority'), { target: { value: 'high' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/department-head/tickets', expect.objectContaining({
      params: expect.objectContaining({ status: 'scheduled', priority: 'high' }),
    })));
  });

  test('opens read-only ticket details', async () => {
    render(<DeptTickets />);
    fireEvent.click(await screen.findByRole('button', { name: 'View details for SR-2026-001' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('Switch in Lab 2 is offline.');
    expect(screen.getByRole('dialog')).toHaveTextContent('Past response deadline');
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/tickets/4');
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /assign|acknowledge|cancel|update|edit|save/i })).not.toBeInTheDocument();
  });

  test('shows the escalation reason, time, current owner, follow-up, and resolution', async () => {
    render(<DeptTickets escalatedOnly />);

    expect(await screen.findByText('SR-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Past response deadline')).toBeInTheDocument();
    expect(screen.getByText('Alem Bekele')).toBeInTheDocument();
    expect(screen.getByText('Waiting for replacement equipment')).toBeInTheDocument();
    expect(screen.getByText('Replacement completed')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/escalated-tickets', expect.objectContaining({
      params: expect.objectContaining({ page: 1, limit: 20 }),
    }));
  });

  test('allows a department head to add a follow-up to an escalated ticket', async () => {
    apiClient.get.mockImplementation((path) => {
      if (path === '/department-head/escalated-tickets') {
        return Promise.resolve({ data: { data: [escalatedTicket], pagination: { page: 1, pages: 1, total: 1 } } });
      }
      if (path === '/department-head/tickets/4') {
        return Promise.resolve({ data: { data: escalatedTicket } });
      }
      return Promise.reject(new Error(`Unexpected endpoint: ${path}`));
    });

    render(<DeptTickets escalatedOnly />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add follow-up' }));
    const followUpField = await screen.findByLabelText('Add follow-up');
    fireEvent.change(followUpField, { target: { value: 'Replacement delivery confirmed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save follow-up' }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      '/department-head/tickets/4/follow-up',
      { comment: 'Replacement delivery confirmed' },
    ));
  });
});
