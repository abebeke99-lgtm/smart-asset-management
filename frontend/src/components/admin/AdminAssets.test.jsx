import { buildLocationHierarchy, formatDate, getRegistrationChecks, normalizeAssetRecord } from './AdminAssets';

describe('AdminAssets data shaping', () => {
  it('normalizes real backend asset rows into table fields', () => {
    const asset = normalizeAssetRecord({
      id: 17,
      name: 'Dell OptiPlex 7090',
      category: 'Computing',
      serialNumber: 'ABC-124',
      assetCode: 'MAU-GEN-2026-0001',
      status: 'under-maintenance',
      purchaseDate: '2024-02-01',
      quantity: 1,
      department: 'ICT',
      location: 'Laboratory 204',
      fundingSource: 'Research Fund',
      warrantyExpiry: '2027-05-20',
      qrCode: 'QR-ASSET-17',
      rfidTag: 'RFID-17',
      campusId: 1,
      buildingId: 2,
      roomId: 3,
      CampusRecord: { campusName: 'Main Campus' },
      BuildingRecord: { buildingName: 'Science Building' },
      RoomRecord: { roomName: 'Laboratory 204', roomType: 'laboratory' },
      AssignmentRecord: { User: { fullName: 'Aster Bekele' } },
      AssetDocument: [{ documentType: 'manual', fileName: 'manual.pdf' }],
      GrantRecord: { name: 'Research Grant' },
      WarrantyInfo: { provider: 'Dell', status: 'Active' },
    });

    expect(asset.id).toBe(17);
    expect(asset.assetId).toBe('MAU-GEN-2026-0001');
    expect(asset.name).toBe('Dell OptiPlex 7090');
    expect(asset.category).toBe('Computing');
    expect(asset.status).toBe('Under Maintenance');
    expect(asset.warranty).toContain('Active');
    expect(asset.manualLabel).toBe('View Manual');
    expect(asset.campus).toBe('Main Campus');
    expect(asset.laboratory).toBe('Laboratory 204');
    expect(asset.building).toBe('Science Building');
    expect(asset.room).toBe('Laboratory 204');
    expect(asset.qrValue).toBe('QR-ASSET-17');
  });

  it('uses one abbreviated English date format for all dates', () => {
    expect(formatDate('2026-09-15')).toBe('15 Sep 2026');
  });

  it('builds a readable campus-to-room hierarchy', () => {
    expect(buildLocationHierarchy({
      CampusRecord: { campusName: 'Main Campus' },
      College: { name: 'College of Science' },
      DepartmentRecord: { name: 'ICT' },
      LaboratoryRecord: { name: 'Computer Lab' },
      BuildingRecord: { buildingName: 'Science Building' },
      RoomRecord: { roomName: 'Laboratory 204' },
    })).toBe('Main Campus → College of Science → ICT → Computer Lab → Science Building → Laboratory 204');
  });

  it('reads flat location hierarchy fields and skips missing levels', () => {
    expect(buildLocationHierarchy({
      campus_name: 'Main Campus',
      college_name: 'College of Science',
      department_name: 'ICT',
      laboratory_name: 'Computer Lab',
      room_name: 'Room 204',
    })).toBe('Main Campus → College of Science → ICT → Computer Lab → Room 204');
  });

  it('tracks every required registration field including grant, warranty, and manual', () => {
    const emptyChecks = getRegistrationChecks({});
    expect(emptyChecks).toHaveLength(15);
    expect(emptyChecks.filter((item) => item.complete)).toHaveLength(0);

    const completeChecks = getRegistrationChecks({
      name: 'Lab microscope',
      category: 'Scientific equipment',
      serialNumber: 'MIC-001',
      quantity: '1',
      purchaseDate: '2025-01-01',
      campusId: '1',
      collegeId: '2',
      departmentId: '3',
      laboratoryId: '4',
      buildingId: '5',
      roomId: '6',
      status: 'available',
      fundingSource: 'Grant 2025',
      warrantyCoverage: 'none',
      equipmentManual: { name: 'manual.pdf' },
    });
    expect(completeChecks.filter((item) => item.complete)).toHaveLength(15);
  });

  it('treats the no-research-grant choice as satisfying the required grant check', () => {
    expect(getRegistrationChecks({ noResearchGrant: true }).find((item) => item.label === 'Research Grant').complete).toBe(true);
  });
});
