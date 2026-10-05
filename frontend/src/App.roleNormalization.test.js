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
      teaching_assistant: getDashboardRoute('teaching_assistant'),
      staff: getDashboardRoute('staff'),
      student: getDashboardRoute('student'),
    }).toEqual({
      admin: '/admin/dashboard',
      ict_officer: '/ict/dashboard',
      college: '/college-manager/dashboard',
      college_manager: '/college-manager/dashboard',
      department_head: '/department-head/dashboard',
      finance: '/finance/dashboard',
      store_manager: '/store/dashboard',
      maintenance: '/maintenance/dashboard',
      infrastructure: '/infrastructure/dashboard',
      teaching_assistant: '/teaching-assistant/dashboard',
      staff: '/staff/dashboard',
      student: '/student/dashboard',
    });
    expect(normalizeRole('college')).toBe('college_manager');
    expect(normalizeRole('college_manager')).toBe('college_manager');
  });
});
