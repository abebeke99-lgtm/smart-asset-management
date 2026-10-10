import { canDeleteNotifications, canViewNotifications } from '../../utils/notificationPermissions';

describe('notification role permissions', () => {
  const authorizedRoles = [
    'admin',
    'ict_officer',
    'college_manager',
    'department_head',
    'finance',
    'store_manager',
    'maintenance',
    'infrastructure',
  ];

  test.each(authorizedRoles)('%s can view and delete by default', (role) => {
    expect(canViewNotifications({ role, permissions: [] })).toBe(true);
    expect(canDeleteNotifications({ role, permissions: [] })).toBe(true);
  });

  test('other roles require explicit notification permissions', () => {
    expect(canViewNotifications({ role: 'student', permissions: [] })).toBe(false);
    expect(canDeleteNotifications({ role: 'student', permissions: [] })).toBe(false);
    expect(canViewNotifications({ role: 'student', permissions: ['notifications.view'] })).toBe(true);
    expect(canDeleteNotifications({ role: 'student', permissions: ['notifications.delete'] })).toBe(true);
  });
});
