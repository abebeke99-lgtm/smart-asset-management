import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminAssignment from './AdminAssignment';
import { UIProvider } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 19, fullName: 'Current Administrator', username: 'admin' } }),
}));

jest.mock('../../utils/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('react-toastify', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const availableAsset = {
  id: 11,
  assetCode: 'AST-0011',
  name: 'Microscope',
  category: 'Laboratory Equipment',
  status: 'available',
  collegeId: 3,
  departmentId: 7,
  location: 'Science Lab',
};

const activeUser = {
  id: 19,
  fullName: 'Aster Bekele',
  username: 'aster',
  role: 'lecturer',
  active: true,
  status: 'active',
  collegeId: 3,
  departmentId: 7,
};

const activeDepartment = { id: 7, name: 'Chemistry', collegeId: 3, status: 'active' };
const activeLaboratory = {
  id: 22,
  roomName: 'Science Lab',
  roomCode: 'LAB-22',
  roomType: 'laboratory',
  status: 'active',
  buildingId: 8,
  campusId: 6,
  departmentId: 7,
};

const response = (data) => ({ data });
let assignmentRows = [];

const configureApi = () => {
  apiClient.get.mockImplementation((url) => {
    const dataByUrl = {
      '/api/assignments': { assignments: assignmentRows, pagination: { total: assignmentRows.length, pages: 1 } },
      '/api/assets': { assets: [availableAsset, { ...availableAsset, id: 12, status: 'assigned' }, { ...availableAsset, id: 13, assetCode: 'AST-0013', name: 'Spectrometer' }], pagination: { pages: 1 } },
      '/api/users': { users: [activeUser, { ...activeUser, id: 20, fullName: 'Inactive User', status: 'inactive', active: false }], pagination: { pages: 1 } },
      '/api/departments': { departments: [activeDepartment, { ...activeDepartment, id: 8, name: 'Inactive', status: 'inactive' }], pagination: { pages: 1 } },
      '/api/admin/colleges': { colleges: [{ id: 3, name: 'Science College', campusId: 6, status: 'active' }], pagination: { pages: 1 } },
      '/api/locations/rooms': { rooms: [activeLaboratory], pagination: { pages: 1 } },
      '/api/locations/buildings': { buildings: [{ id: 8, buildingName: 'Science Building', campusId: 6, status: 'active' }], pagination: { pages: 1 } },
      '/api/locations/campuses': { campuses: [{ id: 6, campusName: 'Main Campus', status: 'active' }], pagination: { pages: 1 } },
      '/api/locations': { locations: [{ id: 5, name: 'Central Store', status: 'active' }] },
    };
    return Promise.resolve(response(dataByUrl[url] || { data: [] }));
  });
  apiClient.post.mockImplementation((_url, payload) => {
    assignmentRows = [{
      id: 99,
      asset_id: payload.asset_id,
      asset_tag: 'AST-0011',
      asset_name: 'Microscope',
      assigned_to_name: 'Aster Bekele',
      assigned_to_type: payload.assigned_to_type,
      department_name: 'Chemistry',
      assigned_date: payload.assigned_date,
      condition: payload.condition_at_assignment,
      location: payload.location,
      status: 'active',
    }];
    return Promise.resolve(response({ success: true }));
  });
};

const renderAssignmentPage = async () => {
  render(
    <UIProvider>
      <MemoryRouter>
        <AdminAssignment />
      </MemoryRouter>
    </UIProvider>
  );
  await screen.findAllByRole('button', { name: 'New Assignment' });
};

const openForm = () => fireEvent.click(screen.getAllByRole('button', { name: 'New Assignment' })[0]);

const selectAssetAndType = (type, assetId = '11') => {
  fireEvent.change(screen.getByLabelText('Asset ID *'), { target: { value: assetId } });
  fireEvent.change(screen.getByLabelText('Assigned To Type *'), { target: { value: type } });
};

describe('New Assignment form', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    assignmentRows = [];
    configureApi();
  });

  afterEach(() => jest.restoreAllMocks());

  test('offers only available assets, filters inactive users, and creates a user assignment', async () => {
    await renderAssignmentPage();
    openForm();

    const assetSelect = screen.getByLabelText('Asset ID *');
    expect(assetSelect.querySelector('option[value="11"]')).toHaveTextContent('Microscope');
    expect(assetSelect.querySelector('option[value="12"]')).not.toBeInTheDocument();

    selectAssetAndType('user');
    const userSelect = screen.getByLabelText('Assigned To *');
    expect(userSelect.querySelector('option[value="20"]')).not.toBeInTheDocument();
    fireEvent.change(userSelect, { target: { value: '19' } });
    fireEvent.change(screen.getByLabelText('Condition *'), { target: { value: 'Good' } });

    expect(screen.getByLabelText('Assigned By')).toHaveValue('Current Administrator');
    expect(screen.getByLabelText('Assigned By')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Location')).toHaveValue('Main Campus / Science Building / Science Lab');

    fireEvent.submit(screen.getByLabelText('Assigned To *').closest('form'));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/assignments', expect.objectContaining({
      asset_id: '11',
      assigned_to_type: 'user',
      assigned_to_id: '19',
      college_id: '3',
      department_id: '7',
      condition_at_assignment: 'Good',
      assigned_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })));
    expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('assigned_by');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(apiClient.get.mock.calls.filter(([url]) => url === '/api/assignments').length).toBeGreaterThanOrEqual(2);
    expect(await screen.findAllByText('Aster Bekele')).not.toHaveLength(0);
    expect(screen.getByRole('columnheader', { name: 'Assigned To' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
  });

  test('creates assignments to a department and a laboratory using the selected recipient type', async () => {
    await renderAssignmentPage();

    openForm();
    selectAssetAndType('department');
    fireEvent.change(screen.getByLabelText('College *'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Assigned To *'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Condition *'), { target: { value: 'Excellent' } });
    fireEvent.submit(screen.getByLabelText('Assigned To *').closest('form'));

    await waitFor(() => expect(apiClient.post).toHaveBeenNthCalledWith(1, '/api/assignments', expect.objectContaining({
      assigned_to_type: 'department',
      assigned_to_id: '7',
      department_id: '7',
      college_id: '3',
    })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    openForm();
    selectAssetAndType('laboratory', '13');
    fireEvent.change(screen.getByLabelText('College *'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Department *'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Assigned To *'), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText('Condition *'), { target: { value: 'Fair' } });
    fireEvent.submit(screen.getByLabelText('Assigned To *').closest('form'));

    await waitFor(() => expect(apiClient.post).toHaveBeenNthCalledWith(2, '/api/assignments', expect.objectContaining({
      asset_id: '13',
      assigned_to_type: 'laboratory',
      assigned_to_id: '22',
      laboratory_id: '22',
      department_id: '7',
      college_id: '3',
    })));
  });

  test('rejects an expected return date earlier than the assignment date', async () => {
    await renderAssignmentPage();
    openForm();
    selectAssetAndType('user');
    fireEvent.change(screen.getByLabelText('Assigned To *'), { target: { value: '19' } });
    fireEvent.change(screen.getByLabelText('Condition *'), { target: { value: 'Good' } });
    fireEvent.change(screen.getByLabelText('Assignment Date *'), { target: { value: '2024-05-10' } });
    fireEvent.change(screen.getByLabelText('Expected Return'), { target: { value: '2024-05-09' } });
    fireEvent.submit(screen.getByLabelText('Assigned To *').closest('form'));

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Expected return date cannot be before the assignment date.');
    expect(screen.getByLabelText('Expected Return')).toHaveValue('2024-05-09');
  });

  test('cancel closes and resets the form without submitting', async () => {
    await renderAssignmentPage();
    openForm();
    selectAssetAndType('user');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();

    openForm();
    expect(screen.getByLabelText('Asset ID *')).toHaveValue('');
    expect(screen.getByLabelText('Assigned To Type *')).toHaveValue('');
  });

  test('keeps entered values and reports the backend error when creation fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    apiClient.post.mockRejectedValueOnce({ response: { data: { message: 'Asset is already assigned' } } });
    await renderAssignmentPage();
    openForm();
    selectAssetAndType('user');
    fireEvent.change(screen.getByLabelText('Assigned To *'), { target: { value: '19' } });
    fireEvent.change(screen.getByLabelText('Condition *'), { target: { value: 'Good' } });
    fireEvent.submit(screen.getByLabelText('Assigned To *').closest('form'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Asset is already assigned'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Asset ID *')).toHaveValue('11');
    expect(screen.getByLabelText('Assigned To *')).toHaveValue('19');
  });
});
