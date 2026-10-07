import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ICTEquipment from './ICTEquipment';

const inventoryRecord = {
  id: 51,
  assetCode: 'ICT-051',
  name: 'Design workstation',
  category: 'Computing',
  serialNumber: 'SN-051',
  quantity: 2,
  status: 'available',
  condition: 'Good',
  campusId: 1,
  collegeId: 2,
  departmentId: 3,
  buildingId: 4,
  roomId: 5,
  warrantyExpiry: '2027-06-30',
  purchaseDate: '2025-06-30',
  purchasePrice: '1200.00',
  CampusRecord: { id: 1, campusName: 'Main Campus' },
  College: { id: 2, collegeName: 'Engineering College' },
  DepartmentRecord: { id: 3, name: 'ICT Services' },
  BuildingRecord: { buildingName: 'Technology Hall' },
  RoomRecord: { roomName: 'Room 204' },
};

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('ICTEquipment', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({
      success: true,
      equipment: [inventoryRecord],
      total: 1,
      pagination: { page: 1, total: 1, totalPages: 1 },
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('loads central IT equipment and location details from the equipment API', async () => {
    render(<ICTEquipment />);

    expect(await screen.findByText('Design workstation')).toBeInTheDocument();
    expect(screen.getByText('ICT-051')).toBeInTheDocument();
    expect(screen.getByText('Main Campus')).toBeInTheDocument();
    expect(screen.getByText('Engineering College')).toBeInTheDocument();
    expect(screen.getByText('Technology Hall')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort by Asset ID' })).toHaveClass('ict-equipment-sort');
    expect(document.querySelector('.ict-equipment-table')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/ict/equipment?'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test('submits category filters and fetches equipment details from the same API', async () => {
    global.fetch.mockImplementation((url) => {
      if (String(url).includes('/ict/equipment/51')) {
        return Promise.resolve(jsonResponse({ success: true, equipment: inventoryRecord }));
      }
      return Promise.resolve(jsonResponse({
        success: true,
        equipment: [inventoryRecord],
        total: 1,
        pagination: { page: 1, total: 1, totalPages: 1 },
      }));
    });
    render(<ICTEquipment />);
    await screen.findByText('Design workstation');

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by category' }), {
      target: { value: 'Networking' },
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('category=Networking'),
      expect.any(Object),
    ));

    fireEvent.click(screen.getByRole('button', { name: 'View details for Design workstation' }));
    expect(await screen.findByRole('dialog', { name: 'Equipment details' })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ict/equipment/51',
      expect.objectContaining({ headers: {} }),
    );
    expect(screen.getByText('Room 204')).toBeInTheDocument();
  });

  test('shows API errors and a useful empty state instead of mock equipment', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ message: 'Database unavailable' }, 503));
    render(<ICTEquipment />);

    expect(await screen.findByText('The equipment service is unavailable. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Design workstation')).not.toBeInTheDocument();
  });

  test('explains that an active campus must be configured when no campus options exist', async () => {
    global.fetch.mockImplementation((url) => (
      String(url).endsWith('/options')
        ? Promise.resolve(jsonResponse({ success: true, campuses: [], colleges: [], departments: [], buildings: [], rooms: [] }))
        : Promise.resolve(jsonResponse({ success: true, equipment: [], total: 0, pagination: { page: 1, total: 0, totalPages: 1 } }))
    ));
    render(<ICTEquipment />);
    await screen.findByRole('button', { name: 'Add IT Equipment' });
    fireEvent.click(screen.getByRole('button', { name: 'Add IT Equipment' }));

    expect(await screen.findByText(/No active campus is linked to this college/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveClass('ict-equipment-retry');
  });

  test('adds equipment through the API and reloads the database-backed list', async () => {
    const createdAsset = { ...inventoryRecord, id: 73, assetCode: 'ICT-073', name: 'New workstation' };
    let currentEquipment = [inventoryRecord];
    global.fetch.mockImplementation((url, options = {}) => {
      if (String(url).endsWith('/options')) {
        return Promise.resolve(jsonResponse({
          campuses: [{ id: 1, campusName: 'Main Campus' }],
          colleges: [{ id: 2, collegeName: 'Engineering College' }],
          departments: [{ id: 3, collegeId: 2, name: 'ICT Services' }],
          buildings: [{ id: 4, campusId: 1, buildingName: 'Technology Hall' }],
          rooms: [{ id: 5, buildingId: 4, roomName: 'Room 204' }],
        }));
      }
      if (options.method === 'POST') {
        expect(JSON.parse(options.body)).toMatchObject({
          name: 'New workstation',
          category: 'Computing',
          quantity: 3,
          campusId: 1,
        });
        currentEquipment = [createdAsset];
        return Promise.resolve(jsonResponse({ success: true, equipment: createdAsset }, 201));
      }
      return Promise.resolve(jsonResponse({
        success: true,
        equipment: currentEquipment,
        total: currentEquipment.length,
        pagination: { page: 1, total: currentEquipment.length, totalPages: 1 },
      }));
    });
    render(<ICTEquipment />);
    await screen.findByText('Design workstation');
    fireEvent.click(screen.getByRole('button', { name: /add it equipment/i }));
    expect(await screen.findByRole('dialog', { name: 'Add IT equipment' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Asset Name *'), { target: { value: 'New workstation' } });
    fireEvent.change(screen.getByLabelText('Category *'), { target: { value: 'Computing' } });
    fireEvent.change(screen.getByLabelText('Quantity *'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Campus *'), { target: { value: '1' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add IT Equipment' })[1]);

    expect(await screen.findByText('New workstation')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Add IT equipment' })).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ict/equipment',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('keeps entered form values and explains duplicate serial errors', async () => {
    global.fetch.mockImplementation((url, options = {}) => {
      if (String(url).endsWith('/options')) {
        return Promise.resolve(jsonResponse({
          campuses: [{ id: 1, campusName: 'Main Campus' }],
          colleges: [],
          departments: [],
          buildings: [],
          rooms: [],
        }));
      }
      if (options.method === 'POST') return Promise.resolve(jsonResponse({ message: 'Serial number already exists' }, 409));
      return Promise.resolve(jsonResponse({
        success: true,
        equipment: [inventoryRecord],
        total: 1,
        pagination: { page: 1, total: 1, totalPages: 1 },
      }));
    });
    render(<ICTEquipment />);
    await screen.findByText('Design workstation');
    fireEvent.click(screen.getByRole('button', { name: /add it equipment/i }));
    await screen.findByRole('dialog', { name: 'Add IT equipment' });
    fireEvent.change(screen.getByLabelText('Asset Name *'), { target: { value: 'Replacement laptop' } });
    fireEvent.change(screen.getByLabelText('Category *'), { target: { value: 'Computing' } });
    fireEvent.change(screen.getByLabelText('Serial Number'), { target: { value: 'SN-051' } });
    fireEvent.change(screen.getByLabelText('Campus *'), { target: { value: '1' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add IT Equipment' })[1]);

    expect(await screen.findByText('Serial number already exists')).toBeInTheDocument();
    expect(screen.getByLabelText('Asset Name *')).toHaveValue('Replacement laptop');
    expect(screen.getByLabelText('Serial Number')).toHaveValue('SN-051');
  });

  test('loads the current record and updates it through the equipment API', async () => {
    const updatedAsset = { ...inventoryRecord, name: 'Design workstation updated' };
    let currentEquipment = [inventoryRecord];
    global.fetch.mockImplementation((url, options = {}) => {
      if (String(url).endsWith('/options')) {
        return Promise.resolve(jsonResponse({
          campuses: [{ id: 1, campusName: 'Main Campus' }],
          colleges: [{ id: 2, collegeName: 'Engineering College', campusId: 1 }],
          departments: [{ id: 3, collegeId: 2, name: 'ICT Services' }],
          buildings: [{ id: 4, campusId: 1, buildingName: 'Technology Hall' }],
          rooms: [{ id: 5, buildingId: 4, roomName: 'Room 204' }],
        }));
      }
      if (String(url).endsWith('/51') && options.method === 'PUT') {
        expect(JSON.parse(options.body).name).toBe('Design workstation updated');
        currentEquipment = [updatedAsset];
        return Promise.resolve(jsonResponse({ success: true, equipment: updatedAsset }));
      }
      if (String(url).endsWith('/51')) return Promise.resolve(jsonResponse({ success: true, equipment: inventoryRecord }));
      return Promise.resolve(jsonResponse({
        success: true,
        equipment: currentEquipment,
        total: currentEquipment.length,
        pagination: { page: 1, total: currentEquipment.length, totalPages: 1 },
      }));
    });
    render(<ICTEquipment />);
    await screen.findByText('Design workstation');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Design workstation' }));
    expect(await screen.findByRole('dialog', { name: 'Edit IT equipment' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Asset Name *'), { target: { value: 'Design workstation updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Design workstation updated')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/ict/equipment/51', expect.objectContaining({ method: 'PUT' }));
  });

  test('confirms deletion, calls the API, and refreshes the empty state', async () => {
    let deleted = false;
    global.fetch.mockImplementation((url, options = {}) => {
      if (options.method === 'DELETE') {
        deleted = true;
        return Promise.resolve(jsonResponse({ success: true }));
      }
      if (String(url).includes('/ict/equipment?')) {
        const currentEquipment = deleted ? [] : [inventoryRecord];
        return Promise.resolve(jsonResponse({
          success: true,
          equipment: currentEquipment,
          total: currentEquipment.length,
          pagination: { page: 1, total: currentEquipment.length, totalPages: 1 },
        }));
      }
      return Promise.resolve(jsonResponse({
        success: true,
        equipment: [inventoryRecord],
        total: 1,
        pagination: { page: 1, total: 1, totalPages: 1 },
      }));
    });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ICTEquipment />);
    await screen.findByText('Design workstation');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Design workstation' }));

    expect(confirm).toHaveBeenCalledWith('Are you sure you want to delete this IT equipment?');
    expect(global.fetch).toHaveBeenCalledWith('/api/ict/equipment/51', expect.objectContaining({ method: 'DELETE' }));
    expect(await screen.findByText('No IT equipment found')).toBeInTheDocument();
    confirm.mockRestore();
  });
});
