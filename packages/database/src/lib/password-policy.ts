import { createInterface } from 'node:readline';
import * as argon2 from 'argon2';

/**
 * The staff password policy, and the one place it is defined.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SHARED BY `db:create-admin` AND `db:rotate-admin-password` ON PURPOSE.
 *
 * Two copies of a password policy drift, and the direction they drift is
 * always the same: the newer command gets the stricter rule and the older one
 * quietly keeps letting weaker passwords through. A rotation command that
 * accepts what provisioning would refuse is worse than no rotation command,
 * because it looks like it enforced something.
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * Identical to `apps/api/src/modules/auth/password.service.ts`.
 *
 * Repeated rather than imported because this package must not depend on the
 * API. `argon2.verify` reads the parameters back out of the encoded hash, so a
 * hash written here is verifiable by the application regardless — but matching
 * the parameters means a rotated password costs the same to check as any other,
 * which is the property the tuning was chosen for.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  raw: false,
} as const;

export const MINIMUM_PASSWORD_LENGTH = 12;

/**
 * Passwords refused outright.
 *
 * Not a strength meter — a guard against the specific failure these commands
 * exist to prevent: a published development credential reaching production.
 */
export const FORBIDDEN_PASSWORDS = new Set([
  'DevPassword123!',
  'password',
  'admin',
  'changeme',
  'sailent',
]);

/** Reserved for multicast DNS (RFC 6762 §3) — nobody can receive mail there. */
export const DEVELOPMENT_DOMAIN = '@sailent.local';

/**
 * Throws with a sentence a person can act on, or returns quietly.
 *
 * It never echoes the password back in the message, not even a fragment of it:
 * these commands are run in terminals whose scrollback is shared in bug
 * reports, and an error that quotes the rejected password defeats the point of
 * hiding the input in the first place.
 */
export function assertPasswordAcceptable(password: string): void {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error(`The password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
  }

  if (FORBIDDEN_PASSWORDS.has(password)) {
    throw new Error(
      'That is a known development or default password. Choose one that has never been published.',
    );
  }
}

/**
 * ONE readline interface, reused for every prompt.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A FRESH INTERFACE PER PROMPT SILENTLY DOES NOTHING ON PIPED INPUT.
 *
 * The first version created and closed an interface per question. Interactively
 * that works. Given piped stdin, closing the first one ends the stream, so the
 * second `question()` never receives a line, its promise never settles, the
 * event loop drains and node exits **0** — a command that appears to succeed
 * and changed nothing.
 *
 * That is the worst failure mode available to a credential-rotation tool, and
 * it is also why the command could not be tested: any non-interactive
 * invocation hit it.
 *
 * So: one interface, and every prompt also settles on `close`, which is what
 * EOF looks like. Running out of input is then an explicit error rather than a
 * silent success.
 * ══════════════════════════════════════════════════════════════════════════
 */
let sharedInterface: ReturnType<typeof createInterface> | null = null;

/** Lines that arrived before anything asked for them. */
const pendingLines: string[] = [];
/** Questions waiting for a line that has not arrived yet. */
const waiting: { resolve: (line: string) => void; reject: (error: Error) => void }[] = [];
let inputEnded = false;

function getInterface(): ReturnType<typeof createInterface> {
  if (sharedInterface) return sharedInterface;

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  /*
    A QUEUE, not `rl.question`.

    With piped input readline emits every line as fast as it can read them. The
    first `question()` takes line one; line two arrives while no question is
    pending and is simply DISCARDED, so the second prompt then waits for input
    that has already been and gone. Interactively nobody notices, because a
    human types the second line after being asked.

    Buffering the lines makes both cases behave the same, which is what allows
    this to be tested at all.
  */
  rl.on('line', (line) => {
    const next = waiting.shift();
    if (next) next.resolve(line);
    else pendingLines.push(line);
  });

  rl.on('close', () => {
    inputEnded = true;
    while (waiting.length > 0) {
      waiting
        .shift()!
        .reject(new Error('Input ended before the prompt was answered. Nothing was changed.'));
    }
  });

  sharedInterface = rl;
  return rl;
}

/** Close it once prompting is finished, so the process can exit. */
export function closePrompts(): void {
  sharedInterface?.close();
  sharedInterface = null;
}

function ask(question: string, hidden: boolean): Promise<string> {
  const rl = getInterface();

  const buffered = pendingLines.shift();
  if (buffered !== undefined) {
    // Already arrived. Still print the prompt so the transcript reads sensibly.
    process.stdout.write(question + (hidden ? '\n' : ''));
    return Promise.resolve(buffered);
  }

  if (inputEnded) {
    return Promise.reject(
      new Error('Input ended before the prompt was answered. Nothing was changed.'),
    );
  }

  return new Promise<string>((resolve, reject) => {
    const output = rl as unknown as { _writeToOutput?: unknown };
    const originalWrite = output._writeToOutput;

    process.stdout.write(question);
    if (hidden) output._writeToOutput = () => undefined;

    waiting.push({
      resolve: (line) => {
        if (hidden) {
          output._writeToOutput = originalWrite;
          process.stdout.write('\n');
        }
        resolve(line);
      },
      reject: (error) => {
        if (hidden) output._writeToOutput = originalWrite;
        reject(error);
      },
    });
  });
}

/**
 * Read a line with the echo suppressed.
 *
 * Nothing appears on screen, nothing reaches the shell history, and nothing is
 * passed as an argument — arguments are visible in `ps` output to every other
 * process on the machine, which is the reason these commands take no password
 * flag at all.
 */
export function promptHidden(question: string): Promise<string> {
  return ask(question, true);
}

/** An ordinary visible prompt, for things that are not secret. */
export function prompt(question: string): Promise<string> {
  return ask(question, false).then((answer) => answer.trim());
}

/** Local host check, shared by every command that writes to a database. */
export function isLocalDatabase(url: string): boolean {
  return /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/.test(url);
}
