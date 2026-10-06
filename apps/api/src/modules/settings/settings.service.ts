import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

import { settings, type DatabaseClient } from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';
import type { z } from 'zod';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { NotFoundException, ValidationException } from '../../common/exceptions.js';
import {
  PUBLIC_SETTING_KEYS,
  SETTING_KEYS,
  settingValueSchemas,
  type PublicSettingKey,
  type SettingKey,
  type UpdateSettingsInput,
} from './dto/settings.dto.js';

/** What the public site, receipts and the contact form read. */
export interface OrganisationSettings {
  organization_name: string;
  registration_details: z.output<typeof settingValueSchemas.registration_details>;
  organization_contact: z.output<typeof settingValueSchemas.organization_contact>;
  organization_social: z.output<typeof settingValueSchemas.organization_social>;
}

const EMPTY_PUBLIC_SETTINGS: OrganisationSettings = {
  organization_name: 'Sailent Foundation',
  registration_details: {
    registrationNumber: null,
    pan: null,
    section12A: null,
    section80G: null,
    registeredAs: null,
    trustDeedNumber: null,
    registeredOn: null,
    csr1: null,
  },
  organization_contact: {
    email: null,
    pressEmail: null,
    phone: null,
    officeHours: null,
    address: { line1: null, line2: null, city: null, state: null, postalCode: null, country: null },
  },
  organization_social: [],
};

/**
 * Site settings.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT READS EACH ROW (as of Phase 13, 2026-10-07).
 *
 *   organization_name     — the public site (`GET /settings/public`: footer,
 *                           about page, structured data).
 *   registration_details  — the About page, and receipts: a receipt snapshots
 *                           `registrationNumber` when it is issued.
 *   organization_contact  — footer, contact page, structured data; contact-
 *                           form messages are emailed to its `email`.
 *   organization_social   — footer and contact page.
 *   donation_minimum_paise — NOTHING READS THIS. The donation flow does not
 *                           enforce it; the admin screen says so on the field.
 *   fcra_enabled          — NOTHING READS THIS either. The FCRA handling in
 *                           `donation-capture.service.ts` is hard-coded; this
 *                           is a legal question before it is an engineering one.
 *
 * The two unread rows are stored and returned honestly rather than quietly
 * dropped. Wiring them would change the donation flow (Phase 11), which
 * Phase 13 deliberately does not.
 *
 * Email still goes out under `BREVO_SENDER_NAME` (environment), and the worker
 * templates name the organisation in their own wording.
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
   * The settings the public site may show, validated and with every field
   * present. Only rows that are BOTH in `PUBLIC_SETTING_KEYS` and flagged
   * `is_public` are read. A missing or malformed row reads as empty — the
   * public site must render (without that detail) rather than fail.
   */
  async publicSettings(): Promise<OrganisationSettings> {
    const rows = await this.database.db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(and(inArray(settings.key, [...PUBLIC_SETTING_KEYS]), eq(settings.isPublic, true)));

    const result: OrganisationSettings = structuredClone(EMPTY_PUBLIC_SETTINGS);
    for (const row of rows) {
      const key = row.key as PublicSettingKey;
      const parsed = settingValueSchemas[key].safeParse(row.value);
      if (parsed.success) {
        (result as unknown as Record<string, unknown>)[key] = parsed.data;
      }
    }
    result.registration_details = {
      ...EMPTY_PUBLIC_SETTINGS.registration_details,
      ...result.registration_details,
    };
    return result;
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
