import { createHash } from 'node:crypto';

import type { Logger } from 'pino';
import { Resend, type CreateEmailOptions, type CreateEmailRequestOptions } from 'resend';

import { emailSchema } from '@sailent/validation';

import { renderEmailLayout } from './email-layout.js';

/**
 * Transactional email, through Resend.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY EMAIL THE PLATFORM SENDS GOES THROUGH `sendEmail`, AND IT NEVER THROWS.
 *
 * Nothing this returns can roll back a donation. By the time a job reaches
 * here the money has been taken, the counters have moved and the receipt has
 * a number — all committed. An email provider having a bad afternoon is an
 * inconvenience; a donation reversed because a mail server timed out is a
 * failure of a different order.
 *
 * So `sendEmail` reports what happened and the caller records it. The three
 * outcomes are kept apart because they call for different things:
 *
 *   - `not_configured`: expected on a development machine. Nothing is sent and
 *     the notification row is still written, so the backlog stays visible.
 *   - `rejected`: permanent (a bad address, a refused key, an unverified
 *     sender). Retrying sends the same request to the same answer.
 *   - `unreachable`: a network failure, a timeout, a rate limit, a quota or a
 *     5xx — the only one the caller rethrows so BullMQ tries again.
 *
 * ONE CLIENT PER PROCESS. `createMailer` builds it once at startup and every
 * processor receives the same `Mailer`. It is built only when a key is set:
 * the SDK otherwise reads `RESEND_API_KEY` from the environment on its own,
 * or throws.
 *
 * A RETRY CANNOT SEND TWICE. Every send carries an idempotency key derived
 * from the message itself (sender, recipient, subject and bodies). A BullMQ
 * retry of a send whose response was lost — the case that duplicates email —
 * repeats the same key, and Resend answers it without sending again (keys
 * are kept for 24 hours). A different message gets a different key, so two
 * environments sharing one Resend account cannot collide.
 *
 * NOTHING SENSITIVE IS LOGGED. Not the recipient, not the body (which can
 * hold a sign-in code or a token), not the key. A provider's error message is
 * kept only after addresses are taken out of it.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface EmailConfig {
  /** `re_…`. Without it nothing is sent. */
  apiKey?: string;
  /** `Sailent Foundation <noreply@example.org>`, or a bare address. */
  from?: string;
  /** Where replies go unless a message names its own. */
  replyTo?: string;
  /** The public site, linked from every email's footer. */
  siteUrl?: string;
}

/** A file sent with the email, e.g. a pass's QR code. */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  /** e.g. `image/png`; derived from the filename when absent. */
  contentType?: string;
  /**
   * Shown INSIDE the email where the HTML says `<img src="cid:…">`, as well as
   * being attached. Letters, digits and `-` only.
   */
  contentId?: string;
}

export interface EmailMessage {
  /**
   * The recipient. Only the address goes in the header: a display name is
   * left out, so a name with a comma or quotes cannot change how the address
   * is read. Greetings in the body still use it.
   */
  to: { email: string; name?: string };
  subject: string;
  /** An HTML fragment, sent inside the shared layout (`email-layout.ts`). */
  html: string;
  text: string;
  /**
   * Labels in the provider's dashboard: the first is the category. Only
   * letters, digits, `_` and `-` survive (anything else becomes `_`), and
   * they are stored by the provider, so never personal data or a secret.
   */
  tags?: string[];
  /** Replies to this message go here, e.g. to the visitor who wrote in. */
  replyTo?: string;
  /** The inbox preview line. Never a code, a token or an address. */
  preheader?: string;
  attachments?: EmailAttachment[];
  /** A logo for the header, already among `attachments` under this content id. */
  headerLogo?: { contentId: string; width: number; height: number };
}

export type SendResult =
  | { sent: true; providerMessageId: string | null }
  | { sent: false; reason: 'not_configured' | 'rejected' | 'unreachable'; detail?: string };

interface ProviderError {
  name: string;
  message: string;
  statusCode?: number | null;
}

interface ProviderResponse {
  data: { id: string } | null;
  error: ProviderError | null;
  headers?: Record<string, string> | null;
}

/** The part of the Resend client this module uses; tests pass their own. */
export interface EmailClient {
  emails: {
    send(
      payload: CreateEmailOptions,
      options?: CreateEmailRequestOptions,
    ): Promise<ProviderResponse>;
  };
}

export interface Mailer {
  /** False without a key and a sender: every send then reports `not_configured`. */
  readonly configured: boolean;
  readonly client: EmailClient | null;
  readonly from: string | null;
  readonly replyTo: string | null;
  readonly brandName: string;
  readonly siteUrl: string | null;
}

const DEFAULT_BRAND = 'Sailent Foundation';
/** A send that has not answered in this long is treated as unreachable. */
const SEND_TIMEOUT_MS = 15_000;
/** The longest a rate-limited send waits before its one in-process retry. */
const MAX_RATE_LIMIT_WAIT_MS = 5_000;

const SENDER = /^\s*"?([^"<>]*?)"?\s*<([^<>\s]+)>\s*$/;

/** `Name <address>` or a bare address, split. */
export function senderParts(value: string): { name: string | null; address: string } {
  const match = SENDER.exec(value);
  if (!match) return { name: null, address: value.trim() };
  return { name: match[1]!.trim() || null, address: match[2]! };
}

function isEmailAddress(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

export function createMailer(config: EmailConfig, client?: EmailClient): Mailer {
  const from = config.from?.trim() || null;
  const configured = Boolean(config.apiKey && from);
  return {
    configured,
    client: configured ? (client ?? new Resend(config.apiKey)) : null,
    from,
    replyTo: config.replyTo?.trim() || null,
    brandName: (from && senderParts(from).name) || DEFAULT_BRAND,
    siteUrl: config.siteUrl ?? null,
  };
}

/** What the worker prints at startup: whether email works, and from which domain. */
export function describeMailer(mailer: Mailer): {
  provider: 'resend';
  configured: boolean;
  senderDomain: string | null;
} {
  const address = mailer.from ? senderParts(mailer.from).address : null;
  return {
    provider: 'resend',
    configured: mailer.configured,
    senderDomain: address?.split('@')[1] ?? null,
  };
}

/** Resend accepts letters, digits, `_` and `-`, up to 256 characters. */
function tagValue(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256);
}

function tagsFor(tags: string[] | undefined): { name: string; value: string }[] {
  return (tags ?? [])
    .map(tagValue)
    .filter((value) => value.length > 0)
    .map((value, index) => ({
      name: index === 0 ? 'category' : index === 1 ? 'ref' : `ref${index}`,
      value,
    }));
}

/** The same message always gets the same key; any difference, a new one. */
function idempotencyKeyFor(
  payload: { from: string; to: string[]; subject: string; html: string; text: string },
  replyTo: string | null,
  attachments: EmailAttachment[],
  category: string,
): string {
  const digest = createHash('sha256')
    .update(
      JSON.stringify([
        payload.from,
        payload.to,
        payload.subject,
        payload.html,
        payload.text,
        replyTo,
        attachments.map((file) => [
          file.filename,
          file.contentId ?? null,
          createHash('sha256').update(file.content).digest('hex'),
        ]),
      ]),
    )
    .digest('hex')
    .slice(0, 32);
  return `${category}-${digest}`;
}

const RETRYABLE = new Set([
  'rate_limit_exceeded',
  'daily_quota_exceeded',
  'monthly_quota_exceeded',
  'concurrent_idempotent_requests',
  'internal_server_error',
  // The SDK's name for a network failure, a timeout or an unreadable answer.
  'application_error',
]);

function classify(error: ProviderError): 'rejected' | 'unreachable' {
  if (RETRYABLE.has(error.name)) return 'unreachable';
  const status = error.statusCode;
  if (typeof status === 'number' && (status === 429 || status >= 500)) return 'unreachable';
  return 'rejected';
}

/** A provider's message with any address or key taken out, kept short. */
function redact(text: string): string {
  return text
    .replace(/[^\s<>"'`(),;:]+@[^\s<>"'`(),;:]+/g, '[address]')
    .replace(/re_[A-Za-z0-9_-]{6,}/g, '[key]')
    .slice(0, 300);
}

function describeProviderError(error: ProviderError): string {
  const status = typeof error.statusCode === 'number' ? ` (${error.statusCode})` : '';
  return `${error.name}${status}: ${redact(error.message ?? '')}`;
}

function retryAfterMs(headers: Record<string, string> | null | undefined): number {
  const seconds = Number(headers?.['retry-after']);
  if (!Number.isFinite(seconds) || seconds < 0) return 1_000;
  return Math.min(seconds * 1_000, MAX_RATE_LIMIT_WAIT_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail(
  mailer: Mailer,
  message: EmailMessage,
  logger: Logger,
): Promise<SendResult> {
  if (!mailer.client || !mailer.from) {
    // Never the recipient's address: it is personal data, and the send log
    // already records who the message was for (Phase 13).
    logger.warn(
      { subject: message.subject, tags: message.tags },
      'Email is not configured (RESEND_API_KEY, RESEND_FROM_EMAIL) — the notification is recorded but not sent',
    );
    return { sent: false, reason: 'not_configured' };
  }

  const to = message.to.email.trim();
  if (!isEmailAddress(to)) {
    logger.warn({ tags: message.tags }, 'Email not sent: the recipient is not a valid address');
    return { sent: false, reason: 'rejected', detail: 'invalid_recipient' };
  }

  // A message's own reply-to (a visitor's address) is used only if it is a
  // real address; otherwise replies go where every other email's do.
  const ownReplyTo = message.replyTo?.trim();
  const replyTo = ownReplyTo && isEmailAddress(ownReplyTo) ? ownReplyTo : mailer.replyTo;
  const tags = tagsFor(message.tags);

  const body = {
    from: mailer.from,
    to: [to],
    subject: message.subject,
    html: renderEmailLayout(message.html, {
      subject: message.subject,
      brandName: mailer.brandName,
      preheader: message.preheader,
      siteUrl: mailer.siteUrl,
      logo: message.headerLogo ?? null,
    }),
    text: message.text,
  };
  const attachments = message.attachments ?? [];
  const payload: CreateEmailOptions = {
    ...body,
    ...(replyTo ? { replyTo } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(attachments.length > 0
      ? {
          // Base64, the form Resend documents for file content.
          attachments: attachments.map((file) => ({
            filename: file.filename,
            content: file.content.toString('base64'),
            ...(file.contentType ? { contentType: file.contentType } : {}),
            ...(file.contentId ? { contentId: file.contentId } : {}),
          })),
        }
      : {}),
  };
  const idempotencyKey = idempotencyKeyFor(body, replyTo, attachments, tags[0]?.value ?? 'email');

  for (let attempt = 0; ; attempt += 1) {
    let response: ProviderResponse;
    try {
      response = await mailer.client.emails.send(payload, {
        idempotencyKey,
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch (error) {
      // The SDK reports failures as values; this is for anything it did not.
      return {
        sent: false,
        reason: 'unreachable',
        detail: `unexpected: ${redact(error instanceof Error ? error.message : String(error))}`,
      };
    }

    if (!response.error) {
      return { sent: true, providerMessageId: response.data?.id ?? null };
    }

    const { error } = response;
    /*
      A burst (an event cancelled for a full hall) can outrun the account's
      per-second limit. One short wait and the same request again — safe,
      because the idempotency key is the same — beats failing the job.
    */
    if (error.name === 'rate_limit_exceeded' && attempt === 0) {
      await sleep(retryAfterMs(response.headers));
      continue;
    }

    const reason = classify(error);
    logger.warn(
      {
        tags: message.tags,
        reason,
        provider: { name: error.name, statusCode: error.statusCode ?? null },
      },
      'The email provider did not accept the message',
    );
    return { sent: false, reason, detail: describeProviderError(error) };
  }
}
