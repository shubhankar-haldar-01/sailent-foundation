import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';

import { settings, type DatabaseClient } from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { NotFoundException, ValidationException } from '../../common/exceptions.js';
import { SETTING_KEYS, type SettingKey, type UpdateSettingsInput } from './dto/settings.dto.js';

/**
 * Site settings.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * FOUR ROWS, AND TWO OF THEM CURRENTLY GOVERN NOTHING.
 *
 * Worth stating plainly, because a settings screen implies that changing a
 * value changes behaviour, and for half of these it does not:
 *
 *   organization_name    — read by receipts, email and metadata. Real.
 *   registration_details — the 80G/12A identifiers printed on receipts. Real,
 *                          and still unsupplied, which blocks launch.
 *   donation_minimum_paise — NOTHING READS THIS. The donation flow does not
 *                          enforce a minimum. Editing it changes no behaviour.
 *   fcra_enabled         — NOTHING READS THIS either. The FCRA handling in
 *                          `donation-capture.service.ts` is hard-coded to flag
 *                          foreign instruments for review; it does not consult
 *                          this row.
 *
 * Those two are stored and returned honestly rather than quietly dropped, and
 * the admin screen says so on the field. Wiring them up means changing the
 * donation flow, which is out of scope here — and in the FCRA case is a legal
 * question before it is an engineering one, since the organisation is not
 * registered and accepting a foreign contribution without registration is
 * unlawful rather than merely unbuilt.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class SettingsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
  ) {}

  /** Every known setting, with its current value. */
  async read(): Promise<Record<SettingKey, unknown>> {
    const rows = await this.database.db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(inArray(settings.key, [...SETTING_KEYS]));

    const byKey = new Map(rows.map((row) => [row.key, row.value]));

    /*
      Missing rows are reported, not silently defaulted. A settings screen that
      invents a value for a row nobody seeded would show an administrator a
      number the application is not actually using.
    */
    const missing = SETTING_KEYS.filter((key) => !byKey.has(key));
    if (missing.length > 0) {
      throw new NotFoundException(
        `These settings are not present in the database: ${missing.join(', ')}. ` +
          'Seed reference data with `pnpm db:seed --reference`.',
      );
    }

    return Object.fromEntries(SETTING_KEYS.map((key) => [key, byKey.get(key)])) as Record<
      SettingKey,
      unknown
    >;
  }

  /**
   * Update one or more settings.
   *
   * Each key is written in its own statement inside ONE transaction, so a
   * rejected value cannot leave half an edit applied — an organisation name
   * saved beside registration details that were refused would be the kind of
   * partial state nobody goes looking for.
   */
  async update(input: UpdateSettingsInput, actor: AuthenticatedActor, context: AuditContext) {
    const changes = SETTING_KEYS.filter((key) => input[key] !== undefined);
    if (changes.length === 0) {
      throw new ValidationException([{ code: 'nothing_to_update', message: 'Nothing to update.' }]);
    }

    const before = await this.read();

    await this.database.db.transaction(async (tx) => {
      for (const key of changes) {
        const result = await tx
          .update(settings)
          .set({ value: input[key] as never, updatedBy: actor.id, updatedAt: new Date() })
          .where(eq(settings.key, key))
          .returning({ key: settings.key });

        // The key list is closed and `read()` has already proven every row
        // exists, so this is a race rather than a typo — but a settings write
        // that silently matched nothing is worth refusing.
        if (result.length === 0) {
          throw new NotFoundException(`Setting ${key} does not exist.`);
        }
      }
    });

    const after = await this.read();

    /*
      ONE audit row for the edit, holding only the keys that changed.

      Not one row per key: an administrator who changes the organisation name
      and the PAN together did one thing, and splitting it makes the log read
      as two unrelated edits a second apart.
    */
    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'settings.update',
      entityType: 'settings',
      oldValues: Object.fromEntries(changes.map((key) => [key, before[key]])),
      newValues: Object.fromEntries(changes.map((key) => [key, after[key]])),
      reason: input.reason,
      // Statutory identifiers and the name on every receipt. Not routine.
      severity: 'warning',
      ...context,
    });

    return after;
  }
}
