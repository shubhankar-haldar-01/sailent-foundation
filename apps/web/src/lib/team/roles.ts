/**
 * A team member's designation, department and responsibilities (`bio`), as
 * the admin form and its server actions treat them (owner, 2026-11-22):
 *
 *   • staff are always "Team" — everyone has the same role, and /team shows
 *     only portraits and names, with no filters; trustees type a designation;
 *   • department and responsibilities are optional records, not shown on
 *     /team, saved as entered (the form used to overwrite the department with
 *     "Team" and write a generated bio). The generated sentence is recognised
 *     so it is not offered back as if somebody had written it.
 */

/** Departments a staff member can be recorded under. */
export const STAFF_DEPARTMENTS = [
  { value: 'Programmes', label: 'Programmes' },
  { value: 'Community Outreach', label: 'Community outreach' },
  { value: 'Operations', label: 'Operations' },
] as const;

export type StaffDepartment = (typeof STAFF_DEPARTMENTS)[number]['value'];

export function isStaffDepartment(value: string | null | undefined): value is StaffDepartment {
  return STAFF_DEPARTMENTS.some((department) => department.value === value);
}

export const ROLE_MAX = 160;
export const RESPONSIBILITIES_MAX = 200;

/** A role that says nothing about the person ("Team" was the old forced value). */
export function isGenericRole(designation: string | null | undefined): boolean {
  return /^\s*(team|team member|staff|member)?\s*$/i.test(designation ?? '');
}

/** The sentence the admin used to write when nobody entered a bio. */
export function isPlaceholderResponsibilities(bio: string | null | undefined): boolean {
  return /\bis a dedicated team member at Sailent Foundation\.?\s*$/i.test(bio ?? '');
}

/** The responsibilities worth showing, or null when there are none. */
export function responsibilitiesOf(bio: string | null | undefined): string | null {
  const text = bio?.trim() ?? '';
  return text && !isPlaceholderResponsibilities(text) ? text : null;
}
