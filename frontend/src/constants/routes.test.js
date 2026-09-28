import { getRoutesByRole, ROUTES } from './routes';

describe('Administrator route configuration', () => {
  test('maps role, permission, and audit links to registered pages', () => {
    const adminRoutes = getRoutesByRole('admin');

    expect(ROUTES.ADMIN_ROLES).toBe('/admin/roles-permissions');
    expect(ROUTES.ADMIN_PERMISSIONS).toBe('/admin/roles-permissions');
    expect(ROUTES.ADMIN_AUDIT_LOGS).toBe('/admin/audit-logs');
    expect(adminRoutes).toContain(ROUTES.ADMIN_ROLES);
    expect(adminRoutes).toContain(ROUTES.ADMIN_AUDIT_LOGS);
    expect(adminRoutes).not.toContain(undefined);
  });
});

describe('Store Manager route configuration', () => {
  test('includes all Store Manager routes and excludes admin routes', () => {
    const routes = getRoutesByRole('store_manager');

    expect(routes).toEqual(
      expect.arrayContaining([
        '/store',
        '/store/inventory',
        '/store/available-assets',
        '/store/assets',
        '/store/receive',
        '/store/issue',
        '/store/returns',
        '/store/transfers',
        '/store/reports',
        '/store/notifications',
        '/store/history'
      ])
    );

    expect(routes).not.toContain('/store/profile');

    expect(routes).not.toEqual(
      expect.arrayContaining([
        '/admin',
        '/ict',
        '/finance',
        '/college',
        '/maintenance'
      ])
    );
  });
});

describe('ICT Officer route configuration', () => {
  test('uses the canonical support and asset-history routes required by the module specification', () => {
    const routes = getRoutesByRole('ict_officer');

    expect(ROUTES.ICT_SUPPORT).toBe('/ict/support');
    expect(ROUTES.ICT_ASSET_HISTORY).toBe('/ict/asset-history');
    expect(routes).toContain('/ict/support');
    expect(routes).toContain('/ict/asset-history');
    expect(routes).not.toContain('/ict/technical-support');
    expect(routes).not.toContain('/ict/assets/history');
  });
});
