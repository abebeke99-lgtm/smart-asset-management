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
      admin: '/admin',
      ict_officer: '/ict',
      college: '/college',
      college_manager: '/college',
      department_head: '/department',
      finance: '/finance',
      store_manager: '/store',
      maintenance: '/maintenance',
      infrastructure: '/infrastructure',
      staff: '/department',
      student: '/student',
    });
  });
});
