import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMailer,
  describeMailer,
  senderParts,
  sendEmail,
  type EmailClient,
  type EmailMessage,
} from './email.js';
import { isFullDocument, renderEmailLayout } from './email-layout.js';

/**
 * The email seam, with Resend replaced by a fake: no test here sends an email.
 *
 * Most tests hand `createMailer` a fake client and look at what it was asked
 * to send. The last group runs the REAL Resend SDK with `fetch` stubbed, so
 * the request that would reach Resend — URL, key, idempotency header, body —
 * is checked as Resend would see it.
 */

const logs: unknown[] = [];
const logger = {
  info: (...args: unknown[]) => logs.push(args),
  warn: (...args: unknown[]) => logs.push(args),
  error: (...args: unknown[]) => logs.push(args),
  debug: (...args: unknown[]) => logs.push(args),
} as never;

const CONFIG = {
  apiKey: 're_test_1234567890abcdef',
  from: 'Sailent Foundation <noreply@sailent.test>',
  replyTo: 'contact@sailent.test',
  siteUrl: 'https://sailent.test/',
};

const MESSAGE: EmailMessage = {
  to: { email: 'donor@example.org', name: 'Asha' },
  subject: 'Thank you — your donation',
  html: '<p>Dear Asha,</p><p>Thank you.</p>',
  text: 'Dear Asha,\n\nThank you.',
  tags: ['donation-confirmation', 'SFL-2026-000001'],
};

type Answer =
  | {
      data?: { id: string } | null;
      error?: { name: string; message: string; statusCode: number | null } | null;
      headers?: Record<string, string>;
    }
  | Error;

interface Call {
  payload: Record<string, unknown>;
  options: { idempotencyKey?: string; signal?: AbortSignal };
}

/** A Resend client that answers from a script and records every request. */
function fakeClient(...answers: Answer[]) {
  const calls: Call[] = [];
  const client: EmailClient = {
    emails: {
      send: vi.fn(async (payload, options) => {
        calls.push({ payload: payload as never, options: (options ?? {}) as never });
        const answer = answers.shift() ?? { data: { id: 'msg_1' } };
        if (answer instanceof Error) throw answer;
        return {
          data: answer.data ?? null,
          error: answer.error ?? null,
          headers: answer.headers ?? null,
        };
      }),
    },
  };
  return { client, calls };
}

function failure(name: string, statusCode: number | null, message = 'refused'): Answer {
  return { error: { name, statusCode, message } };
}

beforeEach(() => {
  logs.length = 0;
});

describe('sendEmail', () => {
  it('sends from the configured sender, with reply-to, tags, the layout and a retry-safe key', async () => {
    const { client, calls } = fakeClient({ data: { id: 'msg_42' } });

    const result = await sendEmail(createMailer(CONFIG, client), MESSAGE, logger);

    expect(result).toEqual({ sent: true, providerMessageId: 'msg_42' });
    expect(calls).toHaveLength(1);
    const { payload, options } = calls[0]!;
    expect(payload).toMatchObject({
      from: CONFIG.from,
      to: ['donor@example.org'],
      subject: MESSAGE.subject,
      text: MESSAGE.text,
      replyTo: 'contact@sailent.test',
      tags: [
        { name: 'category', value: 'donation-confirmation' },
        { name: 'ref', value: 'SFL-2026-000001' },
      ],
    });
    const html = String(payload.html);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<p>Dear Asha,</p><p>Thank you.</p>');
    expect(html).toContain('Sailent Foundation');
    expect(html).toContain('sailent.test');
    expect(options.idempotencyKey).toMatch(/^donation-confirmation-[0-9a-f]{32}$/);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('gives the same email the same key, and a different email a different one', async () => {
    const { client, calls } = fakeClient();
    const mailer = createMailer(CONFIG, client);

    await sendEmail(mailer, MESSAGE, logger);
    await sendEmail(mailer, MESSAGE, logger);
    await sendEmail(mailer, { ...MESSAGE, text: 'Dear Asha,\n\nThank you again.' }, logger);
    await sendEmail(mailer, { ...MESSAGE, to: { email: 'someone@example.org' } }, logger);

    const keys = calls.map((call) => call.options.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(new Set(keys).size).toBe(3);
  });

  it('reports not_configured without a key, and never builds a client from the environment', async () => {
    const previous = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = 're_from_the_environment_only';
    try {
      const noKey = createMailer({ from: CONFIG.from });
      const noSender = createMailer({ apiKey: CONFIG.apiKey });

      expect(noKey).toMatchObject({ configured: false, client: null });
      expect(noSender).toMatchObject({ configured: false, client: null });
      expect(await sendEmail(noKey, MESSAGE, logger)).toEqual({
        sent: false,
        reason: 'not_configured',
      });
    } finally {
      if (previous === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = previous;
    }
  });

  it('refuses an invalid recipient without calling Resend, and does not log the address', async () => {
    const { client, calls } = fakeClient();

    const result = await sendEmail(
      createMailer(CONFIG, client),
      { ...MESSAGE, to: { email: 'not-an-address' } },
      logger,
    );

    expect(result).toEqual({ sent: false, reason: 'rejected', detail: 'invalid_recipient' });
    expect(calls).toHaveLength(0);
    expect(JSON.stringify(logs)).not.toContain('not-an-address');
  });

  it('treats a refused API key as permanent, and never logs the key', async () => {
    for (const answer of [
      failure('invalid_api_key', 403, 'API key is invalid'),
      failure('missing_api_key', 401, 'Missing API key in the authorization header'),
      failure('restricted_api_key', 401, 'This API key is restricted to only send emails'),
    ]) {
      const { client } = fakeClient(answer);
      const result = await sendEmail(createMailer(CONFIG, client), MESSAGE, logger);
      expect(result).toMatchObject({ sent: false, reason: 'rejected' });
    }
    expect(JSON.stringify(logs)).not.toContain(CONFIG.apiKey);
  });

  it('treats invalid content and an unverified sender as permanent', async () => {
    for (const answer of [
      failure('validation_error', 422, 'Invalid `to` field.'),
      failure('invalid_from_address', 403, 'The domain is not verified.'),
    ]) {
      const { client } = fakeClient(answer);
      const result = await sendEmail(createMailer(CONFIG, client), MESSAGE, logger);
      expect(result).toMatchObject({ sent: false, reason: 'rejected' });
    }
  });

  it('treats outages, timeouts and quotas as retryable', async () => {
    for (const answer of [
      failure('internal_server_error', 500),
      failure(
        'application_error',
        null,
        'Unable to fetch data. The request could not be resolved.',
      ),
      failure('daily_quota_exceeded', 429, 'You have reached your daily email sending quota.'),
      failure('concurrent_idempotent_requests', 409),
    ]) {
      const { client } = fakeClient(answer);
      const result = await sendEmail(createMailer(CONFIG, client), MESSAGE, logger);
      expect(result).toMatchObject({ sent: false, reason: 'unreachable' });
    }
  });

  it('waits once and retries a rate-limited send with the same key', async () => {
    const { client, calls } = fakeClient(
      { ...(failure('rate_limit_exceeded', 429) as object), headers: { 'retry-after': '0' } },
      { data: { id: 'msg_after_wait' } },
    );

    const result = await sendEmail(createMailer(CONFIG, client), MESSAGE, logger);

    expect(result).toEqual({ sent: true, providerMessageId: 'msg_after_wait' });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.options.idempotencyKey).toBe(calls[1]!.options.idempotencyKey);
  });

  it('gives up after the one retry and leaves the rest to the queue', async () => {
    const limited = {
      ...(failure('rate_limit_exceeded', 429) as object),
      headers: { 'retry-after': '0' },
    };
    const { client, calls } = fakeClient(limited, limited);

    const result = await sendEmail(createMailer(CONFIG, client), MESSAGE, logger);

    expect(result).toMatchObject({ sent: false, reason: 'unreachable' });
    expect(calls).toHaveLength(2);
  });

  it('never throws: a client that throws is reported as unreachable', async () => {
    const { client } = fakeClient(new Error('socket hang up'));

    const result = await sendEmail(createMailer(CONFIG, client), MESSAGE, logger);

    expect(result).toMatchObject({ sent: false, reason: 'unreachable' });
    expect(result.sent === false && result.detail).toMatch(/^unexpected: socket hang up/);
  });

  it('takes addresses and keys out of the provider error it keeps', async () => {
    const { client } = fakeClient(
      failure(
        'validation_error',
        422,
        'donor@example.org cannot receive mail (key re_abcdefghijkl)',
      ),
    );

    const result = await sendEmail(createMailer(CONFIG, client), MESSAGE, logger);

    expect(result.sent === false && result.detail).toBe(
      'validation_error (422): [address] cannot receive mail (key [key])',
    );
    expect(JSON.stringify(logs)).not.toContain('donor@example.org');
  });

  it('uses a message’s own reply-to when it is a real address, and the default otherwise', async () => {
    const { client, calls } = fakeClient();
    const mailer = createMailer(CONFIG, client);

    await sendEmail(mailer, { ...MESSAGE, replyTo: 'visitor@example.org' }, logger);
    await sendEmail(mailer, { ...MESSAGE, replyTo: 'not an address' }, logger);

    expect(calls[0]!.payload.replyTo).toBe('visitor@example.org');
    expect(calls[1]!.payload.replyTo).toBe('contact@sailent.test');
  });

  it('cleans tag values to the characters Resend accepts', async () => {
    const { client, calls } = fakeClient();

    await sendEmail(
      createMailer(CONFIG, client),
      { ...MESSAGE, tags: ['contact message', 'SFL/2026 #1', ''] },
      logger,
    );

    expect(calls[0]!.payload.tags).toEqual([
      { name: 'category', value: 'contact_message' },
      { name: 'ref', value: 'SFL_2026__1' },
    ]);
  });

  it('sends attachments as base64, inline when they have a content id', async () => {
    const { client, calls } = fakeClient();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

    await sendEmail(
      createMailer(CONFIG, client),
      {
        ...MESSAGE,
        html: '<p><img src="cid:pass-1" alt="QR"></p>',
        attachments: [
          {
            filename: 'SF-EVT-AAAA0001.png',
            content: png,
            contentType: 'image/png',
            contentId: 'pass-1',
          },
        ],
      },
      logger,
    );

    expect(calls[0]!.payload.attachments).toEqual([
      {
        filename: 'SF-EVT-AAAA0001.png',
        content: png.toString('base64'),
        contentType: 'image/png',
        contentId: 'pass-1',
      },
    ]);
  });

  it('gives a different attachment a different key', async () => {
    const { client, calls } = fakeClient();
    const mailer = createMailer(CONFIG, client);
    const withFile = (bytes: number[]) => ({
      ...MESSAGE,
      attachments: [{ filename: 'pass.png', content: Buffer.from(bytes) }],
    });

    await sendEmail(mailer, withFile([1, 2, 3]), logger);
    await sendEmail(mailer, withFile([1, 2, 3]), logger);
    await sendEmail(mailer, withFile([9, 9, 9]), logger);

    const keys = calls.map((call) => call.options.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('sends a full HTML document as it is', async () => {
    const { client, calls } = fakeClient();
    const document = '<!doctype html><html><body><p>Own layout</p></body></html>';

    await sendEmail(createMailer(CONFIG, client), { ...MESSAGE, html: document }, logger);

    expect(calls[0]!.payload.html).toBe(document);
  });
});

describe('createMailer and describeMailer', () => {
  it('names the brand after the sender, and reports only the sender domain', () => {
    const { client } = fakeClient();
    const mailer = createMailer(CONFIG, client);

    expect(mailer.brandName).toBe('Sailent Foundation');
    expect(describeMailer(mailer)).toEqual({
      provider: 'resend',
      configured: true,
      senderDomain: 'sailent.test',
    });
    expect(describeMailer(createMailer({}))).toEqual({
      provider: 'resend',
      configured: false,
      senderDomain: null,
    });
  });

  it('reads both forms of sender', () => {
    expect(senderParts('Sailent Foundation <noreply@sailent.test>')).toEqual({
      name: 'Sailent Foundation',
      address: 'noreply@sailent.test',
    });
    expect(senderParts('"Sailent, Foundation" <noreply@sailent.test>')).toEqual({
      name: 'Sailent, Foundation',
      address: 'noreply@sailent.test',
    });
    expect(senderParts('noreply@sailent.test')).toEqual({
      name: null,
      address: 'noreply@sailent.test',
    });
  });
});

describe('renderEmailLayout', () => {
  it('builds a phone-friendly document and escapes what it is given', () => {
    const html = renderEmailLayout('<p>Body</p>', {
      subject: 'Your <code>',
      brandName: 'Sailent & Co',
      preheader: 'Valid for 10 minutes',
      siteUrl: 'https://sailent.test/',
    });

    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain('max-width:560px');
    expect(html).toContain('<title>Your &lt;code&gt;</title>');
    expect(html).toContain('Sailent &amp; Co');
    expect(html).toContain('Valid for 10 minutes');
    expect(html).toContain('<p>Body</p>');
    expect(isFullDocument(html)).toBe(true);
  });

  it('shows a logo from an inline attachment instead of the wordmark when given one', () => {
    const html = renderEmailLayout('<p>Body</p>', {
      subject: 'Hi',
      brandName: 'Sailent Foundation',
      logo: { contentId: 'sailent-logo', width: 160, height: 42 },
    });
    expect(html).toContain(
      '<img src="cid:sailent-logo" width="160" height="42" alt="Sailent Foundation"',
    );
    expect(renderEmailLayout('<p>Body</p>', { subject: 'Hi', brandName: 'Sailent' })).not.toContain(
      '<img',
    );
  });

  it('leaves out the preview line when there is none', () => {
    const html = renderEmailLayout('<p>Body</p>', { subject: 'Hi', brandName: 'Sailent' });
    expect(html).not.toContain('display:none');
  });
});

describe('through the Resend SDK (fetch stubbed)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(status: number, body: unknown) {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('posts the message to Resend with the key and an Idempotency-Key header', async () => {
    const fetchMock = stubFetch(200, { id: 'msg_sdk' });

    const result = await sendEmail(createMailer(CONFIG), MESSAGE, logger);

    expect(result).toEqual({ sent: true, providerMessageId: 'msg_sdk' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.resend.com/emails');
    const headers = new Headers(init!.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${CONFIG.apiKey}`);
    expect(headers.get('idempotency-key')).toMatch(/^donation-confirmation-[0-9a-f]{32}$/);
    expect(JSON.parse(String(init!.body))).toMatchObject({
      from: CONFIG.from,
      to: ['donor@example.org'],
      subject: MESSAGE.subject,
      text: MESSAGE.text,
      reply_to: 'contact@sailent.test',
      tags: [
        { name: 'category', value: 'donation-confirmation' },
        { name: 'ref', value: 'SFL-2026-000001' },
      ],
    });
  });

  it('posts attachments the way Resend reads them (content_id for inline)', async () => {
    const fetchMock = stubFetch(200, { id: 'msg_files' });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    await sendEmail(
      createMailer(CONFIG),
      { ...MESSAGE, attachments: [{ filename: 'p.png', content: png, contentId: 'pass-1' }] },
      logger,
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)) as {
      attachments: Record<string, unknown>[];
    };
    expect(body.attachments).toEqual([
      { filename: 'p.png', content: png.toString('base64'), content_id: 'pass-1' },
    ]);
  });

  it('turns Resend refusing the key into a permanent rejection', async () => {
    stubFetch(403, { statusCode: 403, name: 'invalid_api_key', message: 'API key is invalid' });

    const result = await sendEmail(createMailer(CONFIG), MESSAGE, logger);

    expect(result).toEqual({
      sent: false,
      reason: 'rejected',
      detail: 'invalid_api_key (403): API key is invalid',
    });
  });

  it('turns a network failure into unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    const result = await sendEmail(createMailer(CONFIG), MESSAGE, logger);

    expect(result).toMatchObject({ sent: false, reason: 'unreachable' });
  });
});
