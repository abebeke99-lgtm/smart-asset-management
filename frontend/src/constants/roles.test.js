import { ROLE_PERMISSIONS, ROLES } from './roles';

describe('College role location permissions', () => {
  test('allows location viewing without location management access', () => {
    expect(ROLE_PERMISSIONS[ROLES.COLLEGE]).toContain('college.locations.view');
    expect(ROLE_PERMISSIONS[ROLES.COLLEGE]).not.toContain('college.locations.manage');
  });
});
