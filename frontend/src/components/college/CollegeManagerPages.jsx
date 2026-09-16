import React from 'react';
import CollegeDashboard from './CollegeDashboard';
import DeptDashboard from '../department/DeptDashboard';
import DeptStaff from '../department/DeptStaff';
import DeptAssets from '../department/DeptAssets';
import DeptApprovals from '../department/DeptApprovals';
import DeptReports from '../department/DeptReports';
import DeptNotifications from '../department/DeptNotifications';
import DeptAssetHistory from '../department/DeptAssetHistory';
import './CollegeDashboard.css';
import CollegeDepartments from './CollegeDepartments';
import ScopedWorkflowPage from '../shared/ScopedWorkflowPage';
import CollegeProfile from './CollegeProfile';
import CollegeStaff from './CollegeStaff';
import CollegeLocations from './CollegeLocations';
import CollegeDepartmentOverview from './CollegeDepartmentOverview';
import CollegeDepartmentPerformance from './CollegeDepartmentPerformance';
import CollegeAssets from './CollegeAssets';
import CollegeDepartmentAssets from './CollegeDepartmentAssets';
import CollegeRequests from './CollegeRequests';
import CollegeDepartmentRequests from './CollegeDepartmentRequests';
import CollegeApprovals from './CollegeApprovals';
import CollegeAssignments from './CollegeAssignments';
import CollegeVerification from './CollegeVerification';
import CollegeMaintenance from './CollegeMaintenance';
import CollegeNotifications from './CollegeNotifications';
import CollegeReports from './CollegeReports';
import CollegeAssetAnalytics from './CollegeAssetAnalytics';

const CollegeSectionWrapper = ({ title, subtitle, children }) => (
  <div className="college-section-wrapper">
    <div className="college-section-header">
      <h2>{title}</h2>
      <div>{subtitle}</div>
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
        <CollegeProfile />
      </CollegeSectionWrapper>
    ),
    staff: (
      <CollegeSectionWrapper title="College Staff" subtitle="Staff records within the authorized college, with asset assignments and activity summaries.">
        <CollegeStaff />
      </CollegeSectionWrapper>
    ),
    locations: (
      <CollegeSectionWrapper title="College Locations" subtitle="Manage buildings, rooms, and asset locations within your college.">
        <CollegeLocations />
      </CollegeSectionWrapper>
    ),
    verification: (
      <CollegeSectionWrapper title="Asset Verification" subtitle="Physical verification, discrepancies, inspection results and audit trail for the authorized college.">
        <CollegeVerification />
      </CollegeSectionWrapper>
    ),
    assets: <CollegeAssets />,
    inventory: <CollegeAssets inventory />,
    requests: <CollegeRequests />,
    approvals: (
      <CollegeApprovals />
    ),
    assignments: <CollegeAssignments />,
    transfers: <ScopedWorkflowPage scope="college" type="transfers" />,
    returns: <ScopedWorkflowPage scope="college" type="returns" />,
    maintenance: <CollegeMaintenance />,
    rfid: (
      <CollegeSectionWrapper title="RFID / QR Tracking" subtitle="Asset lookup, scan history and location tracking for authorized college assets.">
        <DeptAssets />
      </CollegeSectionWrapper>
    ),
    reports: (
      <CollegeSectionWrapper title="College Reports" subtitle="College-scoped operational reports for assets, assignments, maintenance, transfers, verification and requests.">
        <CollegeReports />
      </CollegeSectionWrapper>
    ),
    'analytics-assets': (
      <CollegeSectionWrapper title="Asset Analytics" subtitle="College-scoped asset utilization, status distribution, maintenance trends and operational health.">
        <CollegeAssetAnalytics />
      </CollegeSectionWrapper>
    ),
    notifications: (
      <CollegeSectionWrapper title="Notifications" subtitle="Approval, request, transfer, maintenance and college activity alerts.">
        <CollegeNotifications />
      </CollegeSectionWrapper>
    ),
    history: (
      <CollegeSectionWrapper title="Audit & History" subtitle="Activity, transfers, approvals, returns and maintenance history for the college.">
        <DeptAssetHistory />
      </CollegeSectionWrapper>
    ),
    departments: <CollegeDepartmentOverview />,
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
        <CollegeDepartmentAssets />
      </CollegeSectionWrapper>
    ),
    'department-requests': (
      <CollegeSectionWrapper title="Department Requests" subtitle="Department-level requests, pending requests and request history.">
        <CollegeDepartmentRequests />
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
    'department-performance': (
      <CollegeSectionWrapper title="Department Performance" subtitle="Operational asset, request and maintenance activity across departments in the authorized college.">
        <CollegeDepartmentPerformance />
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
