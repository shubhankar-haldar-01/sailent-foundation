import { eq } from 'drizzle-orm';

import { settings, type DatabaseClient } from '@sailent/database';

export interface OrganisationContact {
  email: string | null;
  phone: string | null;
}

/**
 * The contact details the organisation has entered (Admin → Settings,
 * `organization_contact`). Empty fields stay null: an email or a pass shows
 * only what is on record, never a placeholder (AGENTS.md §10).
 */
export async function readOrganisationContact(
  db: DatabaseClient['db'],
): Promise<OrganisationContact> {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'organization_contact'))
      .limit(1);
    const value = (row?.value ?? {}) as { email?: unknown; phone?: unknown };
    const clean = (field: unknown) =>
      typeof field === 'string' && field.trim() ? field.trim() : null;
    return { email: clean(value.email), phone: clean(value.phone) };
  } catch {
    // Contact details are a courtesy; they never stop an email.
    return { email: null, phone: null };
  }
}
