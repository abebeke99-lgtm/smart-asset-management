const DEFAULT_VIEW_DELETE_ROLES = new Set([
  'admin',
  'ict_officer',
  'college_manager',
  'department_head',
  'finance',
  'store_manager',
  'maintenance',
  'infrastructure',
]);

const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    administrator: 'admin',
    maintenance_coordinator: 'maintenance',
    facilities: 'infrastructure',
    infrastructure_facilities: 'infrastructure',
  };
  return aliases[normalized] || normalized;
};

const hasPermission = (user, permission) => (Array.isArray(user?.permissions) ? user.permissions : [])
  .some((value) => String(value || '').trim().toLowerCase() === permission);

export const canViewNotifications = (user) => (
  DEFAULT_VIEW_DELETE_ROLES.has(normalizeRole(user?.role))
  || hasPermission(user, 'notifications.view')
  || hasPermission(user, 'notifications.manage')
);

export const canDeleteNotifications = (user) => (
  DEFAULT_VIEW_DELETE_ROLES.has(normalizeRole(user?.role))
  || hasPermission(user, 'notifications.delete')
  || hasPermission(user, 'notifications.manage')
);
