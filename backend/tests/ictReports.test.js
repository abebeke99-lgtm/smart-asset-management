const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Asset, Department, Incident, ServiceRequest, SoftwareLicense, SoftwareLicenseAssignment } = require('../src/models');
const { exportIctReport, getIctReports } = require('../src/controllers/ictReportController');

test('ICT equipment report queries college-scoped equipment assets and returns report rows', async () => {
  const originalFindAndCountAll = Asset.findAndCountAll;
  const originalAssetFindAll = Asset.findAll;
  const originalDepartmentFindAll = Department.findAll;
  let reportQuery;

  Asset.findAndCountAll = async (options) => {
    reportQuery = options;
    return {
      count: 1,
      rows: [{ toJSON: () => ({
        id: 41,
        assetCode: 'ICT-041',
        name: 'Laptop 41',
        category: 'computer',
        serialNumber: 'SER-041',
        manufacturer: 'Example manufacturer',
        model: 'Model 41',
        status: 'available',
        condition: 'Good',
        location: 'Main building',
        Assignments: [],
      }) }],
    };
  };
  Asset.findAll = async (options) => options.attributes.includes('status')
    ? [{ status: 'available' }]
    : [{ category: 'computer', status: 'available', condition: 'Good', location: 'Main building' }];
  Department.findAll = async () => [];

  try {
    let response;
    await getIctReports(
      { query: { type: 'equipment' }, organizationScope: { collegeId: 17, college: { collegeName: 'Test College' } } },
      { json: (value) => { response = value; } },
      (error) => { throw error; },
    );

    assert.equal(reportQuery.where.collegeId, 17);
    assert.ok(reportQuery.where[Op.and][0][Op.or].length > 0);
    assert.equal(response.reportType, 'equipment');
    assert.equal(response.data[0].assetTag, 'ICT-041');
    assert.equal(response.data[0].manufacturer, 'Example manufacturer');
    assert.equal(response.summary.totalEquipment, 1);
    assert.equal(response.pagination.total, 1);
  } finally {
    Asset.findAndCountAll = originalFindAndCountAll;
    Asset.findAll = originalAssetFindAll;
    Department.findAll = originalDepartmentFindAll;
  }
});

test('ICT network report queries college-scoped network assets and includes stored specifications', async () => {
  const originalFindAndCountAll = Asset.findAndCountAll;
  const originalAssetFindAll = Asset.findAll;
  const originalDepartmentFindAll = Department.findAll;
  let reportQuery;

  Asset.findAndCountAll = async (options) => {
    reportQuery = options;
    return {
      count: 1,
      rows: [{ toJSON: () => ({
        id: 52,
        assetCode: 'NET-052',
        name: 'Router 52',
        category: 'network router',
        serialNumber: 'NET-SER-052',
        manufacturer: 'Example manufacturer',
        model: 'Router model',
        specifications: { interfaces: 8 },
        status: 'available',
        condition: 'Good',
        location: 'Data center',
        Assignments: [],
      }) }],
    };
  };
  Asset.findAll = async (options) => options.attributes.includes('status')
    ? [{ status: 'available' }]
    : [{ category: 'network router', status: 'available', condition: 'Good', location: 'Data center' }];
  Department.findAll = async () => [];

  try {
    let response;
    await getIctReports(
      { query: { type: 'network' }, organizationScope: { collegeId: 17, college: { collegeName: 'Test College' } } },
      { json: (value) => { response = value; } },
      (error) => { throw error; },
    );

    const networkTerms = reportQuery.where[Op.and][0][Op.or];
    assert.equal(reportQuery.where.collegeId, 17);
    assert.ok(networkTerms.some((term) => term.category?.[Op.like] === '%router%'));
    assert.equal(response.reportType, 'network');
    assert.equal(response.data[0].assetTag, 'NET-052');
    assert.deepEqual(response.data[0].specifications, { interfaces: 8 });
    assert.equal(response.summary.totalNetworkEquipment, 1);
    assert.equal(response.pagination.total, 1);
  } finally {
    Asset.findAndCountAll = originalFindAndCountAll;
    Asset.findAll = originalAssetFindAll;
    Department.findAll = originalDepartmentFindAll;
  }
});

test('ICT software-license report returns scoped expiration status and active assignments without license keys', async () => {
  const originalLicenseFindAndCountAll = SoftwareLicense.findAndCountAll;
  const originalLicenseFindAll = SoftwareLicense.findAll;
  const originalAssignmentFindAll = SoftwareLicenseAssignment.findAll;
  let reportQuery;

  SoftwareLicense.findAndCountAll = async (options) => {
    reportQuery = options;
    return {
      count: 1,
      rows: [{ id: 9, toJSON: () => ({
        id: 9,
        softwareName: 'Office Suite',
        vendor: 'Example vendor',
        version: '2026',
        licenseType: 'Per Device',
        expiryDate: '2999-12-31',
        status: 'Active',
        quantity: 10,
        usedQuantity: 1,
      }) }],
    };
  };
  SoftwareLicense.findAll = async () => [{ softwareName: 'Office Suite', expiryDate: '2999-12-31', status: 'Active' }];
  SoftwareLicenseAssignment.findAll = async () => [{
    softwareLicenseId: 9,
    Asset: { assetCode: 'ICT-009', name: 'Computer 9' },
    User: { fullName: 'Test User', username: 'testuser' },
  }];

  try {
    let response;
    await getIctReports(
      { query: { type: 'software-licenses', search: 'Office', status: 'Active' }, organizationScope: { collegeId: 17, college: { collegeName: 'Test College' } } },
      { json: (value) => { response = value; } },
      (error) => { throw error; },
    );

    assert.equal(reportQuery.where.collegeId, 17);
    assert.equal(reportQuery.where.archivedAt, null);
    assert.deepEqual(reportQuery.where.status[Op.notIn], ['Suspended', 'Cancelled']);
    assert.ok(reportQuery.where[Op.or].some((term) => term.softwareName));
    assert.ok(!reportQuery.attributes.includes('licenseKey'));
    assert.equal(response.reportType, 'software-licenses');
    assert.equal(response.data[0].status, 'Active');
    assert.equal(response.data[0].expiryDate, '2999-12-31');
    assert.equal(response.data[0].assignedDevices, 'ICT-009');
    assert.equal(response.data[0].assignedUsers, 'Test User');
    assert.equal(response.summary.totalLicenses, 1);
    assert.equal(response.summary.active, 1);
  } finally {
    SoftwareLicense.findAndCountAll = originalLicenseFindAndCountAll;
    SoftwareLicense.findAll = originalLicenseFindAll;
    SoftwareLicenseAssignment.findAll = originalAssignmentFindAll;
  }
});

test('ICT support report scopes support requests and reports requester, assignee, and resolution', async () => {
  const originalFindAndCountAll = ServiceRequest.findAndCountAll;
  const originalFindAll = ServiceRequest.findAll;
  let reportQuery;
  const requests = [{ status: 'resolved' }, { status: 'open' }];

  ServiceRequest.findAndCountAll = async (options) => {
    reportQuery = options;
    return {
      count: 1,
      rows: [{
        id: 63,
        requestCode: 'TS-2026-000063',
        title: 'Network access issue',
        category: 'network',
        priority: 'high',
        status: 'resolved',
        createdAt: '2026-09-20T10:00:00.000Z',
        completedAt: '2026-09-21T12:00:00.000Z',
        resolutionSummary: 'Access point replaced',
        Reporter: { fullName: 'Requester Name', username: 'requester' },
        Assignee: { fullName: 'Technician Name', username: 'technician' },
        Asset: { name: 'Access Point', assetCode: 'NET-063' },
        DepartmentRecord: { name: 'ICT' },
      }],
    };
  };
  ServiceRequest.findAll = async () => requests;

  try {
    let response;
    await getIctReports(
      { query: { type: 'support', search: 'network', priority: 'high' }, organizationScope: { collegeId: 17, college: { collegeName: 'Test College' } } },
      { json: (value) => { response = value; } },
      (error) => { throw error; },
    );

    assert.equal(reportQuery.where.collegeId, 17);
    assert.equal(reportQuery.where.requestType, 'support');
    assert.equal(reportQuery.where.priority, 'high');
    assert.ok(reportQuery.include.some((item) => item.as === 'Reporter'));
    assert.ok(reportQuery.include.some((item) => item.as === 'Assignee'));
    assert.equal(response.reportType, 'support');
    assert.equal(response.data[0].requester, 'Requester Name');
    assert.equal(response.data[0].assignedTo, 'Technician Name');
    assert.equal(response.data[0].status, 'resolved');
    assert.equal(response.data[0].resolution, 'Access point replaced');
    assert.equal(response.summary.totalRequests, 2);
    assert.equal(response.summary.resolved, 1);
    assert.equal(response.summary.active, 1);
  } finally {
    ServiceRequest.findAndCountAll = originalFindAndCountAll;
    ServiceRequest.findAll = originalFindAll;
  }
});

test('ICT incident report scopes through existing college relations and includes resolution history', async () => {
  const originalFindAndCountAll = Incident.findAndCountAll;
  const originalFindAll = Incident.findAll;
  let reportQuery;

  Incident.findAndCountAll = async (options) => {
    reportQuery = options;
    return {
      count: 1,
      rows: [{
        id: 74,
        incidentNumber: 'INC-2026-000074',
        title: 'Campus network outage',
        category: 'network',
        status: 'resolved',
        priority: 'critical',
        reportedAt: '2026-09-22T08:00:00.000Z',
        resolvedAt: '2026-09-22T10:00:00.000Z',
        resolutionSummary: 'Core switch rebooted',
        Reporter: { fullName: 'Incident Reporter', username: 'reporter' },
        Technician: { fullName: 'Assigned Technician', username: 'technician' },
        Asset: { name: 'Core Switch', assetCode: 'NET-074' },
        DepartmentRecord: { name: 'ICT' },
        IncidentHistories: [{
          action: 'INCIDENT_RESOLVED',
          oldValue: 'investigating',
          newValue: 'resolved',
          createdAt: '2026-09-22T10:00:00.000Z',
          Actor: { fullName: 'Assigned Technician', username: 'technician' },
        }],
      }],
    };
  };
  Incident.findAll = async () => [{ status: 'resolved', priority: 'critical', category: 'network' }];

  try {
    let response;
    await getIctReports(
      { query: { type: 'incidents', search: 'switch', status: 'resolved', priority: 'critical' }, organizationScope: { collegeId: 17, college: { collegeName: 'Test College' } } },
      { json: (value) => { response = value; } },
      (error) => { throw error; },
    );

    assert.ok(reportQuery.where[Op.or].some((term) => term['$Reporter.collegeId$'] === 17));
    assert.ok(reportQuery.where[Op.or].some((term) => term['$Asset.collegeId$'] === 17));
    assert.equal(reportQuery.where.status, 'resolved');
    assert.equal(reportQuery.where.priority, 'critical');
    assert.ok(reportQuery.include.some((item) => item.model === require('../src/models').IncidentHistory && item.separate));
    assert.equal(response.reportType, 'incidents');
    assert.equal(response.data[0].priority, 'critical');
    assert.equal(response.data[0].assignedTo, 'Assigned Technician');
    assert.equal(response.data[0].resolution, 'Core switch rebooted');
    assert.match(response.data[0].history, /INCIDENT_RESOLVED/);
    assert.equal(response.summary.totalIncidents, 1);
    assert.equal(response.summary.critical, 1);
    assert.equal(response.summary.resolved, 1);
    assert.ok(response.filters.categories.includes('network'));
    assert.ok(response.filters.priorities.includes('critical'));
  } finally {
    Incident.findAndCountAll = originalFindAndCountAll;
    Incident.findAll = originalFindAll;
  }
});

test('ICT report CSV export uses scoped report data and omits license keys', async () => {
  const originalLicenseFindAndCountAll = SoftwareLicense.findAndCountAll;
  const originalLicenseFindAll = SoftwareLicense.findAll;
  const originalAssignmentFindAll = SoftwareLicenseAssignment.findAll;
  let reportQuery;
  const headers = {};
  let csv = '';

  SoftwareLicense.findAndCountAll = async (options) => {
    reportQuery = options;
    return { count: 1, rows: [{ id: 15, toJSON: () => ({
      id: 15,
      softwareName: 'Secure Suite',
      vendor: 'Vendor',
      version: '2.0',
      licenseType: 'Per User',
      expiryDate: '2999-12-31',
      status: 'Active',
      quantity: 3,
      usedQuantity: 1,
    }) }] };
  };
  SoftwareLicense.findAll = async () => [{ softwareName: 'Secure Suite', expiryDate: '2999-12-31', status: 'Active' }];
  SoftwareLicenseAssignment.findAll = async () => [];

  try {
    await exportIctReport(
      { query: { type: 'software-licenses' }, organizationScope: { collegeId: 17 } },
      { setHeader: (name, value) => { headers[name] = value; }, send: (value) => { csv = value; return value; } },
      (error) => { throw error; },
    );

    assert.equal(reportQuery.where.collegeId, 17);
    assert.match(headers['Content-Type'], /text\/csv/);
    assert.match(headers['Content-Disposition'], /ict-software-licenses-report\.csv/);
    assert.match(csv, /Secure Suite/);
    assert.match(csv, /expiryDate/);
    assert.doesNotMatch(csv, /licenseKey|license_key/);
  } finally {
    SoftwareLicense.findAndCountAll = originalLicenseFindAndCountAll;
    SoftwareLicense.findAll = originalLicenseFindAll;
    SoftwareLicenseAssignment.findAll = originalAssignmentFindAll;
  }
});