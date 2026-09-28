/**
 * Centralized status constants for the Smart University Asset Management System.
 * These are the authoritative status values used across all frontend modules.
 * Must match backend/src/constants/statuses.js
 */

// Asset lifecycle statuses
export const ASSET_STATUSES = {
  AVAILABLE: 'available',
  ASSIGNED: 'assigned',
  IN_USE: 'in-use',
  UNDER_MAINTENANCE: 'under-maintenance',
  IN_REPAIR: 'in-repair',
  TESTING: 'testing',
  QUALITY_CONTROL: 'quality-control',
  AWAITING_INSPECTION: 'awaiting-inspection',
  WORK_ORDER_CREATED: 'work-order-created',
  WAITING_FOR_PARTS: 'waiting-for-parts',
  WAITING_FOR_VENDOR: 'waiting-for-vendor',
  READY_FOR_RETURN: 'ready-for-return',
  RETURNED_TO_SERVICE: 'returned-to-service',
  DAMAGED: 'damaged',
  LOST: 'lost',
  MISSING: 'missing',
  DISPOSED: 'disposed',
  RETIRED: 'retired',
};

// Maintenance request statuses
export const MAINTENANCE_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in-progress',
  WAITING_FOR_PARTS: 'waiting-for-parts',
  TESTING: 'testing',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

// Work order statuses
export const WORK_ORDER_STATUSES = {
  DRAFT: 'draft',
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in-progress',
  ON_HOLD: 'on-hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Repair statuses
export const REPAIR_STATUSES = {
  OPEN: 'open',
  ASSIGNED: 'assigned',
  DIAGNOSING: 'diagnosing',
  IN_PROGRESS: 'in-progress',
  WAITING_FOR_PARTS: 'waiting-for-parts',
  TESTING: 'testing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REWORK: 'rework',
  CANCELLED: 'cancelled',
};

// Preventive maintenance statuses
export const PREVENTIVE_STATUSES = {
  SCHEDULED: 'scheduled',
  DUE: 'due',
  OVERDUE: 'overdue',
  IN_PROGRESS: 'in-progress',
  WAITING_FOR_PARTS: 'waiting-for-parts',
  AWAITING_TESTING: 'awaiting-testing',
  AWAITING_QUALITY_CONTROL: 'awaiting-quality-control',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

// Testing statuses
export const TESTING_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  PASSED: 'passed',
  FAILED: 'failed',
  RETEST_REQUIRED: 'retest-required',
  AWAITING_QUALITY_CONTROL: 'awaiting-quality-control',
};

// Quality control statuses
export const QC_STATUSES = {
  PENDING: 'pending',
  IN_REVIEW: 'in-review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CONDITIONAL_APPROVAL: 'conditional-approval',
  RETEST_REQUIRED: 'retest-required',
  READY_FOR_RETURN: 'ready-for-return',
};

// Generic entity statuses
export const ENTITY_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  COMPLETED: 'completed',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

// User statuses
export const USER_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

// Notification statuses
export const NOTIFICATION_STATUSES = {
  SCHEDULED: 'scheduled',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  READ: 'read',
  UNREAD: 'unread',
};

// Inventory statuses
export const INVENTORY_STATUSES = {
  IN_STOCK: 'in-stock',
  LOW_STOCK: 'low-stock',
  OUT_OF_STOCK: 'out-of-stock',
  RESERVED: 'reserved',
};

// Priority levels
export const PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Status label mappings for display
export const STATUS_LABELS = {
  [ASSET_STATUSES.AVAILABLE]: 'Available',
  [ASSET_STATUSES.ASSIGNED]: 'Assigned',
  [ASSET_STATUSES.IN_USE]: 'In Use',
  [ASSET_STATUSES.UNDER_MAINTENANCE]: 'Under Maintenance',
  [ASSET_STATUSES.IN_REPAIR]: 'In Repair',
  [ASSET_STATUSES.TESTING]: 'Testing',
  [ASSET_STATUSES.QUALITY_CONTROL]: 'Quality Control',
  [ASSET_STATUSES.AWAITING_INSPECTION]: 'Awaiting Inspection',
  [ASSET_STATUSES.WORK_ORDER_CREATED]: 'Work Order Created',
  [ASSET_STATUSES.WAITING_FOR_PARTS]: 'Waiting for Parts',
  [ASSET_STATUSES.WAITING_FOR_VENDOR]: 'Waiting for Vendor',
  [ASSET_STATUSES.READY_FOR_RETURN]: 'Ready for Return',
  [ASSET_STATUSES.RETURNED_TO_SERVICE]: 'Returned to Service',
  [ASSET_STATUSES.DAMAGED]: 'Damaged',
  [ASSET_STATUSES.LOST]: 'Lost',
  [ASSET_STATUSES.MISSING]: 'Missing',
  [ASSET_STATUSES.DISPOSED]: 'Disposed',
  [ASSET_STATUSES.RETIRED]: 'Retired',
  [MAINTENANCE_STATUSES.PENDING]: 'Pending',
  [MAINTENANCE_STATUSES.APPROVED]: 'Approved',
  [MAINTENANCE_STATUSES.ASSIGNED]: 'Assigned',
  [MAINTENANCE_STATUSES.IN_PROGRESS]: 'In Progress',
  [MAINTENANCE_STATUSES.WAITING_FOR_PARTS]: 'Waiting for Parts',
  [MAINTENANCE_STATUSES.TESTING]: 'Testing',
  [MAINTENANCE_STATUSES.COMPLETED]: 'Completed',
  [MAINTENANCE_STATUSES.REJECTED]: 'Rejected',
  [MAINTENANCE_STATUSES.CANCELLED]: 'Cancelled',
  [WORK_ORDER_STATUSES.DRAFT]: 'Draft',
  [WORK_ORDER_STATUSES.OPEN]: 'Open',
  [WORK_ORDER_STATUSES.ASSIGNED]: 'Assigned',
  [WORK_ORDER_STATUSES.IN_PROGRESS]: 'In Progress',
  [WORK_ORDER_STATUSES.ON_HOLD]: 'On Hold',
  [WORK_ORDER_STATUSES.COMPLETED]: 'Completed',
  [WORK_ORDER_STATUSES.CANCELLED]: 'Cancelled',
  [REPAIR_STATUSES.OPEN]: 'Open',
  [REPAIR_STATUSES.ASSIGNED]: 'Assigned',
  [REPAIR_STATUSES.DIAGNOSING]: 'Diagnosing',
  [REPAIR_STATUSES.IN_PROGRESS]: 'In Progress',
  [REPAIR_STATUSES.WAITING_FOR_PARTS]: 'Waiting for Parts',
  [REPAIR_STATUSES.TESTING]: 'Testing',
  [REPAIR_STATUSES.COMPLETED]: 'Completed',
  [REPAIR_STATUSES.FAILED]: 'Failed',
  [REPAIR_STATUSES.REWORK]: 'Rework',
  [REPAIR_STATUSES.CANCELLED]: 'Cancelled',
  [PREVENTIVE_STATUSES.SCHEDULED]: 'Scheduled',
  [PREVENTIVE_STATUSES.DUE]: 'Due',
  [PREVENTIVE_STATUSES.OVERDUE]: 'Overdue',
  [PREVENTIVE_STATUSES.IN_PROGRESS]: 'In Progress',
  [PREVENTIVE_STATUSES.WAITING_FOR_PARTS]: 'Waiting for Parts',
  [PREVENTIVE_STATUSES.AWAITING_TESTING]: 'Awaiting Testing',
  [PREVENTIVE_STATUSES.AWAITING_QUALITY_CONTROL]: 'Awaiting Quality Control',
  [PREVENTIVE_STATUSES.COMPLETED]: 'Completed',
  [PREVENTIVE_STATUSES.FAILED]: 'Failed',
  [PREVENTIVE_STATUSES.CANCELLED]: 'Cancelled',
  [TESTING_STATUSES.PENDING]: 'Pending',
  [TESTING_STATUSES.IN_PROGRESS]: 'In Progress',
  [TESTING_STATUSES.PASSED]: 'Passed',
  [TESTING_STATUSES.FAILED]: 'Failed',
  [TESTING_STATUSES.RETEST_REQUIRED]: 'Retest Required',
  [TESTING_STATUSES.AWAITING_QUALITY_CONTROL]: 'Awaiting Quality Control',
  [QC_STATUSES.PENDING]: 'Pending',
  [QC_STATUSES.IN_REVIEW]: 'In Review',
  [QC_STATUSES.APPROVED]: 'Approved',
  [QC_STATUSES.REJECTED]: 'Rejected',
  [QC_STATUSES.CONDITIONAL_APPROVAL]: 'Conditional Approval',
  [QC_STATUSES.RETEST_REQUIRED]: 'Retest Required',
  [QC_STATUSES.READY_FOR_RETURN]: 'Ready for Return',
  [ENTITY_STATUSES.ACTIVE]: 'Active',
  [ENTITY_STATUSES.INACTIVE]: 'Inactive',
  [ENTITY_STATUSES.PENDING]: 'Pending',
  [ENTITY_STATUSES.COMPLETED]: 'Completed',
  [ENTITY_STATUSES.APPROVED]: 'Approved',
  [ENTITY_STATUSES.REJECTED]: 'Rejected',
  [ENTITY_STATUSES.CANCELLED]: 'Cancelled',
  [USER_STATUSES.ACTIVE]: 'Active',
  [USER_STATUSES.INACTIVE]: 'Inactive',
  [USER_STATUSES.SUSPENDED]: 'Suspended',
  [NOTIFICATION_STATUSES.SCHEDULED]: 'Scheduled',
  [NOTIFICATION_STATUSES.SENT]: 'Sent',
  [NOTIFICATION_STATUSES.DELIVERED]: 'Delivered',
  [NOTIFICATION_STATUSES.FAILED]: 'Failed',
  [NOTIFICATION_STATUSES.READ]: 'Read',
  [NOTIFICATION_STATUSES.UNREAD]: 'Unread',
  [INVENTORY_STATUSES.IN_STOCK]: 'In Stock',
  [INVENTORY_STATUSES.LOW_STOCK]: 'Low Stock',
  [INVENTORY_STATUSES.OUT_OF_STOCK]: 'Out of Stock',
  [INVENTORY_STATUSES.RESERVED]: 'Reserved',
};

// Priority labels
export const PRIORITY_LABELS = {
  [PRIORITIES.LOW]: 'Low',
  [PRIORITIES.MEDIUM]: 'Medium',
  [PRIORITIES.HIGH]: 'High',
  [PRIORITIES.CRITICAL]: 'Critical',
};
