import type { Logger } from 'pino';

export interface BrevoConfig {
  apiKey?: string;
  senderEmail?: string;
  senderName: string;
}

export interface EmailMessage {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  /** Threads replies and lets Brevo deduplicate. Our receipt number. */
  tags?: string[];
}

export type SendResult =
  | { sent: true; providerMessageId: string | null }
  | { sent: false; reason: 'not_configured' | 'rejected' | 'unreachable'; detail?: string };

/**
 * Brevo, over its REST API.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * IT FAILS SOFT, ALWAYS, AND THAT IS THE DESIGN.
 *
 * Nothing this returns can roll back a donation. By the time a job reaches
 * here the money has been taken, the counters have moved and the receipt has a
 * number — all committed. An email provider having a bad afternoon is an
 * inconvenience; a donation reversed because a mail server timed out is a
 * failure of a different order.
 *
 * So `send` never throws. It reports what happened and the caller records
 * that, which is why the return type distinguishes "not configured" from
 * "rejected" from "unreachable": the first is expected on a development
 * machine, the second is a permanent failure not worth retrying, and only the
 * third should be tried again.
 *
 * WITHOUT AN API KEY it reports `not_configured` and sends nothing. The
 * notification row is still written and left unsent, so the backlog is visible
 * rather than lost — which matters, because a donor who did not receive a
 * receipt will eventually ask for one.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function sendEmail(
  config: BrevoConfig,
  message: EmailMessage,
  logger: Logger,
): Promise<SendResult> {
  if (!config.apiKey || !config.senderEmail) {
    logger.warn(
      { to: message.to.email, subject: message.subject },
      'Brevo is not configured — the notification is recorded but not sent',
    );
    return { sent: false, reason: 'not_configured' };
  }

  let response: Response;
  try {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': config.apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: config.senderEmail, name: config.senderName },
        to: [{ email: message.to.email, ...(message.to.name ? { name: message.to.name } : {}) }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        tags: message.tags,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    return {
      sent: false,
      reason: 'unreachable',
      detail: error instanceof Error ? error.message : 'unknown',
    };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    /**
     * 4xx is permanent — a malformed address, a blocked recipient, a rejected
     * key. Retrying sends the same request to the same answer four more times
     * and delays the dead-letter that a human needs to see. 5xx is worth
     * another attempt.
     */
    const permanent = response.status >= 400 && response.status < 500;
    return {
      sent: false,
      reason: permanent ? 'rejected' : 'unreachable',
      detail: `${response.status}: ${detail.slice(0, 300)}`,
    };
  }

  const payload = (await response.json().catch(() => ({}))) as { messageId?: string };
  return { sent: true, providerMessageId: payload.messageId ?? null };
}
