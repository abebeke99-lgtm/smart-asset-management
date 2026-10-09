import fs from 'fs';
import path from 'path';
import { getDashboardRoute, normalizeRole } from './App';

describe('normalizeRole', () => {
  test('maps infrastructure director titles to the infrastructure role', () => {
    expect(normalizeRole('Infrastructure Directorate')).toBe('infrastructure');
    expect(normalizeRole('Infrastructure Director')).toBe('infrastructure');
    expect(normalizeRole('infrastructure_directorate')).toBe('infrastructure');
  });

  test('maps every supported role to its own dashboard destination', () => {
    expect({
      admin: getDashboardRoute('admin'),
      ict_officer: getDashboardRoute('ict_officer'),
      college: getDashboardRoute('college'),
      college_manager: getDashboardRoute('college_manager'),
      department_head: getDashboardRoute('department_head'),
      finance: getDashboardRoute('finance'),
      store_manager: getDashboardRoute('store_manager'),
      maintenance: getDashboardRoute('maintenance'),
      infrastructure: getDashboardRoute('infrastructure'),
      staff: getDashboardRoute('staff'),
      student: getDashboardRoute('student'),
    }).toEqual({
      admin: '/admin/dashboard',
      ict_officer: '/ict/dashboard',
      college: '/college/dashboard',
      college_manager: '/college/dashboard',
      department_head: '/department-head/dashboard',
      finance: '/finance/dashboard',
      store_manager: '/store/dashboard',
      maintenance: '/maintenance/dashboard',
      infrastructure: '/infrastructure/dashboard',
      staff: '/department',
      student: '/student',
    });
    expect(normalizeRole('college')).toBe('college');
    expect(normalizeRole('college_manager')).toBe('college_manager');
  });

  test('registers the College Manager dashboard destination under its role guard', () => {
    const appSource = fs.readFileSync(path.resolve(__dirname, './App.jsx'), 'utf8');

    expect(appSource).toContain('<Route path="/college" element={<ProtectedRoute allowedRoles={[\'college\', \'college_manager\']}><RoleLayout /></ProtectedRoute>}>');
    expect(appSource).toContain('<Route path="dashboard" element={<CollegeManagerPages section="dashboard" />} />');
  });
});

test('maintenance dashboard destination is registered as a dashboard route', () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, './App.jsx'), 'utf8');
  const maintenanceRoutes = appSource.slice(
    appSource.indexOf('<Route path="/maintenance"'),
    appSource.indexOf('<Route path="/infrastructure"'),
  );

  expect(maintenanceRoutes).toMatch(/<Route path="dashboard" element={<MaintDashboard \/>} \/>/);
});
