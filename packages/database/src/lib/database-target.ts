/**
 * Which database is this command about to write to?
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS EXISTS BECAUSE A TEST ROTATED THE PRODUCTION ADMINISTRATOR'S PASSWORD.
 *
 * `db:rotate-admin-password` resolved its target as:
 *
 *     DATABASE_MIGRATION_URL || DATABASE_URL
 *
 * A test run set one of those to a local database and left the other pointing
 * at Supabase. The command picked the wrong one, connected to production,
 * changed a real credential to a value nobody recorded, and reported success.
 * Nothing in it ever asked whether that was an appropriate place to do this.
 *
 * Three properties fix that, and all three are needed:
 *
 *   1. NO FALLBACK CHAIN. Two variables that disagree is an ambiguous
 *      instruction, not an opportunity to guess. It is refused.
 *   2. THE OPERATOR DECLARES THE ENVIRONMENT, and the guard checks the
 *      declaration against the connection that was actually resolved. Being
 *      wrong is then a refusal rather than a silent success.
 *   3. PRODUCTION NEEDS A TYPED CONFIRMATION of the host. A flag can be left
 *      in shell history and re-run by accident; a hostname somebody had to
 *      read off the error message and type back cannot be.
 *
 * NOT A SUBSTRING CHECK. The previous guards tested the connection string
 * with a regex, which `localhost.attacker.example.com` satisfies. This parses
 * the URL and compares the HOSTNAME exactly.
 *
 * Pure: it takes an environment rather than reading `process.env`, so the
 * refusals can be tested without a database anywhere near them.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Hostnames that are a developer's own machine, matched EXACTLY. */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal']);

export type TargetKind = 'local' | 'remote';

/** What the operator said they meant. There is no default. */
export type DeclaredTarget = 'local' | 'production';

export interface ResolvedTarget {
  connectionString: string;
  kind: TargetKind;
  host: string;
  database: string;
  /** The variable it came from, so the operator can see what was used. */
  source: string;
}

export class DatabaseTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseTargetError';
  }
}

/**
 * The variables a command may take its target from, in no priority order.
 *
 * A DEFAULT, not a fixed list — a command can narrow it. `db:seed` passes
 * `['DATABASE_URL']`, so no other variable can reach it at all: the strongest
 * form of "never silently fall back" is being unable to read the alternative.
 *
 * It deliberately does NOT include `TEST_DATABASE_URL` or `E2E_DATABASE_URL`.
 * Those are set, and set to different databases, in every developer's `.env` by
 * design — treating them as candidates here would make every command refuse as
 * ambiguous on a correctly configured machine, which teaches people to work
 * around the guard.
 */
const DEFAULT_TARGET_VARIABLES = ['DATABASE_URL', 'DATABASE_MIGRATION_URL'] as const;

function parse(connectionString: string, source: string): ResolvedTarget {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new DatabaseTargetError(`${source} is not a valid connection URL. Nothing was done.`);
  }

  const host = url.hostname;
  const database = url.pathname.replace(/^\//, '') || '(none)';

  return {
    connectionString,
    // Exact hostname, never a substring: `localhost.example.com` is remote.
    kind: LOCAL_HOSTNAMES.has(host) ? 'local' : 'remote',
    host,
    database,
    source,
  };
}

/**
 * Resolve and authorise the target, or throw.
 *
 * @param env  The environment to read. Passed in so this is testable.
 */
export function resolveDatabaseTarget(
  env: Record<string, string | undefined>,
  options: {
    /** The command's name, for messages. */
    command: string;
    /** What the operator declared. `null` means they said nothing. */
    declared: DeclaredTarget | null;
    /** The hostname the operator typed back to confirm a production run. */
    confirmedHost?: string | null;
    /**
     * Which variables this command reads. Narrow it to one where a command has
     * exactly one legitimate source, which removes the fallback question
     * entirely rather than answering it.
     */
    variables?: readonly string[];
  },
): ResolvedTarget {
  const candidates = options.variables ?? DEFAULT_TARGET_VARIABLES;
  const present = candidates.filter((name) => (env[name] ?? '').trim().length > 0);

  // ---- missing -----------------------------------------------------------
  if (present.length === 0) {
    throw new DatabaseTargetError(
      `${options.command}: no database target is configured.\n` +
        `  Set exactly one of ${candidates.join(' or ')} and say which environment you mean:\n` +
        `      DATABASE_URL=… pnpm … ${options.command} --target=local`,
    );
  }

  // ---- ambiguous ---------------------------------------------------------
  /*
    THE ACTUAL BUG. Two variables set to DIFFERENT databases used to mean
    "quietly prefer this one". It now means "say what you meant", because the
    cost of guessing wrong here is a changed production credential.
  */
  const distinct = new Set(present.map((name) => env[name]!.trim()));
  if (distinct.size > 1) {
    const described = present
      .map((name) => `    ${name} → ${parse(env[name]!.trim(), name).host}`)
      .join('\n');
    throw new DatabaseTargetError(
      `${options.command}: two different database targets are configured and this command will not choose between them.\n` +
        `${described}\n` +
        `  Unset one, or run with only the one you mean in the environment.`,
    );
  }

  const source = present[0]!;
  const target = parse(env[source]!.trim(), present.length > 1 ? present.join(' = ') : source);

  // ---- undeclared --------------------------------------------------------
  if (options.declared === null) {
    throw new DatabaseTargetError(
      `${options.command}: say which environment you are targeting.\n` +
        `  Resolved ${target.source} → ${target.host}/${target.database} (${target.kind}).\n` +
        `  Re-run with --target=local for a development or test database,\n` +
        `  or --target=production for a real one.`,
    );
  }

  // ---- the declaration must match reality ---------------------------------
  if (options.declared === 'local' && target.kind === 'remote') {
    throw new DatabaseTargetError(
      `${options.command}: --target=local was given, but ${target.source} points at ${target.host}, which is not a local database.\n` +
        `  Refusing. This is exactly the mistake that changed a production credential during testing.`,
    );
  }

  if (options.declared === 'production' && target.kind === 'local') {
    throw new DatabaseTargetError(
      `${options.command}: --target=production was given, but ${target.source} points at ${target.host}, which IS local.\n` +
        `  Refusing rather than proceeding, because one of the two is wrong and guessing which would defeat the point.`,
    );
  }

  // ---- production needs the host typed back -------------------------------
  if (options.declared === 'production') {
    const confirmation = (options.confirmedHost ?? '').trim();
    if (confirmation !== target.host) {
      throw new DatabaseTargetError(
        `${options.command}: this is a PRODUCTION operation against ${target.host}/${target.database}.\n` +
          `  Confirm by repeating the host exactly:\n` +
          `      --confirm-host=${target.host}\n` +
          (confirmation.length > 0
            ? `  (got "${confirmation}", which does not match)`
            : '  Nothing was done.'),
      );
    }
  }

  return target;
}

/**
 * The E2E database must never be the application's.
 *
 * Its own guard because the failure is different in kind: not "wrote to the
 * wrong database" but "the isolated database was never isolated", which is
 * how a test suite came to create a Super Admin in staging on every run.
 */
export function assertDistinctFromApplication(
  e2eUrl: string,
  env: Record<string, string | undefined>,
  command: string,
): void {
  if (env.DATABASE_URL && e2eUrl.trim() === env.DATABASE_URL.trim()) {
    throw new DatabaseTargetError(
      `${command}: E2E_DATABASE_URL and DATABASE_URL are the same database.\n` +
        `  The E2E suite needs its own, so its fixtures cannot be mistaken for real accounts.`,
    );
  }
}

/** `--target=…`, `--confirm-host=…`, tolerating `--target local` too. */
export function parseTargetFlags(argv: string[]): {
  declared: DeclaredTarget | null;
  confirmedHost: string | null;
} {
  const read = (name: string): string | null => {
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (inline) return inline.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && argv[index + 1] && !argv[index + 1]!.startsWith('--')
      ? argv[index + 1]!
      : null;
  };

  const declared = read('target');
  if (declared !== null && declared !== 'local' && declared !== 'production') {
    throw new DatabaseTargetError(`--target must be "local" or "production", not "${declared}".`);
  }

  return { declared, confirmedHost: read('confirm-host') };
}

// ---------------------------------------------------------------------------
// The RUNTIME guard
// ---------------------------------------------------------------------------

/**
 * Which database the running APPLICATION is allowed to open.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SECOND QUESTION, NOT A SECOND SYSTEM.
 *
 * Everything above answers "is this OPERATOR allowed to run this COMMAND here",
 * and it works by making a person declare an environment and type a hostname
 * back. That is right for `db:migrate`, and useless for a long-running server:
 * there is nobody at a terminal to declare anything.
 *
 * The application already declares its environment — `APP_ENV`, which this
 * repository documents as development | test | staging | production and which
 * drives configuration strictness everywhere else. So the runtime question is
 * whether `APP_ENV` and the resolved `DATABASE_URL` AGREE, and the answer is
 * computed from the same parsed URL and the same local-hostname set the
 * command guard uses.
 *
 * WHAT IT IS FOR. A local `.env` carried the production Supabase URL while
 * `APP_ENV=development`. Nothing was wrong with either value on its own, and
 * nothing looked wrong at boot — the API started, served, and wrote to
 * production. A draft written in a local admin UI landed in the live database.
 * The pairing was the fault, and only something that sees both can catch it.
 *
 * IT NEVER REWRITES ANYTHING. It inspects and it refuses. Silently correcting
 * a connection string would mean the process connects somewhere the operator
 * did not configure, which is the same class of surprise in the other
 * direction.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** `APP_ENV`, as this repository documents it. */
export type AppEnvironment = 'development' | 'test' | 'staging' | 'production';

/**
 * The Supabase session pooler this project's production database lives behind.
 *
 * A HOSTNAME IS NOT A CREDENTIAL. It is already in the guarded commands'
 * `--confirm-host` examples and in the deployment documentation, and something
 * has to be compared against or "is this production" is unanswerable. The
 * password stays in the environment, where it belongs.
 *
 * Overridable through `PRODUCTION_DATABASE_HOST` so a future migration to
 * another provider is a configuration change rather than a code change.
 */
export const PRODUCTION_DATABASE_HOST = 'aws-0-ap-south-1.pooler.supabase.com';

/**
 * The local databases a non-production process may open.
 *
 * `sailent_e2e` is in the list on purpose. The Playwright stack starts the API
 * with `APP_ENV=development` and points it at the E2E database — that IS the
 * isolation, and a rule that admitted only `sailent_dev` would break it.
 */
export const LOCAL_DATABASES = ['sailent_dev', 'sailent_e2e', 'sailent_test'] as const;

/**
 * Safe to log and safe to put in an error: no user, no password, no query.
 *
 * Named apart from `announce.ts`'s `describeTarget`, which describes an
 * already-built client's connection. This one describes a target that has not
 * been opened yet, which is the whole point — it is what the refusal message
 * is built from.
 */
export function describeRuntimeTarget(target: ResolvedTarget, appEnv: string): string {
  return `host=${target.host} database=${target.database} environment=${appEnv}`;
}

/**
 * Refuse to open a database the environment does not match.
 *
 * Returns the resolved target so the caller can log it. Throws
 * `DatabaseTargetError` otherwise — and the message carries the host, the
 * database name and the environment, never the connection string.
 */
export function assertRuntimeDatabaseTarget(options: {
  appEnv: string;
  connectionString: string;
  /** For the message, so the operator knows which variable to edit. */
  variable?: string;
  /** Defaults to `PRODUCTION_DATABASE_HOST`. */
  productionHost?: string;
}): ResolvedTarget {
  const variable = options.variable ?? 'DATABASE_URL';
  const productionHost = options.productionHost ?? PRODUCTION_DATABASE_HOST;
  const target = parse(options.connectionString, variable);
  const where = describeRuntimeTarget(target, options.appEnv);

  const refuse = (reason: string, remedy: string): never => {
    throw new DatabaseTargetError(
      `Unsafe database configuration: ${reason}\n  ${where}\n  ${remedy}`,
    );
  };

  switch (options.appEnv) {
    case 'development':
    case 'test': {
      if (target.kind !== 'local') {
        return refuse(
          `the ${options.appEnv} environment cannot connect to a remote database.`,
          `Point ${variable} at a local database, or set APP_ENV to match the database you mean.`,
        );
      }
      if (!(LOCAL_DATABASES as readonly string[]).includes(target.database)) {
        return refuse(
          `"${target.database}" is not one of this project's local databases.`,
          `Expected one of: ${LOCAL_DATABASES.join(', ')}.`,
        );
      }
      return target;
    }

    case 'staging': {
      if (target.kind === 'local') {
        return refuse(
          'the staging environment cannot connect to a local database.',
          `Point ${variable} at the staging database.`,
        );
      }
      if (target.host === productionHost) {
        // Staging pointed at production is the failure this whole file exists
        // to prevent, wearing a different label.
        return refuse(
          'the staging environment cannot connect to the production database.',
          'Use the staging database, or set APP_ENV=production if production is what you mean.',
        );
      }
      return target;
    }

    case 'production': {
      if (target.kind === 'local') {
        return refuse(
          'the production environment cannot connect to a local database.',
          `Set ${variable} to the production database in the production runtime.`,
        );
      }
      if ((LOCAL_DATABASES as readonly string[]).includes(target.database)) {
        return refuse(
          `"${target.database}" is a development database and cannot be used in production.`,
          `Set ${variable} to the production database.`,
        );
      }
      if (target.host !== productionHost) {
        return refuse(
          `${target.host} is not the approved production database host.`,
          `Expected ${productionHost}. Set PRODUCTION_DATABASE_HOST if the provider has changed.`,
        );
      }
      return target;
    }

    default:
      return refuse(
        `APP_ENV="${options.appEnv}" is not a recognised environment.`,
        'Expected one of: development, test, staging, production.',
      );
  }
}
