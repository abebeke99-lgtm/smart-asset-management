/**
 * Centralized status constants for the Smart University Asset Management System.
 * These are the authoritative status values used across all modules.
 */

// Asset lifecycle statuses
const ASSET_STATUSES = {
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
const MAINTENANCE_STATUSES = {
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
const WORK_ORDER_STATUSES = {
  DRAFT: 'draft',
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in-progress',
  ON_HOLD: 'on-hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Repair statuses
const REPAIR_STATUSES = {
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
const PREVENTIVE_STATUSES = {
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
const TESTING_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  PASSED: 'passed',
  FAILED: 'failed',
  RETEST_REQUIRED: 'retest-required',
  AWAITING_QUALITY_CONTROL: 'awaiting-quality-control',
};

// Quality control statuses
const QC_STATUSES = {
  PENDING: 'pending',
  IN_REVIEW: 'in-review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CONDITIONAL_APPROVAL: 'conditional-approval',
  RETEST_REQUIRED: 'retest-required',
  READY_FOR_RETURN: 'ready-for-return',
};

// Generic entity statuses
const ENTITY_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  COMPLETED: 'completed',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

// User statuses
const USER_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

// Notification statuses
const NOTIFICATION_STATUSES = {
  SCHEDULED: 'scheduled',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  READ: 'read',
  UNREAD: 'unread',
};

// Inventory statuses
const INVENTORY_STATUSES = {
  IN_STOCK: 'in-stock',
  LOW_STOCK: 'low-stock',
  OUT_OF_STOCK: 'out-of-stock',
  RESERVED: 'reserved',
};

// Priority levels
const PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Audit actions
const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  ASSIGN: 'ASSIGN',
  STATUS_CHANGE: 'STATUS_CHANGE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  EXPORT: 'EXPORT',
};

module.exports = {
  ASSET_STATUSES,
  MAINTENANCE_STATUSES,
  WORK_ORDER_STATUSES,
  REPAIR_STATUSES,
  PREVENTIVE_STATUSES,
  TESTING_STATUSES,
  QC_STATUSES,
  ENTITY_STATUSES,
  USER_STATUSES,
  NOTIFICATION_STATUSES,
  INVENTORY_STATUSES,
  PRIORITIES,
  AUDIT_ACTIONS,
};
