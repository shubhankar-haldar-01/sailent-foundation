import { describe, expect, it } from 'vitest';

import {
  isGenericRole,
  isPlaceholderResponsibilities,
  isStaffDepartment,
  responsibilitiesOf,
} from '../roles';

describe('team roles', () => {
  it('treats the old forced role as no role at all', () => {
    for (const role of ['Team', ' team ', 'Team member', 'Staff', '', null]) {
      expect(isGenericRole(role), String(role)).toBe(true);
    }
    expect(isGenericRole('Team lead')).toBe(false);
    expect(isGenericRole('Field coordinator')).toBe(false);
  });

  it('accepts only the departments the Team page filters by', () => {
    expect(isStaffDepartment('Programmes')).toBe(true);
    expect(isStaffDepartment('Community Outreach')).toBe(true);
    expect(isStaffDepartment('Operations')).toBe(true);
    for (const value of ['Team', 'Leadership', 'Trustees', 'programmes', '', null]) {
      expect(isStaffDepartment(value), String(value)).toBe(false);
    }
  });

  it('recognises the generated bio, and shows only real responsibilities', () => {
    const placeholder = 'Asha Rao is a dedicated team member at Sailent Foundation.';
    expect(isPlaceholderResponsibilities(placeholder)).toBe(true);
    expect(responsibilitiesOf(placeholder)).toBeNull();
    expect(responsibilitiesOf('   ')).toBeNull();
    expect(responsibilitiesOf(' Runs the Gaya learning centres. ')).toBe(
      'Runs the Gaya learning centres.',
    );
  });
});
