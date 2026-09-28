const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMaintenanceHistoryRows } = require('../controllers/maintenanceController');

test('buildMaintenanceHistoryRows aggregates real maintenance lifecycle data from authoritative tables', () => {
  const rows = buildMaintenanceHistoryRows({
    maintenanceRows: [{
      id: 101,
      assetId: 7,
      status: 'completed',
      title: 'Cooling system repair',
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T11:30:00Z',
      Asset: { id: 7, name: 'Air Handler', assetCode: 'AH-07', serialNumber: 'SN-1007', department: 'ICT', location: 'Server Room', category: 'HVAC', status: 'operational' },
      Technician: { fullName: 'Jane Technician' },
      Requester: { fullName: 'Ibrahim Admin' },
    }],
    workOrderRows: [{
      maintenanceId: 101,
      assetId: 7,
      workOrderNumber: 'WO-101',
      technicianId: 3,
      status: 'completed',
      actualCompletionDate: '2026-08-01T11:00:00Z',
      startDate: '2026-08-01T09:00:00Z',
      actualCost: '1200.00',
      requiredWork: 'Replace fan belt',
      Technician: { fullName: 'Jane Technician' },
    }],
    repairRows: [{
      maintenanceId: 101,
      assetId: 7,
      status: 'completed',
      technicianId: 3,
      repairAction: 'Replaced belt and calibrated airflow',
      partsCost: '220.00',
      laborCost: '350.00',
      totalCost: '570.00',
      completionDate: '2026-08-01T11:30:00Z',
      Technician: { fullName: 'Jane Technician' },
      WorkOrder: { workOrderNumber: 'WO-101' },
    }],
    preventiveRows: [],
    testRows: [{
      maintenanceId: 101,
      assetId: 7,
      overallResult: 'Passed',
      testerId: 4,
      testDate: '2026-08-01T11:10:00Z',
      Tester: { fullName: 'Test Technician' },
    }],
    qcRows: [{
      maintenanceId: 101,
      assetId: 7,
      decision: 'Approved',
      reviewDate: '2026-08-01T11:20:00Z',
      reviewerId: 8,
      Reviewer: { fullName: 'QC Reviewer' },
    }],
    costRows: [{
      maintenanceId: 101,
      assetId: 7,
      costCategory: 'parts',
      amount: '220.00',
    }, { maintenanceId: 101, assetId: 7, costCategory: 'labor', amount: '350.00' }],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].assetName, 'Air Handler');
  assert.equal(rows[0].maintenanceType, 'Corrective');
  assert.equal(rows[0].status, 'Completed');
  assert.equal(rows[0].workOrder, 'WO-101');
  assert.equal(rows[0].technician, 'Jane Technician');
  assert.equal(rows[0].testResult, 'Passed');
  assert.equal(rows[0].qcResult, 'Approved');
  assert.equal(rows[0].partsCost, 220);
  assert.equal(rows[0].laborCost, 350);
  assert.equal(rows[0].totalCost, 570);
  assert.equal(rows[0].duration, '2.50 hours');
});
