const PERMISSIONS = [
  'users.view', 'users.create', 'users.update', 'users.delete', 'users.activate', 'users.deactivate', 'users.lock', 'users.unlock',
  'roles.view', 'roles.manage', 'permissions.view', 'permissions.manage',
  'assets.view', 'assets.create', 'assets.update', 'assets.delete', 'assets.assign', 'assets.transfer', 'assets.transfer.approve', 'assets.return', 'assets.dispose',
  'inventory.view', 'inventory.stock_in', 'inventory.stock_out', 'inventory.stock_movement',
  'colleges.view', 'colleges.manage', 'departments.view', 'departments.manage', 'locations.view', 'locations.manage',
  'notifications.view', 'notifications.manage', 'reports.view', 'reports.generate', 'reports.export', 'reports.print',
  'audit.view', 'audit.export',
  'settings.view', 'settings.manage', 'system.monitor', 'backup.manage', 'backup.restore',
  'financial.view', 'maintenance.view', 'maintenance.request.create', 'maintenance.technician.assign', 'maintenance.update', 'maintenance.complete', 'rfid.view',
  'college.dashboard.view', 'college.profile.view', 'college.profile.update', 'college.staff.view',
  'department.profile.view', 'department.profile.update',
  'department_head.history.view',
  'college.locations.view', 'college.locations.manage', 'college.departments.view',
  'college.assets.view', 'college.assets.create', 'college.assets.update', 'college.assets.export', 'college.assets.delete', 'college.assets.restore',
  'college.documents.manage', 'college.history.view', 'college.grants.view', 'college.inventory.view', 'college.chemicals.view',
  'college.requests.view', 'college.requests.review', 'college.approvals.view', 'college.approvals.approve', 'college.approvals.reject',
  'college.approvals.request_changes', 'college.approvals.escalate', 'college.assignments.view', 'college.assignments.manage',
  'college.transfers.view', 'college.transfers.manage', 'college.returns.view', 'college.returns.manage',
  'college.maintenance.view', 'college.service.view', 'college.rfid.view', 'college.verification.view',
  'college.verification.manage', 'college.reports.view', 'college.reports.export', 'college.analytics.view',
  'college.notifications.view',
  'department_head.approvals.review', 'department_head.approvals.approve', 'department_head.approvals.reject',
  'department_head.approvals.request_changes', 'department_head.approvals.escalate',
  'department_head.tickets.view', 'department_head.tickets.follow_up',
  'department_head.returns.view', 'department_head.returns.manage',
  'ict.dashboard.view', 'ict.assets.view', 'ict.assets.create', 'ict.assets.update', 'ict.assets.assign',
  'ict.assets.transfer', 'ict.assets.qr', 'ict.assets.rfid', 'ict.assets.retire', 'ict.assets.export', 'ict.assets.delete',
  'ict.inventory.view', 'ict.inventory.import', 'ict.maintenance.view', 'ict.maintenance.create',
  'ict.devicehealth.view', 'ict.tracking.view', 'ict.history.view', 'ict.analytics.view',
  'ict.reports.view', 'ict.reports.export', 'ict.network.view', 'ict.network.manage',
  'ict.softwarelicenses.view', 'ict.softwarelicenses.manage', 'ict.support.view', 'ict.support.manage',
  'ict.incidents.view', 'ict.incidents.manage', 'ict.notifications.view',
];

const ROLE_NAMES = [
  'admin',
  'ict_officer',
  'college',
  'college_manager',
  'department_head',
  'finance',
  'store_manager',
  'maintenance',
  'infrastructure',
  'teaching_assistant',
  'staff',
  'student',
];

const normalizeRoleForStorage = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'dept_head' ? 'department_head' : normalized;
};

const DEFAULT_ROLE_PERMISSIONS = {
  admin: PERMISSIONS,
  ict_officer: ['ict.dashboard.view', 'ict.assets.view', 'ict.assets.create', 'ict.assets.update', 'ict.assets.assign', 'ict.assets.transfer', 'ict.assets.qr', 'ict.assets.rfid', 'ict.assets.retire', 'ict.assets.export', 'ict.inventory.view', 'ict.inventory.import', 'ict.maintenance.view', 'ict.maintenance.create', 'ict.devicehealth.view', 'ict.tracking.view', 'ict.history.view', 'ict.analytics.view', 'ict.reports.view', 'ict.reports.export', 'ict.network.view', 'ict.network.manage', 'ict.softwarelicenses.view', 'ict.softwarelicenses.manage', 'ict.support.view', 'ict.support.manage', 'ict.incidents.view', 'ict.incidents.manage', 'ict.notifications.view'],
  college: ['college.dashboard.view', 'college.assets.view', 'college.requests.view', 'college.assignments.view', 'college.notifications.view'],
  college_manager: ['college.dashboard.view', 'college.profile.view', 'college.profile.update', 'college.staff.view', 'college.locations.view', 'college.locations.manage', 'college.departments.view', 'college.assets.view', 'college.assets.create', 'college.assets.update', 'college.assets.export', 'college.assets.delete', 'college.assets.restore', 'college.documents.manage', 'college.history.view', 'college.grants.view', 'college.inventory.view', 'college.chemicals.view', 'college.requests.view', 'college.requests.review', 'college.approvals.view', 'college.approvals.approve', 'college.approvals.reject', 'college.approvals.request_changes', 'college.approvals.escalate', 'college.assignments.view', 'college.assignments.manage', 'college.transfers.view', 'college.transfers.manage', 'assets.transfer.approve', 'college.returns.view', 'college.returns.manage', 'college.maintenance.view', 'college.service.view', 'college.rfid.view', 'college.verification.view', 'college.verification.manage', 'college.reports.view', 'college.reports.export', 'college.analytics.view', 'college.notifications.view'],
  department_head: ['assets.view', 'assets.assign', 'assets.transfer', 'users.view', 'reports.view', 'department.profile.view', 'department.profile.update', 'department_head.history.view', 'department_head.maintenance.view', 'department_head.approvals.review', 'department_head.approvals.approve', 'department_head.approvals.reject', 'department_head.approvals.request_changes', 'department_head.approvals.escalate', 'department_head.tickets.view', 'department_head.tickets.follow_up', 'department_head.returns.view', 'department_head.returns.manage'],
  finance: ['assets.view', 'financial.view', 'reports.view', 'reports.generate', 'reports.export', 'reports.print'],
  store_manager: ['assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.transfer', 'inventory.view', 'inventory.stock_in', 'inventory.stock_out', 'inventory.stock_movement', 'rfid.view', 'reports.view'],
  maintenance: ['assets.view', 'maintenance.view', 'maintenance.request.create', 'maintenance.technician.assign', 'maintenance.update', 'maintenance.complete', 'reports.view'],
  infrastructure: ['assets.view', 'reports.view'],
  teaching_assistant: ['assets.view'],
  staff: ['assets.view'],
  student: ['assets.view'],
};

module.exports = { PERMISSIONS, ROLE_NAMES, DEFAULT_ROLE_PERMISSIONS, normalizeRoleForStorage };
