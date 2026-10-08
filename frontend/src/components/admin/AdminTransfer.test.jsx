import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminTransfer from './AdminTransfer';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, fullName: 'Current Administrator', role: 'admin' } }),
}));

jest.mock('../../utils/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

jest.mock('react-toastify', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const asset = {
  id: 15,
  assetCode: 'AS-0015',
  name: 'Microscope',
  serialNumber: 'SN-015',
  status: 'available',
  campusId: 1,
  collegeId: 1,
  departmentId: 7,
  buildingId: 1,
  roomId: 10,
  location: 'Source Lab',
};

const apiResponse = (data) => ({ data });
let transferRows = [];

const configureApi = () => {
  apiClient.get.mockImplementation((url) => {
    const responses = {
      '/api/assets': [asset],
      '/api/locations/campuses': [{ id: 1, campusName: 'Source Campus', status: 'active' }, { id: 2, campusName: 'Destination Campus', status: 'active' }],
      '/api/admin/colleges': [{ id: 1, collegeName: 'Source College', campusId: 1, status: 'active' }, { id: 2, collegeName: 'Destination College', campusId: 2, status: 'active' }],
      '/api/departments': [{ id: 7, name: 'Source Department', collegeId: 1, status: 'active' }, { id: 8, name: 'Destination Department', collegeId: 2, status: 'active' }],
      '/api/locations/buildings': [{ id: 3, buildingName: 'Destination Building', campusId: 2, status: 'active' }],
      '/api/locations/rooms': [{ id: 11, roomName: 'Destination Lab', roomType: 'laboratory', buildingId: 3, floor: 1, departmentId: 8, status: 'active' }],
      '/api/transfers': { data: transferRows, pagination: { page: 1, pages: 1, total: transferRows.length } },
    };
    return Promise.resolve(apiResponse(responses[url] || {}));
  });
  apiClient.post.mockImplementation((_url, payload) => {
    transferRows = [{
      id: 81,
      ...payload,
      transferNumber: payload.transferNumber,
      asset_id: payload.assetId,
      asset_code: asset.assetCode,
      asset_name: asset.name,
      status: 'Requested',
      requestedBy: 7,
    }];
    return Promise.resolve(apiResponse({ success: true }));
  });
};

describe('Asset Transfer request form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transferRows = [];
    configureApi();
  });

  test('submits a manually entered asset ID and all request fields to the transfer API', async () => {
    render(<MemoryRouter><AdminTransfer /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'New transfer request' }));

    const dialog = await screen.findByRole('dialog', { name: 'New Transfer Request' });
    fireEvent.change(screen.getByLabelText('Asset ID *'), { target: { value: 'AS-0015' } });
    fireEvent.change(screen.getByLabelText('Serial Number'), { target: { value: 'SN-015' } });
    fireEvent.change(screen.getByLabelText('Transfer Reference'), { target: { value: 'TR-2026-15' } });
    fireEvent.change(screen.getByLabelText('From Campus *'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('From College *'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('From Department *'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('To Campus *'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('To College *'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('To Department *'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Destination Building *'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Destination Floor *'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Destination Laboratory / Room *'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Transfer Date *'), { target: { value: '2026-10-09' } });
    fireEvent.change(screen.getByLabelText('Condition *'), { target: { value: 'Good' } });
    fireEvent.change(screen.getByLabelText('Expected Return'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('Transfer Reason *'), { target: { value: 'Relocation' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Handle with care' } });
    expect(screen.getByLabelText('Requested By')).toHaveValue('Current Administrator');
    expect(screen.getByLabelText('Requested By')).toHaveAttribute('readonly');

    fireEvent.submit(dialog.querySelector('form'));

    expect(toast.error).not.toHaveBeenCalled();
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/transfers', expect.objectContaining({
      assetId: 15,
      serialNumber: 'SN-015',
      transferNumber: 'TR-2026-15',
      sourceCampusId: 1,
      sourceCollegeId: 1,
      sourceDepartmentId: 7,
      destinationCampusId: 2,
      destinationCollegeId: 2,
      destinationDepartmentId: 8,
      destinationBuildingId: 3,
      destinationFloor: 1,
      destinationRoomId: 11,
      transferDate: '2026-10-09',
      expectedReturnDate: '2026-10-20',
      reason: 'Relocation',
      notes: 'Handle with care',
    })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('button', { name: 'View details for TR-2026-15' })).toBeInTheDocument();
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/api/transfers').length).toBeGreaterThan(1);
  });

  test('requires a manually entered asset ID', async () => {
    render(<MemoryRouter><AdminTransfer /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'New transfer request' }));
    const dialog = await screen.findByRole('dialog', { name: 'New Transfer Request' });

    fireEvent.submit(dialog.querySelector('form'));

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Asset ID *')).toBeRequired();
  });
});
