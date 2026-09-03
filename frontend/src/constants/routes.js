// Route Constants
// Define all application routes

export const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/home',
  '/about',
  '/contact'
];

export const ROUTES = {
  // Public Routes
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  HOME: '/home',
  ABOUT: '/about',
  CONTACT: '/contact',

  // Admin Routes
  ADMIN_DASHBOARD: '/admin',
  ADMIN_ASSETS: '/admin/assets',
  ADMIN_CREATE_ASSET: '/admin/assets/create',
  ADMIN_ASSIGNMENT: '/admin/assets/assign',
  ADMIN_TRANSFER: '/admin/assets/transfer',
  ADMIN_MAINTENANCE: '/admin/maintenance',
  ADMIN_RFID: '/admin/rfid',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_USERS: '/admin/users',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_NOTIFICATIONS: '/admin/notifications',
  ADMIN_BACKUP: '/admin/backup',
  ADMIN_DEPARTMENTS: '/admin/departments',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',

  // ICT Officer Routes
  ICT_DASHBOARD: '/ict',
  ICT_ASSETS: '/ict/assets',
  ICT_CREATE_ASSET: '/ict/assets/create',
  ICT_ASSIGNMENTS: '/ict/assets/assign',
  ICT_MAINTENANCE: '/ict/maintenance',
  ICT_RFID: '/ict/rfid',
  ICT_REPORTS: '/ict/reports',
  ICT_INVENTORY: '/ict/inventory',
  ICT_NOTIFICATIONS: '/ict/notifications',
  ICT_ASSET_HISTORY: '/ict/assets/history',

  // College Routes
  DEPT_DASHBOARD: '/college',
  DEPT_PROFILE: '/college/profile',
  DEPT_ASSETS: '/college/assets',
  DEPT_REQUESTS: '/college/requests',
  DEPT_APPROVALS: '/college/approvals',
  DEPT_ASSIGNMENTS: '/college/assignments',
  DEPT_TRANSFERS: '/college/transfers',
  DEPT_RETURNS: '/college/returns',
  DEPT_MAINTENANCE: '/college/maintenance',
  DEPT_RFID: '/college/rfid',
  DEPT_REPORTS: '/college/reports',
  DEPT_STAFF: '/college/staff',
  DEPT_NOTIFICATIONS: '/college/notifications',
  DEPT_ASSET_HISTORY: '/college/history',

  // Finance Routes
  FINANCE_DASHBOARD: '/finance',
  FINANCE_PURCHASES: '/finance/purchases',
  FINANCE_INVOICES: '/finance/invoices',
  FINANCE_PAYMENTS: '/finance/payments',
  FINANCE_BUDGET: '/finance/budget',
  FINANCE_VALUATION: '/finance/valuation',
  FINANCE_DEPRECIATION: '/finance/depreciation',
  FINANCE_SUPPLIERS: '/finance/suppliers',
  FINANCE_REPORTS: '/finance/reports',
  FINANCE_TRANSACTIONS: '/finance/transactions',
  FINANCE_AUDIT: '/finance/audit',
  FINANCE_NOTIFICATIONS: '/finance/notifications',

  // Maintenance Routes
  MAINT_DASHBOARD: '/maintenance',
  MAINT_REQUESTS: '/maintenance/requests',
  MAINT_INSPECTION: '/maintenance/inspection',
  MAINT_WORK_ORDERS: '/maintenance/work-orders',
  MAINT_REPAIRS: '/maintenance/repairs',
  MAINT_PREVENTIVE: '/maintenance/preventive',
  MAINT_TECHNICIANS: '/maintenance/technicians',
  MAINT_PARTS: '/maintenance/parts',
  MAINT_ASSETS: '/maintenance/assets',
  MAINT_TESTING: '/maintenance/testing',
  MAINT_ASSIGNED: '/maintenance/assigned',
  MAINT_HISTORY: '/maintenance/history',
  MAINT_REPORTS: '/maintenance/reports',
  MAINT_NOTIFICATIONS: '/maintenance/notifications',

  // Store Routes
  STORE_DASHBOARD: '/store',
  STORE_INVENTORY: '/store/inventory',
  STORE_ASSETS: '/store/assets',
  STORE_RECEIVE: '/store/receive',
  STORE_ISSUE: '/store/issue',
  STORE_RETURNS: '/store/returns',
  STORE_TRANSFERS: '/store/transfers',
  STORE_REPORTS: '/store/reports',
  STORE_NOTIFICATIONS: '/store/notifications',
  STORE_HISTORY: '/store/history',

  // Shared Routes
  ASSETS: '/assets',
  ASSET_DETAILS: '/assets/:id',
  REPORTS: '/reports',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',
  PROFILE: '/profile'
};

export const getRoutesByRole = (role) => {
  const routesByRole = {
    admin: [
      ROUTES.ADMIN_DASHBOARD,
      ROUTES.ADMIN_ASSETS,
      ROUTES.ADMIN_CREATE_ASSET,
      ROUTES.ADMIN_ASSIGNMENT,
      ROUTES.ADMIN_TRANSFER,
      ROUTES.ADMIN_MAINTENANCE,
      ROUTES.ADMIN_RFID,
      ROUTES.ADMIN_REPORTS,
      ROUTES.ADMIN_USERS,
      ROUTES.ADMIN_SETTINGS,
      ROUTES.ADMIN_NOTIFICATIONS,
      ROUTES.ADMIN_BACKUP,
      ROUTES.ADMIN_DEPARTMENTS,
      ROUTES.ADMIN_AUDIT_LOGS
    ],
    ict_officer: [
      ROUTES.ICT_DASHBOARD,
      ROUTES.ICT_ASSETS,
      ROUTES.ICT_CREATE_ASSET,
      ROUTES.ICT_ASSIGNMENTS,
      ROUTES.ICT_MAINTENANCE,
      ROUTES.ICT_RFID,
      ROUTES.ICT_REPORTS,
      ROUTES.ICT_INVENTORY,
      ROUTES.ICT_NOTIFICATIONS,
      ROUTES.ICT_ASSET_HISTORY
    ],
    college: [
      ROUTES.DEPT_DASHBOARD,
      ROUTES.DEPT_PROFILE,
      ROUTES.DEPT_ASSETS,
      ROUTES.DEPT_REQUESTS,
      ROUTES.DEPT_APPROVALS,
      ROUTES.DEPT_ASSIGNMENTS,
      ROUTES.DEPT_TRANSFERS,
      ROUTES.DEPT_RETURNS,
      ROUTES.DEPT_MAINTENANCE,
      ROUTES.DEPT_RFID,
      ROUTES.DEPT_REPORTS,
      ROUTES.DEPT_STAFF,
      ROUTES.DEPT_NOTIFICATIONS,
      ROUTES.DEPT_ASSET_HISTORY
    ],
    department_head: [
      ROUTES.DEPT_DASHBOARD,
      ROUTES.DEPT_PROFILE,
      ROUTES.DEPT_ASSETS,
      ROUTES.DEPT_REQUESTS,
      ROUTES.DEPT_APPROVALS,
      ROUTES.DEPT_ASSIGNMENTS,
      ROUTES.DEPT_TRANSFERS,
      ROUTES.DEPT_RETURNS,
      ROUTES.DEPT_MAINTENANCE,
      ROUTES.DEPT_RFID,
      ROUTES.DEPT_REPORTS,
      ROUTES.DEPT_STAFF,
      ROUTES.DEPT_NOTIFICATIONS,
      ROUTES.DEPT_ASSET_HISTORY
    ],
    finance: [
      ROUTES.FINANCE_DASHBOARD,
      ROUTES.FINANCE_PURCHASES,
      ROUTES.FINANCE_INVOICES,
      ROUTES.FINANCE_PAYMENTS,
      ROUTES.FINANCE_BUDGET,
      ROUTES.FINANCE_VALUATION,
      ROUTES.FINANCE_DEPRECIATION,
      ROUTES.FINANCE_SUPPLIERS,
      ROUTES.FINANCE_REPORTS,
      ROUTES.FINANCE_TRANSACTIONS,
      ROUTES.FINANCE_AUDIT,
      ROUTES.FINANCE_NOTIFICATIONS
    ],
    maintenance: [
      ROUTES.MAINT_DASHBOARD,
      ROUTES.MAINT_REQUESTS,
      ROUTES.MAINT_INSPECTION,
      ROUTES.MAINT_WORK_ORDERS,
      ROUTES.MAINT_REPAIRS,
      ROUTES.MAINT_PREVENTIVE,
      ROUTES.MAINT_TECHNICIANS,
      ROUTES.MAINT_PARTS,
      ROUTES.MAINT_ASSETS,
      ROUTES.MAINT_TESTING,
      ROUTES.MAINT_ASSIGNED,
      ROUTES.MAINT_HISTORY,
      ROUTES.MAINT_REPORTS,
      ROUTES.MAINT_NOTIFICATIONS
    ],
    store: [
      ROUTES.STORE_DASHBOARD,
      ROUTES.STORE_INVENTORY,
      ROUTES.STORE_ASSETS,
      ROUTES.STORE_RECEIVE,
      ROUTES.STORE_ISSUE,
      ROUTES.STORE_RETURNS,
      ROUTES.STORE_TRANSFERS,
      ROUTES.STORE_REPORTS,
      ROUTES.STORE_NOTIFICATIONS,
      ROUTES.STORE_HISTORY
    ],
    store_manager: [
      ROUTES.STORE_DASHBOARD,
      ROUTES.STORE_INVENTORY,
      ROUTES.STORE_ASSETS,
      ROUTES.STORE_RECEIVE,
      ROUTES.STORE_ISSUE,
      ROUTES.STORE_RETURNS,
      ROUTES.STORE_TRANSFERS,
      ROUTES.STORE_REPORTS,
      ROUTES.STORE_NOTIFICATIONS,
      ROUTES.STORE_HISTORY
    ],
    user: [ROUTES.ASSETS, ROUTES.NOTIFICATIONS, ROUTES.SETTINGS]
  };

  return routesByRole[role] || [];
};
