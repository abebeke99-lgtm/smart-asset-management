import { getRoutesByRole } from './routes';

describe('Store Manager route configuration', () => {
  test('includes all Store Manager routes and excludes admin routes', () => {
    const routes = getRoutesByRole('store_manager');

    expect(routes).toEqual(
      expect.arrayContaining([
        '/store',
        '/store/inventory',
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
