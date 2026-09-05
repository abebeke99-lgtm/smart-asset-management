import React from 'react';
import CollegeDashboard from './CollegeDashboard';
import DeptDashboard from '../department/DeptDashboard';
import DeptStaff from '../department/DeptStaff';
import DeptAssets from '../department/DeptAssets';
import DeptApprovals from '../department/DeptApprovals';
import DeptReports from '../department/DeptReports';
import DeptNotifications from '../department/DeptNotifications';
import DeptAssetHistory from '../department/DeptAssetHistory';

const sectionStyle = {
  width: '100%',
  minHeight: '100%' 
};

const CollegeSectionWrapper = ({ title, subtitle, children }) => (
  <div style={sectionStyle}>
    <div style={{
      marginBottom: '20px',
      padding: '18px 22px',
      borderRadius: '14px',
      background: 'linear-gradient(135deg, rgba(40,100,232,0.08), rgba(71,153,255,0.02))',
      border: '1px solid rgba(40,100,232,0.14)'
    }}>
      <h2 style={{ margin: '0 0 6px', fontSize: '1.8rem', fontWeight: 700, color: '#17305f' }}>{title}</h2>
      <div style={{ color: '#4a5568', fontSize: '0.95rem' }}>{subtitle}</div>
    </div>
    {children}
  </div>
);

const CollegeManagerPages = ({ section = 'dashboard' }) => {
  const sectionMap = {
    dashboard: (
      <CollegeSectionWrapper title="College Dashboard" subtitle="College-level asset, assignment, maintenance and approval overview.">
        <CollegeDashboard />
      </CollegeSectionWrapper>
    ),
    profile: (
      <CollegeSectionWrapper title="College Profile" subtitle="View, maintain and monitor the authorized college profile and operational statistics.">
        <DeptDashboard />
      </CollegeSectionWrapper>
    ),
    staff: (
      <CollegeSectionWrapper title="College Staff" subtitle="Staff records within the authorized college, with asset assignments and activity summaries.">
        <DeptStaff />
      </CollegeSectionWrapper>
    ),
    locations: (
      <CollegeSectionWrapper title="College Locations" subtitle="Buildings, offices, labs and storage locations managed for the college.">
        <DeptDashboard />
      </CollegeSectionWrapper>
    ),
    assets: (
      <CollegeSectionWrapper title="College Assets" subtitle="Authorized college assets, search, filters, location details and asset history.">
        <DeptAssets />
      </CollegeSectionWrapper>
    ),
    inventory: (
      <CollegeSectionWrapper title="College Inventory" subtitle="Inventory overview and reconciliation for authorized college assets.">
        <DeptReports />
      </CollegeSectionWrapper>
    ),
    requests: (
      <CollegeSectionWrapper title="Asset Requests" subtitle="Create, review, update and track requests for authorized college assets.">
        <DeptApprovals />
      </CollegeSectionWrapper>
    ),
    approvals: (
      <CollegeSectionWrapper title="Approvals" subtitle="Pending approvals and decision history across college asset workflows.">
        <DeptApprovals />
      </CollegeSectionWrapper>
    ),
    assignments: (
      <CollegeSectionWrapper title="College Assignments" subtitle="Assignment records, reassignment status and staff asset tracking.">
        <DeptAssets />
      </CollegeSectionWrapper>
    ),
    transfers: (
      <CollegeSectionWrapper title="Transfers" subtitle="Incoming and outgoing transfers, destinations and transfer tracking.">
        <DeptAssets />
      </CollegeSectionWrapper>
    ),
    returns: (
      <CollegeSectionWrapper title="Returns" subtitle="Returned assets, condition verification, receiving logs and return history.">
        <DeptAssets />
      </CollegeSectionWrapper>
    ),
    maintenance: (
      <CollegeSectionWrapper title="College Maintenance" subtitle="Maintenance work orders, alerts and maintenance history for college assets.">
        <DeptApprovals />
      </CollegeSectionWrapper>
    ),
    rfid: (
      <CollegeSectionWrapper title="RFID / QR Tracking" subtitle="Asset lookup, scan history and location tracking for authorized college assets.">
        <DeptAssets />
      </CollegeSectionWrapper>
    ),
    reports: (
      <CollegeSectionWrapper title="College Reports" subtitle="Asset, assignment, utilization and department comparison reports.">
        <DeptReports />
      </CollegeSectionWrapper>
    ),
    notifications: (
      <CollegeSectionWrapper title="Notifications" subtitle="Approval, request, transfer, maintenance and missing-asset alerts.">
        <DeptNotifications />
      </CollegeSectionWrapper>
    ),
    history: (
      <CollegeSectionWrapper title="Audit & History" subtitle="Activity, transfers, approvals, returns and maintenance history for the college.">
        <DeptAssetHistory />
      </CollegeSectionWrapper>
    ),
    departments: (
      <CollegeSectionWrapper title="Departments" subtitle="College departments, dean assignments and department-level operational details.">
        <DeptDashboard />
      </CollegeSectionWrapper>
    ),
    'department-deans': (
      <CollegeSectionWrapper title="Department Deans" subtitle="Department dean assignments, dean permissions and department leadership records.">
        <DeptDashboard />
      </CollegeSectionWrapper>
    ),
    'department-staff': (
      <CollegeSectionWrapper title="Department Staff" subtitle="Staff grouped by department within the college scope.">
        <DeptStaff />
      </CollegeSectionWrapper>
    ),
    'department-assets': (
      <CollegeSectionWrapper title="Department Assets" subtitle="Assets grouped by department, condition, status and maintenance status.">
        <DeptAssets />
      </CollegeSectionWrapper>
    ),
    'department-requests': (
      <CollegeSectionWrapper title="Department Requests" subtitle="Department-level requests, pending requests and request history.">
        <DeptApprovals />
      </CollegeSectionWrapper>
    ),
    'department-approvals': (
      <CollegeSectionWrapper title="Department Approvals" subtitle="Department approval workflows with pending items and audit history.">
        <DeptApprovals />
      </CollegeSectionWrapper>
    ),
    'department-assignments': (
      <CollegeSectionWrapper title="Department Assignments" subtitle="Department assignment tracking and staff assignment status.">
        <DeptAssets />
      </CollegeSectionWrapper>
    ),
    'department-transfers': (
      <CollegeSectionWrapper title="Department Transfers" subtitle="Incoming and outgoing department transfer tracking.">
        <DeptAssets />
      </CollegeSectionWrapper>
    ),
    'department-returns': (
      <CollegeSectionWrapper title="Department Returns" subtitle="Returned asset records and condition tracking by department.">
        <DeptAssets />
      </CollegeSectionWrapper>
    ),
    'department-maintenance': (
      <CollegeSectionWrapper title="Department Maintenance" subtitle="Maintenance requests, costs and maintenance status by department.">
        <DeptApprovals />
      </CollegeSectionWrapper>
    ),
    'department-reports': (
      <CollegeSectionWrapper title="Department Reports" subtitle="Department asset, inventory and maintenance reports with export support.">
        <DeptReports />
      </CollegeSectionWrapper>
    ),
    'department-history': (
      <CollegeSectionWrapper title="Department History" subtitle="Department activities and management changes with audit trail support.">
        <DeptAssetHistory />
      </CollegeSectionWrapper>
    )
  };

  return <>{sectionMap[section] || sectionMap.dashboard}</>;
};

export default CollegeManagerPages;
export { CollegeManagerPages };
