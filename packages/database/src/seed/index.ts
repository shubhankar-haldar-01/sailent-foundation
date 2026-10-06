import { NOTIFICATION_TEMPLATES } from '@sailent/validation';
import { NOTIFICATION_TEMPLATE_SEED } from './notification-templates.js';
import { config as loadDotenv } from 'dotenv';
import { eq, inArray, notInArray, sql } from 'drizzle-orm';

import { createDatabaseClient, type Database } from '../client.js';
import { announceConnection } from '../announce.js';
import { ROOT_ENV_PATH } from '../lib/env-path.js';
import {
  campaignGallery,
  campaignProducts,
  campaigns,
  categories,
  donations,
  donors,
  faqs,
  eventRegistrations,
  events,
  impactUpdates,
  media,
  permissions,
  products,
  programs,
  rolePermissions,
  roles,
  notificationTemplates,
  settings,
  successStories,
  teamMembers,
  userRoles,
  users,
  volunteers,
} from '../schema/index.js';
import {
  DatabaseTargetError,
  parseTargetFlags,
  resolveDatabaseTarget,
} from '../lib/database-target.js';
import { CATEGORIES } from './categories.js';
import { PERMISSIONS, RETIRED_ROLE_KEYS, ROLES } from './permissions.js';

loadDotenv({ path: ROOT_ENV_PATH });

/**
 * Seed runner.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO KINDS OF SEED, and the difference matters:
 *
 *   REFERENCE DATA — roles, permissions, base settings. Required for the system
 *   to function at all. Idempotent, and safe in any environment.
 *
 *   DEMO CONTENT — programs, campaigns, stories, a development admin. Useful
 *   for development and review, and REFUSED outside development.
 *
 * The guard below is not advisory. Seeding demo campaigns into a live NGO
 * database would put fictional fundraising appeals in front of real donors, so
 * the script exits rather than trusting the operator to have read the docs.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Usage:
 *   pnpm db:seed              reference data + demo content (development only)
 *   pnpm db:seed --reference  reference data only — safe anywhere
 */

const rupees = (value: number): number => value * 100;

function assertDemoSeedAllowed(): void {
  const appEnv = process.env.APP_ENV ?? 'development';
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (appEnv === 'production' || nodeEnv === 'production') {
    throw new Error(
      'Refusing to seed demo content in production.\n' +
        'Demo content includes fictional campaigns and a development admin account.\n' +
        'Run `pnpm db:seed --reference` to seed roles, permissions and settings only.',
    );
  }
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

async function seedPermissionsAndRoles(db: Database): Promise<void> {
  for (const permission of PERMISSIONS) {
    const [resource, action] = permission.key.split('.');
    await db
      .insert(permissions)
      .values({
        key: permission.key,
        resource: resource ?? 'unknown',
        action: action ?? 'unknown',
        description: permission.description,
        isSensitive: permission.sensitive ?? false,
      })
      .onConflictDoUpdate({
        target: permissions.key,
        set: { description: permission.description, isSensitive: permission.sensitive ?? false },
      });
  }

  const allPermissions = await db.select().from(permissions);
  const byKey = new Map(allPermissions.map((row) => [row.key, row.id]));

  /**
   * Retire the five operational roles, for a database that predates Phase 8.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * MIGRATION `0014` DOES THIS PROPERLY, WITH THE REASSIGNMENT AND THE GUARDS.
   * This is the seed catching up a database that was restored from a backup,
   * or branched before the change — and it therefore refuses to strand anybody
   * rather than assuming the migration has run.
   *
   * A user still holding only a retired role is given SUPER_ADMIN first, in
   * that order, for the same reason the migration does it in that order: the
   * failure mode of doing it backwards is a locked-out administrator.
   * ══════════════════════════════════════════════════════════════════════════
   */
  const retired = await db
    .select({ id: roles.id, key: roles.key })
    .from(roles)
    .where(inArray(roles.key, [...RETIRED_ROLE_KEYS]));

  if (retired.length > 0) {
    const [superAdmin] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.key, 'SUPER_ADMIN'));

    if (superAdmin) {
      const retiredIds = retired.map((role) => role.id);
      const holders = await db
        .selectDistinct({ userId: userRoles.userId })
        .from(userRoles)
        .where(inArray(userRoles.roleId, retiredIds));

      for (const holder of holders) {
        await db
          .insert(userRoles)
          .values({ userId: holder.userId, roleId: superAdmin.id })
          .onConflictDoNothing();
      }

      await db.delete(userRoles).where(inArray(userRoles.roleId, retiredIds));
      await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, retiredIds));
      await db.delete(roles).where(inArray(roles.id, retiredIds));

      console.log(
        `  \u2713 retired ${retired.length} role(s): ${retired.map((r) => r.key).join(', ')}` +
          (holders.length > 0 ? ` \u2014 ${holders.length} user(s) moved to SUPER_ADMIN` : ''),
      );
    }
  }

  for (const role of ROLES) {
    const [inserted] = await db
      .insert(roles)
      .values({
        key: role.key,
        name: role.name,
        description: role.description,
        priority: role.priority,
        isSystem: true,
      })
      .onConflictDoUpdate({
        target: roles.key,
        set: { name: role.name, description: role.description, priority: role.priority },
      })
      .returning({ id: roles.id });

    if (!inserted) continue;

    // Rebuild the bundle so a permission removed from the catalogue is actually
    // revoked, rather than lingering because nothing deleted it.
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, inserted.id));

    const keys = role.permissions === '*' ? PERMISSIONS.map((p) => p.key) : role.permissions;
    const rows = keys
      .map((key) => byKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId: inserted.id, permissionId }));

    if (rows.length > 0) {
      await db.insert(rolePermissions).values(rows).onConflictDoNothing();
    }
  }

  /**
   * Remove permissions the catalogue no longer defines.
   *
   * Without this, a key dropped from `PERMISSIONS` lingers in the table
   * forever: still grantable, still returned by the permissions endpoint, and
   * still counted — which is how the table came to hold two keys nothing in
   * the code referenced any more. `role_permissions` cascades, so the grants
   * go with them.
   *
   * Safe because the catalogue is the single source of truth (docs/rbac.md):
   * a permission that is not in it is not a permission this system has.
   */
  const definedKeys = PERMISSIONS.map((permission) => permission.key);
  const removed = await db
    .delete(permissions)
    .where(notInArray(permissions.key, definedKeys))
    .returning({ key: permissions.key });

  if (removed.length > 0) {
    console.log(
      `  \u2713 pruned ${removed.length} withdrawn permission(s): ${removed.map((r) => r.key).join(', ')}`,
    );
  }

  console.log(`  ✓ ${PERMISSIONS.length} permissions, ${ROLES.length} roles`);
}

/**
 * Category catalogue — REFERENCE DATA.
 *
 * Idempotent on `key`, and it updates the editable fields on conflict so that
 * a corrected description reaches an existing database. It deliberately does
 * NOT reset `is_active`: an operator who deactivated a category meant it, and
 * a re-seed must not silently switch it back on.
 */
async function seedCategories(db: Database): Promise<void> {
  for (const category of CATEGORIES) {
    await db
      .insert(categories)
      .values(category)
      .onConflictDoUpdate({
        target: categories.key,
        set: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          kind: category.kind,
          displayOrder: category.displayOrder,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`  \u2713 ${CATEGORIES.length} categories`);
}

/** Demo general FAQs (`/faq`). Categories match `FAQ_CATEGORIES` in @sailent/validation. */
const DEMO_GENERAL_FAQS: { category: string; question: string; answer: string }[] = [
  {
    category: 'donations',
    question: 'Is my donation eligible for tax deduction under Section 80G?',
    answer:
      'Donations to organisations registered under Section 80G are eligible for deduction. The receipt you receive immediately after donating is a payment receipt; the 80G certificate (Form 10BE) is issued separately after the annual statement of donations is filed.',
  },
  {
    category: 'donations',
    question: 'What is the difference between choosing a product and giving an amount?',
    answer:
      'Choosing a product funds a specific, priced item — a school kit, a medicine kit. Giving an amount lets the programme team allocate it where it is most needed within that campaign. You can do both in the same donation.',
  },
  {
    category: 'donations',
    question: 'Can I set up a regular donation?',
    answer:
      'No. Every donation is a single, one-time payment; we do not take monthly or recurring payments. You are always welcome to give again.',
  },
  {
    category: 'donations',
    question: 'Can I donate from outside India?',
    answer:
      'Not at present. Accepting foreign contributions requires registration under the Foreign Contribution (Regulation) Act, which we do not hold. Donations are accepted in Indian rupees from Indian payment instruments only.',
  },
  {
    category: 'campaigns',
    question: 'How is campaign progress calculated?',
    answer:
      'The amount raised reflects payments confirmed by our payment provider, not payments that have been started. A donation appears in the total once it is verified on our server.',
  },
  {
    category: 'volunteering',
    question: 'What happens after I apply?',
    answer:
      'Your application is reviewed, usually within two weeks. If approved you receive a volunteer ID and an invitation to the next orientation session.',
  },
  {
    category: 'events',
    question: 'What happens if an event is full?',
    answer:
      'Registration closes when every place is taken. There is no waitlist; if a registrant cancels, their place becomes available again on the event page.',
  },
  {
    category: 'general',
    question: 'How do I contact someone directly?',
    answer:
      'Use the contact form, or the email and phone number listed on the contact page. We aim to respond within three working days.',
  },
];

async function seedSettings(db: Database): Promise<void> {
  const baseSettings = [
    {
      key: 'fcra_enabled',
      value: false,
      category: 'compliance',
      description:
        'Foreign contributions. FCRA is not registered, so this MUST remain false — accepting a ' +
        'foreign contribution without registration is unlawful, not merely unbuilt.',
      isPublic: false,
    },
    {
      key: 'organization_name',
      value: 'Sailent Foundation',
      category: 'organization',
      description: 'Display name used in receipts, email and metadata.',
      isPublic: true,
    },
    {
      key: 'registration_details',
      value: {
        // Deliberately null. Receipts are legally required to carry these, and
        // an invented registration number is a legal problem rather than a
        // placeholder. Supplied by the organization before launch.
        registrationNumber: null,
        pan: null,
        section12A: null,
        section80G: null,
        // Phase 13: the remaining identifiers the About page shows. Optional in
        // the settings schema, so rows created before Phase 13 stay valid.
        registeredAs: null,
        trustDeedNumber: null,
        registeredOn: null,
        csr1: null,
      },
      category: 'compliance',
      description: 'Statutory registration identifiers. Must be supplied before launch.',
      isPublic: true,
    },
    {
      key: 'donation_minimum_paise',
      value: 1000,
      category: 'donations',
      description: 'Minimum accepted donation in paise (₹10).',
      isPublic: true,
    },
    /*
      Phase 13. Also inserted by migration 0023, EMPTY, so production gets the
      rows by applying the migration. Real values are entered in Admin →
      Settings; the web falls back to `lib/demo-org.ts` only while mock data is
      on, never in production.
    */
    {
      key: 'organization_contact',
      value: {
        email: null,
        pressEmail: null,
        phone: null,
        officeHours: null,
        address: {
          line1: null,
          line2: null,
          city: null,
          state: null,
          postalCode: null,
          country: null,
        },
      },
      category: 'organization',
      description:
        'Public contact details: email, phone, office hours and postal address. Contact-form messages are sent to the email.',
      isPublic: true,
    },
    {
      key: 'organization_social',
      value: [],
      category: 'organization',
      description: 'Public social media profiles shown in the footer and on the contact page.',
      isPublic: true,
    },
  ];

  for (const setting of baseSettings) {
    await db
      .insert(settings)
      .values(setting)
      .onConflictDoUpdate({
        target: settings.key,
        set: { description: setting.description, category: setting.category },
      });
  }
  console.log(`  ✓ ${baseSettings.length} settings`);
}

/**
 * Notification templates (Phase 10.11).
 *
 * UPSERT BY SLUG, AND NEVER OVERWRITE THE WORDING. An organisation that
 * rewrote its receipt email and lost it to a redeploy would stop trusting the
 * editor, which is worse than a stale default. Only the metadata that belongs
 * to the code — name, description, expected variables — is refreshed.
 */
async function seedNotificationTemplates(db: Database): Promise<void> {
  for (const template of NOTIFICATION_TEMPLATE_SEED) {
    const meta = NOTIFICATION_TEMPLATES[template.slug as keyof typeof NOTIFICATION_TEMPLATES];

    await db
      .insert(notificationTemplates)
      .values({
        slug: template.slug,
        name: meta.name,
        description: meta.description,
        channel: 'email',
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        bodyText: template.bodyText,
        variables: meta.variables,
      })
      .onConflictDoUpdate({
        target: notificationTemplates.slug,
        // Subject and bodies are deliberately absent. They belong to whoever
        // last edited them.
        set: {
          name: meta.name,
          description: meta.description,
          variables: meta.variables,
        },
      });
  }

  console.log(`  ✓ ${NOTIFICATION_TEMPLATE_SEED.length} notification templates`);
}

// ---------------------------------------------------------------------------
// Demo content — development only
// ---------------------------------------------------------------------------

/**
 * Argon2id hash of `DevPassword123!`, at the parameters the API uses.
 *
 * A KNOWN, PUBLISHED development value — it is in the docs. That is safe
 * precisely because these functions never run outside development, and it
 * saves every developer inventing their own.
 */
const DEV_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$BS/l/azWRRtHlvp86toreg$Dk1oNX0dovcWxlZuyYM5pr0TIhz0FFSSUMgwpghbr9Y';

/**
 * Development staff accounts.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO ACCOUNTS, BOTH SUPER_ADMIN, BOTH WITH A SECOND FACTOR.
 *
 * There used to be five, one per role, and the reasoning was sound at the
 * time: RBAC exercised only by a Super Admin has not been exercised at all,
 * because every request succeeds and a missing permission check looks exactly
 * like a working one.
 *
 * Phase 8 removed the other five roles, so that reasoning no longer applies —
 * there is nothing left to be denied.
 *
 * BOTH CARRY TOTP, AND THERE IS NO PASSWORD-ONLY STAFF ACCOUNT ANY MORE. That
 * is not an oversight: SUPER_ADMIN mandates a second factor (decision A8) and
 * it is now the only staff role, so an unenrolled account would be refused at
 * sign-in. `pnpm --filter @sailent/api totp:dev` prints the current code, and
 * the secret is the published development one.
 *
 * Two accounts rather than one, because asserting that an administrator cannot
 * change their own roles needs a second administrator to be the subject.
 *
 * Neither account is created outside development.
 * ══════════════════════════════════════════════════════════════════════════
 */
const DEV_USERS: {
  email: string;
  firstName: string;
  lastName: string;
  roleKey: string;
  totp: boolean;
}[] = [
  {
    email: 'admin@sailent.local',
    firstName: 'Development',
    lastName: 'Admin',
    roleKey: 'SUPER_ADMIN',
    totp: true,
  },
  {
    /*
      A SECOND administrator, also with TOTP.

      It was briefly seeded without one, on the assumption that a developer who
      has not enrolled a device still needs a way in. That assumption is now
      wrong: SUPER_ADMIN mandates a second factor (decision A8), and since
      Phase 8 it is the only staff role — so a password-only staff account
      cannot sign in at all, and seeding one only produces a confusing 403.

      Kept because two accounts are genuinely useful: testing that one
      administrator cannot change their own roles needs a second one to be the
      subject.
    */
    email: 'staff@sailent.local',
    firstName: 'Development',
    lastName: 'Staff',
    roleKey: 'SUPER_ADMIN',
    totp: true,
  },
];

async function seedDevelopmentAdmin(db: Database): Promise<void> {
  for (const definition of DEV_USERS) {
    const [created] = await db
      .insert(users)
      .values({
        email: definition.email,
        passwordHash: DEV_PASSWORD_HASH,
        firstName: definition.firstName,
        lastName: definition.lastName,
        status: 'active',
        emailVerifiedAt: new Date(),
        mustChangePassword: false,
        /**
         * Known development TOTP secret, seeded only for the roles that
         * mandate a second factor. The secret is published in the docs on
         * purpose — safe because this never runs outside development, and it
         * saves every developer enrolling a device.
         *
         * `pnpm --filter @sailent/api totp:dev` prints the current code.
         */
        totpSecret: definition.totp ? 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' : null,
        totpEnabled: definition.totp,
      })
      /*
        Inserts only. `users` is unique on `lower(email)` — a FUNCTIONAL index
        — which `onConflictDoUpdate` cannot target, so there is no upsert to be
        had here without naming the index by hand.

        It does not need one: an existing row that has drifted from its
        definition is reconciled by the enrolment sweep below, which is the
        only field that actually matters for being able to sign in.
      */
      .onConflictDoNothing()
      .returning({ id: users.id });

    const userId =
      created?.id ??
      (await db.select({ id: users.id }).from(users).where(eq(users.email, definition.email)))[0]
        ?.id;

    if (!userId) continue;

    const [role] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.key, definition.roleKey));

    if (role) {
      await db.insert(userRoles).values({ userId, roleId: role.id }).onConflictDoNothing();
    }

    console.log(
      `  \u2713 development ${definition.roleKey.toLowerCase()} \u2014 ${definition.email} / DevPassword123!` +
        (definition.totp ? ' (+ TOTP)' : ''),
    );
  }

  /**
   * Enrol any development account that a role migration left unable to sign in.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * Phase 8 moved `campaigns@`, `content@`, `volunteers@` and `finance@` to
   * SUPER_ADMIN, which MANDATES a second factor. Three of them had none, so the
   * migration that carefully preserved their accounts left them refused at
   * sign-in — access technically intact and practically gone.
   *
   * Deleting them was the other option and is worse: it loses accounts whose
   * ids appear in the audit log. Enrolling them with the published development
   * secret keeps every user and makes every one of them usable.
   *
   * DEVELOPMENT ONLY. This function is not called in production, where
   * enrolment is a person's own act with their own device.
   * ══════════════════════════════════════════════════════════════════════════
   */
  const stranded = await db
    .update(users)
    .set({ totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', totpEnabled: true })
    .where(
      sql`${users.totpEnabled} = false
          AND ${users.status} = 'active'
          AND EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = ${users.id} AND r.key = 'SUPER_ADMIN'
          )`,
    )
    .returning({ email: users.email });

  if (stranded.length > 0) {
    console.log(
      `  \u2713 enrolled ${stranded.length} account(s) a role change left without a second factor: ` +
        stranded.map((row) => row.email).join(', '),
    );
  }
}

async function seedDemoContent(db: Database): Promise<void> {
  /**
   * Clear the demo rows that have no natural key before re-inserting.
   *
   * Most demo tables are keyed by slug, so `onConflictDoNothing` makes a
   * re-seed a no-op. `impact_updates` has no such key — it is one dated
   * observation, and two genuinely identical ones are legitimate data — so
   * without this the table grows by two every time anyone runs the seed, and
   * the public impact page silently double-counts.
   *
   * Safe because this whole function is development-only: `assertDemoSeedAllowed`
   * has already refused to run in production before we reach here.
   */
  await db.delete(impactUpdates);

  // Programs ------------------------------------------------------------
  const programSeeds = [
    {
      title: 'Education',
      slug: 'education',
      tagline: 'Keeping children in school, and helping them stay there',
      shortDescription:
        'Learning support, materials and school infrastructure for children in under-served districts.',
      category: 'Education',
      status: 'published' as const,
      displayOrder: 10,
    },
    {
      title: 'Healthcare',
      slug: 'healthcare',
      tagline: 'Basic care, close to home',
      shortDescription:
        'Mobile clinics, medicines and maternal health support in villages far from the nearest hospital.',
      category: 'Healthcare',
      status: 'published' as const,
      displayOrder: 20,
    },
    {
      title: 'Child Welfare',
      slug: 'child-welfare',
      tagline: 'Safety, nutrition and a place to be a child',
      shortDescription:
        'Nutrition, protection and safe spaces for children in vulnerable households.',
      category: 'Child Welfare',
      status: 'published' as const,
      displayOrder: 30,
    },
    {
      title: 'Women Empowerment',
      slug: 'women-empowerment',
      tagline: 'Income, independence and a say in the decision',
      shortDescription:
        'Skills training, self-help groups and enterprise support for women in rural households.',
      category: 'Women Empowerment',
      status: 'published' as const,
      displayOrder: 40,
    },
    {
      title: 'Disaster Relief',
      slug: 'disaster-relief',
      tagline: 'There in the first week, and the month after',
      shortDescription:
        'Food, shelter and medical support for households displaced by floods and cyclones.',
      category: 'Disaster Relief',
      status: 'published' as const,
      displayOrder: 50,
    },
    /*
      The two programmes the approved campaigns grid needs. Every campaign
      belongs to a programme — "time-bound fundraising under a programme", as
      docs/database-architecture.md §5 defines it — and "Support Animal
      Welfare" and "Greener Communities" had none.
    */
    {
      title: 'Animal Welfare',
      slug: 'animal-welfare',
      tagline: 'Care for the animals no one else is looking after',
      shortDescription:
        'Food, shelter and veterinary care for abandoned and injured animals in our communities.',
      category: 'Animal Welfare',
      status: 'published' as const,
      displayOrder: 60,
    },
    {
      title: 'Environment',
      slug: 'environment',
      tagline: 'Greener, cleaner neighbourhoods, planted and kept by the people who live there',
      shortDescription:
        'Tree planting, clean-up drives and sustainable practices led with local communities.',
      category: 'Environment',
      status: 'published' as const,
      displayOrder: 70,
    },
  ];

  /**
   * Editorial copy for the public program pages.
   *
   * Kept beside the program it belongs to rather than in the web app, because
   * the API is now the source of truth for page content — the website reads
   * this from the database like everything else. Every string is marked as demo
   * content and every figure is illustrative (decision A14).
   */
  const programEditorial: Record<
    string,
    {
      accentIcon: string;
      problem: string;
      approach: string;
      activities: { title: string; description: string }[];
      metrics: { label: string; value: number }[];
    }
  > = {
    education: {
      accentIcon: 'book',
      problem:
        'Demo content. Children in the districts in this demo data set rarely leave school because they stop caring — they leave because a textbook costs more than a day of family income, or because the nearest secondary school is eleven kilometres away.',
      approach:
        'Demo content. This demo program works with existing government schools rather than building parallel ones: supplying materials, running after-school support, and repairing the infrastructure that quietly decides whether families keep sending their daughters.',
      activities: [
        {
          title: 'School kit distribution',
          description:
            'Demo activity. Kits are handed out at the start of the academic year rather than halfway through it.',
        },
        {
          title: 'After-school learning support',
          description:
            'Demo activity. Sessions for children who have missed significant schooling.',
        },
        {
          title: 'Sanitation repair',
          description:
            'Demo activity. Facilities work, particularly toilet blocks, in partner schools.',
        },
      ],
      metrics: [
        {
          label: 'Children supported',
          value: 1240,
        },
        {
          label: 'Partner schools',
          value: 18,
        },
        {
          label: 'Reading corners',
          value: 14,
        },
      ],
    },
    healthcare: {
      accentIcon: 'heart',
      problem:
        'Demo content. The nearest hospital in this demo data set is a two-hour journey, which turns a treatable illness into an untreated one.',
      approach:
        'Demo content. Mobile clinics on a fixed rota, so a village knows which day care arrives, plus medicine supply and maternal health follow-up.',
      activities: [
        {
          title: 'Mobile clinic rota',
          description: 'Demo activity. A published schedule across partner villages.',
        },
        {
          title: 'Maternal health follow-up',
          description: 'Demo activity. Antenatal and postnatal visits.',
        },
      ],
      metrics: [
        {
          label: 'Consultations',
          value: 3180,
        },
        {
          label: 'Villages on the rota',
          value: 22,
        },
      ],
    },
    'child-welfare': {
      accentIcon: 'shield',
      problem:
        'Demo content. Nutrition and safety gaps for children in households under acute financial stress.',
      approach:
        'Demo content. Supplementary nutrition, safe daytime spaces, and referral to statutory child protection services where required.',
      activities: [
        {
          title: 'Nutrition support',
          description: 'Demo activity. Supplementary meals through partner centres.',
        },
        {
          title: 'Safe spaces',
          description: 'Demo activity. Supervised daytime spaces for children of working parents.',
        },
      ],
      metrics: [
        {
          label: 'Children reached',
          value: 860,
        },
        {
          label: 'Centres supported',
          value: 9,
        },
      ],
    },
    'women-empowerment': {
      accentIcon: 'briefcase',
      problem:
        'Demo content. Women in the demo districts have skills but no route to independent income, and therefore little say in household decisions.',
      approach:
        'Demo content. Skills training tied to an actual market, self-help group formation, and small enterprise support.',
      activities: [
        {
          title: 'Tailoring and craft training',
          description: 'Demo activity. Twelve-week courses with market linkage.',
        },
        {
          title: 'Self-help group formation',
          description: 'Demo activity. Savings groups with basic financial literacy.',
        },
      ],
      metrics: [
        {
          label: 'Women trained',
          value: 410,
        },
        {
          label: 'Groups formed',
          value: 27,
        },
      ],
    },
    'animal-welfare': {
      accentIcon: 'paw',
      problem:
        'Demo content. Stray and abandoned animals go without food or treatment, and an injured animal on the street often has nowhere to be taken.',
      approach:
        'Demo content. Feeding points, partner veterinary care, and a small shelter for animals that cannot yet go back to the street.',
      activities: [
        {
          title: 'Feeding and first aid',
          description: 'Demo activity. Daily feeding points and first aid by trained volunteers.',
        },
        {
          title: 'Treatment and shelter',
          description: 'Demo activity. Veterinary care and recovery space through partner clinics.',
        },
      ],
      metrics: [
        {
          label: 'Animals treated',
          value: 96,
        },
        {
          label: 'Feeding points',
          value: 12,
        },
      ],
    },
    environment: {
      accentIcon: 'leaf',
      problem:
        'Demo content. Fast-growing neighbourhoods are losing tree cover and open space, and waste collects where no one owns the problem.',
      approach:
        'Demo content. Community-led tree planting with a plan for after the planting, regular clean-up drives, and simple habits that last.',
      activities: [
        {
          title: 'Tree planting',
          description: 'Demo activity. Saplings planted and cared for by resident groups.',
        },
        {
          title: 'Clean-up drives',
          description: 'Demo activity. Monthly drives with schools and resident associations.',
        },
      ],
      metrics: [
        {
          label: 'Saplings planted',
          value: 540,
        },
        {
          label: 'Clean-up drives',
          value: 18,
        },
      ],
    },
  };

  /** Where each demo program operates. Drives the computed geographic reach. */
  const programLocations: Record<string, { district: string; state: string }[]> = {
    education: [
      { district: 'Ranchi', state: 'Jharkhand' },
      { district: 'Gaya', state: 'Bihar' },
      { district: 'Kalahandi', state: 'Odisha' },
    ],
    healthcare: [
      { district: 'Bastar', state: 'Chhattisgarh' },
      { district: 'Ranchi', state: 'Jharkhand' },
    ],
    'child-welfare': [
      { district: 'Ranchi', state: 'Jharkhand' },
      { district: 'Gaya', state: 'Bihar' },
    ],
    'women-empowerment': [
      { district: 'Ranchi', state: 'Jharkhand' },
      { district: 'Kalahandi', state: 'Odisha' },
    ],
    'animal-welfare': [{ district: 'Pune', state: 'Maharashtra' }],
    environment: [{ district: 'Bhopal', state: 'Madhya Pradesh' }],
  };

  /**
   * Resolve categories by KEY, once.
   *
   * The backfill in migration 0005 only helps a database that already had
   * programs when it ran. A fresh install seeds them afterwards, so without
   * this the demo content is uncategorised and the public category filter is
   * empty on a brand-new database.
   */
  const categoryIds = new Map<string, string>(
    (await db.select({ key: categories.key, id: categories.id }).from(categories)).map((row) => [
      row.key,
      row.id,
    ]),
  );

  const CATEGORY_BY_SLUG: Record<string, string> = {
    education: 'EDUCATION',
    healthcare: 'HEALTHCARE',
    'child-welfare': 'CHILD_WELFARE',
    'women-empowerment': 'WOMEN_EMPOWERMENT',
    'school-kits-jharkhand': 'EDUCATION',
    'mobile-health-clinic-bastar': 'HEALTHCARE',
    'tailoring-training-centre': 'WOMEN_EMPOWERMENT',
    'disaster-relief': 'DISASTER_RELIEF',
    'animal-welfare': 'ANIMAL_WELFARE',
    environment: 'ENVIRONMENT',
    'flood-relief-balasore': 'DISASTER_RELIEF',
    'skills-training-second-cohort': 'WOMEN_EMPOWERMENT',
    'animal-care-pune': 'ANIMAL_WELFARE',
    'child-nutrition-gaya': 'CHILD_WELFARE',
    'women-livelihoods-ranchi': 'LIVELIHOOD',
    'greener-communities-bhopal': 'ENVIRONMENT',
  };

  const programIds = new Map<string, string>();
  for (const program of programSeeds) {
    const editorial = programEditorial[program.slug];

    const [row] = await db
      .insert(programs)
      .values({
        ...program,
        description:
          'Demo program content. Replaced with the organization’s own copy before launch.',
        beneficiaries: 'Demo beneficiary description.',
        problem: editorial?.problem ?? null,
        approach: editorial?.approach ?? null,
        activities: editorial?.activities ?? null,
        metrics: editorial?.metrics ?? null,
        accentIcon: editorial?.accentIcon ?? null,
        categoryId: categoryIds.get(CATEGORY_BY_SLUG[program.slug] ?? '') ?? null,
        goals: editorial?.activities?.slice(0, 3) ?? null,
        locations: programLocations[program.slug] ?? [],
        publishedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: programs.slug,
        set: {
          title: program.title,
          problem: editorial?.problem ?? null,
          approach: editorial?.approach ?? null,
          activities: editorial?.activities ?? null,
          metrics: editorial?.metrics ?? null,
          accentIcon: editorial?.accentIcon ?? null,
          categoryId: categoryIds.get(CATEGORY_BY_SLUG[program.slug] ?? '') ?? null,
          // Included in the conflict set, not only the insert: the public
          // impact page computes "which states we work in" from this column,
          // so a re-seed that left it stale would publish a wrong figure.
          locations: programLocations[program.slug] ?? [],
        },
      })
      .returning({ id: programs.id, slug: programs.slug });
    if (row) programIds.set(row.slug, row.id);
  }

  // Campaigns -------------------------------------------------------------
  /** A date N days from now. Relative, so seeded content never goes stale. */
  const inDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  };

  /**
   * A creation timestamp that encodes the EDITORIAL ORDER of the demo
   * campaigns, one minute apart.
   *
   * The public list sorts by `createdAt`, and the approved homepage shows
   * Education, then Disaster Relief, then Women Empowerment. Left to the
   * database default that order is whatever the first seed run produced, and
   * re-seeding could not change it. This makes it explicit and stable.
   *
   * It is demo scaffolding. The real fix is a `display_order` column on
   * campaigns that an editor sets; when that lands, delete this.
   */
  const seedOrder = (slug: string) => new Date(Date.UTC(2026, 5, 1, 0, CAMPAIGN_ORDER[slug] ?? 90));

  const CAMPAIGN_ORDER: Record<string, number> = {
    'school-kits-jharkhand': 1,
    'flood-relief-balasore': 2,
    'skills-training-second-cohort': 3,
    'mobile-health-clinic-bastar': 4,
    'tailoring-training-centre': 5,
    'animal-care-pune': 6,
    'child-nutrition-gaya': 7,
    'women-livelihoods-ranchi': 8,
    'greener-communities-bhopal': 9,
  };

  /**
   * The PRODUCT CATALOGUE — the master list, independent of any campaign.
   *
   * ════════════════════════════════════════════════════════════════════════
   * Phase 5 separated "what a School Kit is" from "what this campaign charges
   * for one". The description, the name and the unit belong to the product and
   * are written once here; the price and the target belong to the campaign
   * that offers it, below.
   *
   * `defaultPrice` is a STARTING POINT an operator sees when they add the
   * product to a campaign — never a live lookup. Changing it here does not
   * change what any existing campaign charges, and it does not touch a single
   * historical donation.
   * ════════════════════════════════════════════════════════════════════════
   */
  const productCatalogue = [
    {
      slug: 'school-kit',
      name: 'School Kit',
      unit: 'kit',
      defaultPrice: rupees(900),
      description:
        'Notebooks, stationery, a school bag and two uniforms for one child for a full academic year.',
    },
    {
      slug: 'textbook-set',
      name: 'Textbook Set',
      unit: 'set',
      defaultPrice: rupees(600),
      description: 'The full prescribed textbook set for one child, for one class level.',
    },
    {
      slug: 'medicine-kit',
      name: 'Medicine Kit',
      unit: 'kit',
      defaultPrice: rupees(1_200),
      description:
        'Essential medicines for one clinic day \u2014 roughly sixty patients across one village visit.',
    },
    {
      slug: 'clinic-day',
      name: 'Sponsor a Clinic Day',
      unit: 'day',
      defaultPrice: rupees(9_000),
      description:
        'The complete cost of one village clinic day: staff, fuel, medicines and referral support.',
    },
    {
      slug: 'family-relief-kit',
      name: 'Family Relief Kit',
      unit: 'kit',
      defaultPrice: rupees(1_500),
      description:
        'Two weeks of dry rations, clothing, a tarpaulin and basic utensils for one household.',
    },
    {
      slug: 'shelter-repair-grant',
      name: 'Shelter Repair Grant',
      unit: 'home',
      defaultPrice: rupees(4_000),
      description: 'Materials and labour to make one damaged home weather-tight again.',
    },
    {
      slug: 'sponsor-a-trainee',
      name: 'Sponsor a Trainee',
      unit: 'trainee',
      defaultPrice: rupees(6_000),
      description:
        'One woman\u2019s full six-month course: tuition, materials and placement support.',
    },
    {
      /**
       * Deliberately NOT offered by any campaign below.
       *
       * The catalogue is independent of campaigns, and a product that exists
       * while nothing sells it is the normal case for a newly added one. It
       * gives the admin product list a row whose usage count is zero, which is
       * the state most likely to be got wrong.
       */
      slug: 'winter-blanket',
      name: 'Winter Blanket',
      unit: 'blanket',
      defaultPrice: rupees(1_500),
      description: 'One heavy quilted blanket, rated for a north Indian winter night.',
    },
  ];

  const productIds = new Map<string, string>();
  for (const product of productCatalogue) {
    const [row] = await db
      .insert(products)
      .values(product)
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          name: product.name,
          description: product.description,
          unit: product.unit,
          defaultPrice: product.defaultPrice,
          updatedAt: new Date(),
        },
      })
      .returning({ id: products.id, slug: products.slug });
    if (row) productIds.set(row.slug, row.id);
  }

  const campaignSeeds = [
    {
      slug: 'school-kits-jharkhand',
      programSlug: 'education',
      title: 'Educate Rural Children',
      shortDescription:
        'Provide school kits, books and learning support to underprivileged children in rural areas.',
      category: 'Education',
      location: 'Ranchi, Jharkhand',
      state: 'Jharkhand',
      city: 'Ranchi',
      fundraisingGoal: rupees(1_000_000),
      amountRaised: rupees(450_000),
      donorCount: 320,
      beneficiaryTarget: 500,
      beneficiariesReached: 354,
      status: 'active' as const,
      isFeatured: true,
      // No end date on any seeded campaign: campaigns are ongoing by default
      // and run until an administrator pauses or completes them. A real
      // deadline is optional, set in the admin form, and closes donations at
      // the end of that day (`hasEnded` in @sailent/validation).
      endDate: null,
      /** Campaign-specific pricing. See `productCatalogue`. */
      products: [
        {
          product: 'school-kit',
          price: rupees(900),
          targetQuantity: 500,
          providedQuantity: 354,
        },
        {
          product: 'textbook-set',
          price: rupees(600),
          targetQuantity: 500,
          providedQuantity: 291,
        },
      ],
    },
    {
      slug: 'mobile-health-clinic-bastar',
      programSlug: 'healthcare',
      title: 'Keep the mobile health clinic running in Bastar',
      shortDescription:
        'One clinic day reaches around sixty patients in villages more than four hours from a hospital.',
      category: 'Healthcare',
      location: 'Bastar, Chhattisgarh',
      state: 'Chhattisgarh',
      city: 'Bastar',
      fundraisingGoal: rupees(720_000),
      amountRaised: rupees(494_000),
      donorCount: 312,
      beneficiaryTarget: 6000,
      beneficiariesReached: 4120,
      status: 'active' as const,
      isFeatured: true,
      endDate: null,
      /** Campaign-specific pricing. See `productCatalogue`. */
      products: [
        {
          product: 'medicine-kit',
          price: rupees(1_200),
          targetQuantity: 300,
          providedQuantity: 198,
        },
        {
          product: 'clinic-day',
          price: rupees(9_000),
          targetQuantity: 60,
          providedQuantity: 31,
        },
      ],
    },
    {
      slug: 'flood-relief-balasore',
      programSlug: 'disaster-relief',
      title: 'Relief for Flood-Affected Families',
      shortDescription: 'Emergency support with food, clothing, shelter and medical aid.',
      category: 'Disaster Relief',
      location: 'Balasore, Odisha',
      state: 'Odisha',
      city: 'Balasore',
      fundraisingGoal: rupees(1_500_000),
      amountRaised: rupees(820_000),
      donorCount: 480,
      beneficiaryTarget: 1000,
      beneficiariesReached: 640,
      status: 'active' as const,
      isFeatured: true,
      endDate: null,
      /** Campaign-specific pricing. See `productCatalogue`. */
      products: [
        {
          product: 'family-relief-kit',
          price: rupees(1_500),
          targetQuantity: 400,
          providedQuantity: 248,
        },
        {
          product: 'shelter-repair-grant',
          price: rupees(4_000),
          targetQuantity: 150,
          providedQuantity: 61,
        },
      ],
    },
    {
      slug: 'skills-training-second-cohort',
      programSlug: 'women-empowerment',
      title: 'Skills for a Brighter Future',
      shortDescription: 'Vocational training and resources for women in rural communities.',
      category: 'Women Empowerment',
      location: 'Ranchi, Jharkhand',
      state: 'Jharkhand',
      city: 'Ranchi',
      fundraisingGoal: rupees(500_000),
      amountRaised: rupees(190_000),
      donorCount: 150,
      beneficiaryTarget: 200,
      beneficiariesReached: 64,
      status: 'active' as const,
      isFeatured: true,
      endDate: null,
      /** Campaign-specific pricing. See `productCatalogue`. */
      products: [
        {
          product: 'sponsor-a-trainee',
          price: rupees(6_000),
          targetQuantity: 80,
          providedQuantity: 26,
        },
      ],
    },
    {
      slug: 'tailoring-training-centre',
      programSlug: 'women-empowerment',
      title: 'Equip a tailoring training centre for 60 women',
      shortDescription:
        'Machines, materials and a trainer for a six-month certified course with placement support.',
      category: 'Women Empowerment',
      location: 'Ranchi, Jharkhand',
      state: 'Jharkhand',
      city: 'Ranchi',
      fundraisingGoal: rupees(380_000),
      amountRaised: rupees(380_000),
      donorCount: 198,
      beneficiaryTarget: 60,
      beneficiariesReached: 60,
      status: 'completed' as const,
      isFeatured: false,
      endDate: null,
      products: [],
    },
    /*
      The four the approved campaigns grid adds, so the listing shows the two
      full rows it was designed around. Titles, copy and figures are the
      design's own. Each sits under the programme whose work it funds.
    */
    {
      slug: 'animal-care-pune',
      programSlug: 'animal-welfare',
      title: 'Support Animal Welfare',
      shortDescription: 'Provide food, shelter and medical care for abandoned and injured animals.',
      category: 'Animal Welfare',
      location: 'Pune, Maharashtra',
      state: 'Maharashtra',
      city: 'Pune',
      fundraisingGoal: rupees(250_000),
      amountRaised: rupees(79_005),
      donorCount: 79,
      beneficiaryTarget: 300,
      beneficiariesReached: 96,
      status: 'active' as const,
      isFeatured: false,
      endDate: null,
      products: [],
    },
    {
      slug: 'child-nutrition-gaya',
      programSlug: 'child-welfare',
      title: 'Nutrition for Underprivileged Children',
      shortDescription:
        'Provide nutritious meals and essential care to children from underprivileged families.',
      category: 'Child Welfare',
      location: 'Gaya, Bihar',
      state: 'Bihar',
      city: 'Gaya',
      fundraisingGoal: rupees(700_000),
      amountRaised: rupees(312_900),
      donorCount: 410,
      beneficiaryTarget: 700,
      beneficiariesReached: 313,
      status: 'active' as const,
      isFeatured: false,
      endDate: null,
      products: [],
    },
    {
      slug: 'women-livelihoods-ranchi',
      programSlug: 'women-empowerment',
      title: 'Empower Women Livelihoods',
      shortDescription:
        'Support skill development and livelihood programs for women and help them build independence.',
      category: 'Livelihood',
      location: 'Ranchi, Jharkhand',
      state: 'Jharkhand',
      city: 'Ranchi',
      fundraisingGoal: rupees(350_000),
      amountRaised: rupees(105_320),
      donorCount: 220,
      beneficiaryTarget: 150,
      beneficiariesReached: 45,
      status: 'active' as const,
      isFeatured: false,
      endDate: null,
      products: [],
    },
    {
      slug: 'greener-communities-bhopal',
      programSlug: 'environment',
      title: 'Greener Communities',
      shortDescription:
        'Support tree plantation, clean environment initiatives and sustainable community programs.',
      category: 'Environment',
      location: 'Bhopal, Madhya Pradesh',
      state: 'Madhya Pradesh',
      city: 'Bhopal',
      fundraisingGoal: rupees(200_000),
      amountRaised: rupees(89_640),
      donorCount: 185,
      beneficiaryTarget: 1200,
      beneficiariesReached: 540,
      status: 'active' as const,
      isFeatured: false,
      endDate: null,
      products: [],
    },
  ];

  const campaignIds = new Map<string, string>();
  for (const { products, programSlug, ...campaign } of campaignSeeds) {
    /*
      EVERY CAMPAIGN BELONGS TO A PROGRAMME. A campaign is time-bound
      fundraising for part of a programme's work, and the programme is where
      its reporting, its surplus and its "More in …" listing all live. A seed
      entry naming a programme that does not exist is a mistake to fail on,
      not a campaign to file under nothing.
    */
    const programId = programIds.get(programSlug);
    if (!programId) {
      throw new Error(
        `Campaign “${campaign.slug}” names programme “${programSlug}”, which is not seeded. ` +
          'Every campaign belongs to a programme.',
      );
    }

    const [row] = await db
      .insert(campaigns)
      .values({
        ...campaign,
        programId,
        categoryId: categoryIds.get(CATEGORY_BY_SLUG[campaign.slug] ?? '') ?? null,
        description:
          'Demo campaign narrative. Replaced with real copy before launch.\n\n' +
          'A second demo paragraph, so the page can be reviewed with the ' +
          'multi-paragraph body a real campaign story will have.\n\n' +
          'A third, because a one-paragraph story and a three-paragraph story ' +
          'are different layout problems.',
        beneficiaryContext: 'Demo beneficiary context.',
        impactNotes: [
          { label: 'Districts covered', value: 3 },
          { label: 'Distribution days held', value: 12 },
        ],
        startDate: new Date('2026-06-01T00:00:00+05:30'),
        publishedAt: new Date(),
        createdAt: seedOrder(campaign.slug),
      })
      /**
       * Re-seeding OVERWRITES the demo figures, not just the title.
       *
       * With only `title` and `status` here, editing the demo content and
       * running the seed again left every amount, count and date at whatever
       * the first run wrote — the rows looked half-updated and it was not
       * obvious why.
       *
       * `amountRaised` and `donorCount` are derived counters that decision A6
       * otherwise reserves to the donation transaction. Writing them HERE is
       * the one sanctioned exception, because this branch only ever runs under
       * the demo tier, which refuses to run in production at all. It would
       * destroy real financial state on a live database, which is precisely
       * what that guard exists to prevent.
       */
      .onConflictDoUpdate({
        target: campaigns.slug,
        set: {
          title: campaign.title,
          // So a re-seed files an existing campaign under its programme too.
          programId,
          shortDescription: campaign.shortDescription,
          status: campaign.status,
          categoryId: categoryIds.get(CATEGORY_BY_SLUG[campaign.slug] ?? '') ?? null,
          location: campaign.location,
          state: campaign.state,
          city: campaign.city,
          fundraisingGoal: campaign.fundraisingGoal,
          amountRaised: campaign.amountRaised,
          donorCount: campaign.donorCount,
          beneficiaryTarget: campaign.beneficiaryTarget,
          beneficiariesReached: campaign.beneficiariesReached,
          isFeatured: campaign.isFeatured,
          endDate: campaign.endDate,
          createdAt: seedOrder(campaign.slug),
        },
      })
      .returning({ id: campaigns.id, slug: campaigns.slug });

    if (!row) continue;
    campaignIds.set(row.slug, row.id);

    /**
     * The JUNCTION rows: which catalogue products this campaign offers, at what
     * price, towards what target.
     *
     * The conflict target is (campaign_id, product_id) — the same pair the
     * unique index enforces. Re-seeding therefore CORRECTS an existing offer
     * rather than silently doing nothing, which is what `onConflictDoNothing`
     * did before and why edited demo prices never took effect.
     *
     * `providedQuantity` is written here for the same reason the campaign
     * counters are, and under the same guard: this branch runs only under the
     * demo tier, which refuses to run against production. Nowhere else in the
     * codebase may write it outside a captured-payment transaction.
     */
    for (const [index, offer] of products.entries()) {
      const productId = productIds.get(offer.product);
      if (!productId) {
        throw new Error(
          `Campaign “${campaign.slug}” offers unknown product “${offer.product}”. ` +
            'Add it to `productCatalogue` above.',
        );
      }

      await db
        .insert(campaignProducts)
        .values({
          campaignId: row.id,
          productId,
          price: offer.price,
          targetQuantity: offer.targetQuantity,
          providedQuantity: offer.providedQuantity,
          sortOrder: (index + 1) * 10,
        })
        .onConflictDoUpdate({
          target: [campaignProducts.campaignId, campaignProducts.productId],
          set: {
            price: offer.price,
            targetQuantity: offer.targetQuantity,
            providedQuantity: offer.providedQuantity,
            sortOrder: (index + 1) * 10,
            isActive: true,
            status: 'active',
            updatedAt: new Date(),
          },
        });
    }
  }

  // Campaign FAQs, gallery and updates -------------------------------------
  //
  // These live in their own tables from Phase 4 onward. Cleared first for the
  // same reason `impact_updates` is: none has a natural key an upsert could
  // target, so without a reset a re-seed doubles every one of them and the
  // public campaign page shows each FAQ twice.
  await db.delete(campaignGallery);
  await db.delete(faqs);

  // General FAQs (Phase 13: `/faq` reads these, not fixtures). Demo wording,
  // accurate to how the platform works — one-time donations only, no event
  // waitlist.
  await db.insert(faqs).values(
    DEMO_GENERAL_FAQS.map((faq, index) => ({
      ...faq,
      contextType: 'general' as const,
      contextId: null,
      displayOrder: (index + 1) * 10,
      isPublished: true,
    })),
  );
  await db.insert(faqs).values({
    question: 'Demo unpublished general question',
    answer: 'This general FAQ is a draft and must NOT appear on /faq.',
    category: 'general',
    contextType: 'general' as const,
    contextId: null,
    displayOrder: 999,
    isPublished: false,
  });

  for (const [campaignSlug, campaignId] of campaignIds) {
    await db.insert(faqs).values([
      {
        question: 'How is the money spent?',
        answer:
          'Demo answer. A real campaign states the split between direct program cost and overhead, and links to the utilisation report.',
        contextType: 'campaign' as const,
        contextId: campaignId,
        displayOrder: 10,
        isPublished: true,
      },
      {
        question: 'Will I get a receipt?',
        answer:
          'Demo answer. A receipt is issued immediately. The 80G tax certificate is a separate document the Income Tax Department issues after the annual Form 10BD filing.',
        contextType: 'campaign' as const,
        contextId: campaignId,
        displayOrder: 20,
        isPublished: true,
      },
      {
        question: 'Demo unpublished question',
        answer: 'This FAQ is a draft and must NOT appear on the public campaign page.',
        contextType: 'campaign' as const,
        contextId: campaignId,
        displayOrder: 30,
        isPublished: false,
      },
    ]);

    // Gallery: media rows plus their ordered placement on the campaign. Real
    // photography does not exist yet, so these carry a storage key that
    // resolves to the deterministic placeholder and no public URL.
    for (const index of [1, 2, 3]) {
      const [row] = await db
        .insert(media)
        .values({
          storageKey: `demo/campaigns/${campaignSlug}/${index}.jpg`,
          url: null,
          altText: `Demo photograph ${index} from the ${campaignSlug} campaign`,
          caption: index === 1 ? 'Demo caption. Replaced with a real one.' : null,
          mimeType: 'image/jpeg',
          sizeBytes: 100_000 + index,
          width: 1600,
          height: 1200,
          visibility: 'public' as const,
        })
        .onConflictDoNothing()
        .returning({ id: media.id });

      const mediaId =
        row?.id ??
        (
          await db
            .select({ id: media.id })
            .from(media)
            .where(eq(media.storageKey, `demo/campaigns/${campaignSlug}/${index}.jpg`))
        )[0]?.id;

      if (!mediaId) continue;

      await db
        .insert(campaignGallery)
        .values({
          campaignId,
          mediaId,
          displayOrder: index * 10,
          // The third image is private, so the public endpoint can be shown to
          // withhold it rather than only asserted to.
          visibility: index === 3 ? ('private' as const) : ('public' as const),
        })
        .onConflictDoNothing();
    }
  }

  // Team ------------------------------------------------------------------
  const team = [
    {
      name: 'A. Raghavan',
      slug: 'a-raghavan',
      designation: 'Founder & Executive Director',
      department: 'Leadership',
      memberType: 'staff' as const,
      displayOrder: 10,
    },
    {
      name: 'M. Lakshmi',
      slug: 'm-lakshmi',
      designation: 'Head of Programs',
      department: 'Leadership',
      memberType: 'staff' as const,
      displayOrder: 20,
    },
    {
      name: 'S. Deshpande',
      slug: 's-deshpande',
      designation: 'Head of Finance & Compliance',
      department: 'Leadership',
      memberType: 'staff' as const,
      displayOrder: 30,
    },
    {
      name: 'R. Toppo',
      slug: 'r-toppo',
      designation: 'Volunteer Coordinator',
      department: 'Operations',
      memberType: 'staff' as const,
      displayOrder: 40,
    },
    {
      name: 'V. Menon',
      slug: 'v-menon',
      designation: 'Chair, Board of Trustees',
      department: 'Board',
      memberType: 'trustee' as const,
      displayOrder: 50,
    },
  ];
  for (const member of team) {
    await db
      .insert(teamMembers)
      .values({
        ...member,
        bio: 'Demo biography. These are fictional people; the real team replaces them before launch.',
        status: 'published',
        isPublic: true,
      })
      .onConflictDoNothing();
  }

  // Stories ---------------------------------------------------------------
  //
  // THREE of them, because the approved homepage shows a row of three. Every
  // person named here is FICTIONAL, and `consentObtained` is set because the
  // schema refuses to publish a story that names someone without it — a demo
  // row must not be the reason that check is ever relaxed.
  const storySeeds = [
    {
      title: 'A New Beginning for Meera',
      slug: 'sunita-finished-school',
      excerpt:
        'From a small village to a brighter future — Meera’s journey shows what’s possible with education.',
      subjectName: 'Meera',
      location: 'Ranchi, Jharkhand',
      programSlug: 'education',
      campaignSlug: 'school-kits-jharkhand',
    },
    {
      title: 'A Healthier Tomorrow for Ramesh',
      slug: 'a-healthier-season-for-ramesh',
      excerpt: 'The medical support I received changed my life.',
      subjectName: 'Ramesh',
      location: 'Bastar, Chhattisgarh',
      programSlug: 'healthcare',
      campaignSlug: 'mobile-health-clinic-bastar',
    },
    {
      title: 'From Struggle to Self-Reliance',
      slug: 'from-training-to-a-shop-of-her-own',
      excerpt: 'How skills training helped Sita build a better future for her family.',
      subjectName: 'Sita',
      location: 'Ranchi, Jharkhand',
      programSlug: 'women-empowerment',
      campaignSlug: 'tailoring-training-centre',
    },
  ];

  for (const [index, { programSlug, campaignSlug, ...story }] of storySeeds.entries()) {
    // Staggered a day apart. The listing sorts newest first, so without this
    // all three share a timestamp and come back in whatever order the database
    // returns them — which is not the order the homepage row is designed in.
    const publishedAt = inDays(-index);
    await db
      .insert(successStories)
      .values({
        ...story,
        programId: programIds.get(programSlug) ?? null,
        campaignId: campaignIds.get(campaignSlug) ?? null,
        challenge: 'Demo challenge section.',
        intervention: 'Demo intervention section.',
        journey: 'Demo journey section.',
        outcome: 'Demo outcome section.',
        impact: 'Demo impact section.',
        // Required before publishing a story that names a person — the
        // constraint rejects the row otherwise, which is the point.
        consentObtained: true,
        status: 'published',
        publishedAt,
      })
      .onConflictDoUpdate({
        target: successStories.slug,
        set: {
          title: story.title,
          excerpt: story.excerpt,
          subjectName: story.subjectName,
          location: story.location,
          publishedAt,
          programId: programIds.get(programSlug) ?? null,
          campaignId: campaignIds.get(campaignSlug) ?? null,
        },
      });
  }

  // Events ----------------------------------------------------------------
  const eventSeeds = [
    {
      title: 'Community Clean-up Drive',
      slug: 'volunteer-orientation-october',
      startDate: inDays(12),
      capacity: 40,
      registeredCount: 27,
      city: 'Pune, Maharashtra',
      isOnline: false,
    },
    {
      title: 'Food Distribution Camp',
      slug: 'school-kit-distribution-namkum',
      startDate: inDays(21),
      capacity: 25,
      registeredCount: 25,
      city: 'Nashik, Maharashtra',
      isOnline: false,
    },
    {
      title: 'Animal Care Awareness',
      slug: 'animal-care-awareness',
      startDate: inDays(33),
      capacity: 120,
      registeredCount: 48,
      city: null,
      isOnline: true,
    },
    {
      title: 'Community Plantation Drive',
      slug: 'tree-plantation-drive',
      startDate: inDays(-26),
      capacity: 60,
      registeredCount: 52,
      city: 'Kalahandi',
      isOnline: false,
    },
  ];
  for (const event of eventSeeds) {
    await db
      .insert(events)
      .values({
        ...event,
        summary: 'Demo event summary.',
        description:
          'Demo event description.\n\nA second demo paragraph, so the event page renders with the body a real listing will have.',
        schedule: [
          { time: '10:00', activity: 'Demo item — arrival and registration' },
          { time: '10:30', activity: 'Demo item — introduction to the program' },
          { time: '12:00', activity: 'Demo item — questions and close' },
        ],
        status: 'published',
        registrationStatus: event.registeredCount >= (event.capacity ?? 0) ? 'full' : 'open',
        publishedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: events.slug,
        set: {
          title: event.title,
          startDate: event.startDate,
          city: event.city,
          isOnline: event.isOnline,
          capacity: event.capacity,
          registeredCount: event.registeredCount,
        },
      });
  }

  /**
   * Registrations to match the counters.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * A SEEDED `registered_count` WITH NO ROWS BEHIND IT IS DRIFT, and Phase 9
   * added the screens that notice.
   *
   * The admin event list recomputes seats from `event_registrations` and shows
   * the figure beside the cached column precisely so a disagreement is visible.
   * Seeding "52 of 60 taken" against an empty table meant every seeded event
   * opened with a drift warning, which trains an operator to ignore the one
   * warning that matters.
   *
   * These rows also make the attendee list and the attendance register
   * demonstrable, which they were not before. They carry NO `donor_id`: the
   * column is nullable, and inventing donor accounts to sit behind demo
   * attendees would put fictional people in the donor table.
   *
   * Addresses are `@example.test`, which RFC 6761 reserves and which can never
   * resolve — so a demo environment with real email credentials cannot send
   * anything to a real person.
   * ══════════════════════════════════════════════════════════════════════════
   */
  const seededEvents = await db
    .select({ id: events.id, slug: events.slug, registeredCount: events.registeredCount })
    .from(events)
    .where(
      inArray(
        events.slug,
        eventSeeds.map((event) => event.slug),
      ),
    );

  for (const event of seededEvents) {
    // Rewritten from scratch each run, so a reseed does not accumulate a
    // second set of attendees against the same counter it is meant to match.
    await db.delete(eventRegistrations).where(eq(eventRegistrations.eventId, event.id));

    if (event.registeredCount <= 0) continue;

    const attendees = Array.from({ length: event.registeredCount }, (_, index) => ({
      eventId: event.id,
      fullName: `Demo Attendee ${index + 1}`,
      email: `demo-attendee-${index + 1}.${event.slug}@example.test`,
      phone: '9800000000',
      attendeeCount: 1,
      status: 'registered' as const,
    }));

    await db.insert(eventRegistrations).values(attendees).onConflictDoNothing();
  }

  // Impact updates --------------------------------------------------------
  await db
    .insert(impactUpdates)
    .values([
      {
        campaignId: campaignIds.get('school-kits-jharkhand') ?? null,
        programId: programIds.get('education') ?? null,
        title: 'Reading corners installed across fourteen schools',
        slug: 'reading-corners-installed-across-fourteen-schools',
        description:
          'Demo impact update. Final-period attendance rose over the term; reading assessment scores did not move measurably, which is what we expected over a single term.',
        impactDate: '2026-08-28',
        location: 'Ranchi, Jharkhand',
        metricType: 'reading_corners',
        metricValue: 14,
        verificationMethod: 'Counted from installation records at each partner school.',
        status: 'published',
        isPublic: true,
        publishedAt: new Date(),
      },
      {
        campaignId: campaignIds.get('mobile-health-clinic-bastar') ?? null,
        programId: programIds.get('healthcare') ?? null,
        title: 'Clinic route extended to four additional villages',
        slug: 'clinic-route-extended-to-four-additional-villages',
        description: 'Demo impact update describing the extended monthly route.',
        impactDate: '2026-08-05',
        location: 'Bastar, Chhattisgarh',
        metricType: 'villages',
        metricValue: 30,
        verificationMethod: 'Route schedule maintained by the field team.',
        status: 'published',
        isPublic: true,
        publishedAt: new Date(),
      },
    ])
    .onConflictDoNothing();

  /**
   * Demo donors, and a confirmed donation each.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * DEVELOPMENT ONLY. `assertDemoSeedAllowed()` refuses to run any of this
   * outside development, which matters more here than anywhere else in the
   * file: a campaign page publishes these names and amounts, and demo donors on
   * a live site would be fabricated social proof on a page asking strangers for
   * money.
   *
   * One is ANONYMOUS, so the campaign page's anonymity path is exercised every
   * time somebody looks at the page rather than only in the tests.
   *
   * These are written straight to `successful`, which is the only place that
   * happens. In the running system the single route into that status is a
   * verified Razorpay payment (decision A3), and nothing here is a precedent
   * for a service doing the same.
   * ══════════════════════════════════════════════════════════════════════════
   */
  const demoDonors = [
    {
      code: 'DNR-2026-00001',
      first: 'Demo',
      last: 'Donor',
      email: 'donor@sailent.local',
      phone: '9000000001',
      anonymous: false,
      amount: 50_000,
      hoursAgo: 2,
    },
    {
      code: 'DNR-2026-00002',
      first: 'Ananya',
      last: 'Iyer',
      email: 'ananya.demo@sailent.local',
      phone: '9000000002',
      anonymous: false,
      amount: 31_900,
      hoursAgo: 5,
    },
    {
      code: 'DNR-2026-00003',
      first: 'Raghavendra',
      last: 'Rao',
      email: 'raghav.demo@sailent.local',
      phone: '9000000003',
      anonymous: false,
      amount: 50_000,
      hoursAgo: 26,
    },
    {
      code: 'DNR-2026-00004',
      first: 'Kabir',
      last: 'Sheikh',
      email: 'kabir.demo@sailent.local',
      phone: '9000000004',
      anonymous: true,
      amount: 150_000,
      hoursAgo: 50,
    },
    {
      code: 'DNR-2026-00005',
      first: 'Meenakshi',
      last: 'Pillai',
      email: 'meenakshi.demo@sailent.local',
      phone: '9000000005',
      anonymous: false,
      amount: 30_000,
      hoursAgo: 74,
    },
  ];

  /*
    EVERY campaign gets the same five, not just one.

    Seeding a single campaign meant the Recent Donors section simply did not
    render on the other four — correct behaviour (nothing is invented when there
    is nothing to show) that reads as a missing section when you are reviewing
    the design on whichever campaign you happened to open.
  */
  /*
    Clear PRIOR demo donations first.

    An earlier version of this seed keyed its references differently, so
    re-running it left two sets of the same five people on one campaign — which
    put ten rows behind a five-row list and pushed the anonymous donor out of
    it, exactly where the anonymity path most wants exercising.
  */
  await db.delete(donations).where(sql`reference LIKE 'DON-DEMO-%'`);

  const demoCampaigns = await db
    .select({ id: campaigns.id, programId: campaigns.programId, slug: campaigns.slug })
    .from(campaigns);

  for (const [campaignIndex, demoCampaign] of demoCampaigns.entries()) {
    for (const person of demoDonors) {
      await db
        .insert(donors)
        .values({
          donorCode: person.code,
          firstName: person.first,
          lastName: person.last,
          email: person.email,
          phone: person.phone,
          communicationConsent: true,
        })
        .onConflictDoNothing();

      const [donorRow] = await db
        .select({ id: donors.id })
        .from(donors)
        .where(eq(donors.email, person.email))
        .limit(1);

      if (!donorRow) continue;

      await db
        .insert(donations)
        .values({
          /*
            `reference` is varchar(24), so the key is the campaign's INDEX
            rather than its slug — `DON-DEMO-3-00001` fits where
            `DON-DEMO-flood-relief-balasore-00001` does not. Deterministic, so
            re-running the seed updates each row instead of adding another.
          */
          reference: `DON-DEMO-${campaignIndex}-${person.code.slice(-5)}`,
          donorId: donorRow.id,
          campaignId: demoCampaign.id,
          programId: demoCampaign.programId,
          donationType: 'custom',
          amount: person.amount,
          currency: 'INR',
          status: 'successful',
          provider: 'razorpay',
          anonymous: person.anonymous,
          source: 'seed',
          completedAt: new Date(Date.now() - person.hoursAgo * 3600_000),
        })
        .onConflictDoNothing();
    }
  }

  /**
   * One applicant plus a small approved cohort.
   *
   * The homepage's "Volunteers" figure is a COUNT OF ROWS WITH STATUS ACTIVE
   * (decision A14 — it is an aggregate, not a typed-in number), so with only an
   * applicant in the table the figure is zero and the stat does not render at
   * all. These give it something true to count.
   *
   * Every one is fictional. `volunteerId` follows the VOL-YYYY-NNNNN format
   * from decision A13 and is assigned here because these rows are seeded as
   * already-approved; the real sequence assigns it at approval.
   */
  const volunteerSeeds = [
    {
      firstName: 'Demo',
      lastName: 'Volunteer',
      email: 'volunteer@sailent.local',
      phone: '9000000002',
      status: 'applied' as const,
      volunteerId: null,
      skills: ['Teaching or tutoring'],
      interests: ['Education'],
    },
    ...Array.from({ length: 12 }, (_, index) => ({
      firstName: 'Demo',
      lastName: `Volunteer ${index + 1}`,
      email: `volunteer.${index + 1}@sailent.local`,
      phone: `90000001${String(index + 10).padStart(2, '0')}`,
      status: 'active' as const,
      volunteerId: `VOL-2026-${String(index + 1).padStart(5, '0')}`,
      skills: ['Teaching or tutoring'],
      interests: ['Education'],
    })),
  ];

  for (const volunteer of volunteerSeeds) {
    await db.insert(volunteers).values(volunteer).onConflictDoNothing();
  }

  console.log(
    `  ✓ ${programSeeds.length} programs, ${campaignSeeds.length} campaigns, ` +
      `${team.length} team members, ${eventSeeds.length} events, ` +
      `${storySeeds.length} stories, 2 impact updates`,
  );
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const referenceOnly = process.argv.includes('--reference');

  /*
    ══════════════════════════════════════════════════════════════════════════
    WHICH DATABASE, DECIDED BEFORE A CONNECTION IS EVEN OPENED.

    This read `process.env.DATABASE_URL` and started inserting. It was the last
    command that could reach a live database without anybody saying so out
    loud — `db:create-admin`, `db:rotate-admin-password`, `db:harden` and
    `db:prepare-e2e` were all given this guard after a test run rotated the
    production administrator's password.

    What the seed can do to a production database is not small. Even
    `--reference`, the narrow mode, DELETES every SUPER_ADMIN grant before
    re-inserting it — so there is a window in which the only administrator has
    no permissions — and it upserts category names and slugs, which are public
    URLs.

    `variables: ['DATABASE_URL']` is deliberate: the seed has exactly one
    legitimate source, and reading only that makes "never silently fall back"
    structural rather than a rule somebody has to remember. A
    `DATABASE_MIGRATION_URL`, `TEST_DATABASE_URL` or `E2E_DATABASE_URL` set in
    the environment cannot reach this command at all.
    ══════════════════════════════════════════════════════════════════════════
  */
  const flags = parseTargetFlags(process.argv.slice(2));
  const target = resolveDatabaseTarget(process.env, {
    command: 'db:seed',
    declared: flags.declared,
    confirmedHost: flags.confirmedHost,
    variables: ['DATABASE_URL'],
  });
  const connectionString = target.connectionString;

  console.log(
    `[seed] Target: ${target.host}/${target.database} (${target.kind}, from ${target.source}).`,
  );

  const client = createDatabaseClient({
    connectionString,
    maxConnections: 1,
    // Honoured so a developer who has had to set it for the app does not hit a
    // different failure here. It is still refused in production by the config.
    insecureTls: process.env.DATABASE_INSECURE_TLS === 'true',
  });

  try {
    /*
      SAY WHICH DATABASE, BEFORE WRITING ANYTHING.

      The seed writes demo programmes, campaigns and five staff accounts with a
      known password. Running it against the wrong database is as consequential
      as migrating against the wrong one, and until now it announced nothing at
      all — it simply started inserting.
    */
    const alive = await announceConnection(client, {
      info: (message) => console.log(`[seed] ${message}`),
      warn: (message) => console.warn(`[seed] ${message}`),
      error: (message) => console.error(`[seed] ${message}`),
    });
    if (!alive) throw new Error('Cannot reach the database — see above.');

    console.log('[seed] reference data…');
    await seedPermissionsAndRoles(client.db);
    await seedCategories(client.db);
    await seedSettings(client.db);
    await seedNotificationTemplates(client.db);

    if (referenceOnly) {
      console.log('[seed] reference data only — demo content skipped');
      return;
    }

    assertDemoSeedAllowed();

    console.log('[seed] demo content (development only)…');
    await seedDevelopmentAdmin(client.db);
    await seedDemoContent(client.db);

    console.log('[seed] done');
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  // A refusal is guidance, not a stack trace: it names what was wrong and what
  // to type instead.
  if (error instanceof DatabaseTargetError) {
    console.error(`\n[seed] REFUSED\n${error.message}\n`);
    process.exit(1);
  }
  console.error('[seed] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

export { sql };
