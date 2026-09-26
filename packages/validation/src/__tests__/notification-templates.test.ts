import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_TEMPLATES,
  NOTIFICATION_TEMPLATE_SLUGS,
  escapeHtml,
  expectedVariables,
  isKnownTemplateSlug,
  notificationLogQuerySchema,
  placeholdersIn,
  renderNotification,
  renderTemplate,
  unsafeRawPlaceholders,
  updateNotificationTemplateSchema,
} from '../index.js';

/**
 * The template renderer.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TESTS THAT MATTER ARE THE ESCAPING ONES.
 *
 * Every variable substituted here is data somebody else supplied — a donor's
 * name, a campaign title. A body that interpolates one unescaped is an
 * injection into an email this organisation signs and sends, and the reader
 * has every reason to trust it.
 *
 * So: escaped by default, raw only where a slug permits it, and a test that
 * the permission is actually enforced rather than merely documented.
 * ══════════════════════════════════════════════════════════════════════════
 */
describe('escaping', () => {
  it('escapes the five characters that change meaning in HTML', () => {
    expect(escapeHtml(`<&">'`)).toBe('&lt;&amp;&quot;&gt;&#39;');
  });

  it('does not double-escape the ampersands it just introduced', () => {
    // `&` is replaced first, so `<` becoming `&lt;` must not then become
    // `&amp;lt;`. Getting this order wrong is the classic escaping bug.
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('ESCAPES a double-brace variable in the HTML body', () => {
    const { output } = renderTemplate(
      '<p>Dear {{name}}</p>',
      { name: '<script>alert(1)</script>' },
      {
        escape: true,
      },
    );
    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;script&gt;');
  });

  it('does NOT escape the plain-text body, which is not markup', () => {
    const { output } = renderTemplate('Dear {{name}}', { name: 'Ampersand & Co' });
    expect(output).toBe('Dear Ampersand & Co');
  });

  it('does not escape the subject, so nobody receives &amp; in their inbox', () => {
    const rendered = renderNotification(
      {
        subject: 'Thanks for {{campaign}}',
        bodyHtml: '<p>{{campaign}}</p>',
        bodyText: '{{campaign}}',
      },
      { campaign: 'Books & Kits' },
    );
    expect(rendered.subject).toBe('Thanks for Books & Kits');
    expect(rendered.html).toContain('Books &amp; Kits');
    expect(rendered.text).toBe('Books & Kits');
  });
});

describe('raw placeholders', () => {
  it('inserts a triple-brace value without escaping', () => {
    const { output } = renderTemplate(
      '<table>{{{rows}}}</table>',
      { rows: '<tr><td>x</td></tr>' },
      {
        escape: true,
      },
    );
    expect(output).toBe('<table><tr><td>x</td></tr></table>');
  });

  it('leaves no stray braces — triple is matched before double', () => {
    /*
      `{{{name}}}` contains `{{name}}`. Running the double-brace pattern first
      consumes the inner braces and leaves `{value}` behind, which is the bug
      this asserts against.
    */
    const { output } = renderTemplate('{{{value}}}', { value: 'X' });
    expect(output).toBe('X');
    expect(output).not.toContain('{');
    expect(output).not.toContain('}');
  });

  it('PERMITS the one raw variable the donation receipt needs', () => {
    expect(
      unsafeRawPlaceholders('donation.confirmation', '<table>{{{itemsHtml}}}</table>'),
    ).toEqual([]);
  });

  it('REFUSES a raw placeholder the slug does not permit', () => {
    // A one-character edit that would put an unescaped donor name into an
    // outgoing email, and would read as a formatting tweak in a diff.
    expect(unsafeRawPlaceholders('donation.confirmation', '<p>{{{donorName}}}</p>')).toEqual([
      'donorName',
    ]);
  });

  it('refuses ANY raw placeholder on a slug with no raw allowance', () => {
    expect(unsafeRawPlaceholders('volunteer.approved', '<p>{{{volunteerName}}}</p>')).toEqual([
      'volunteerName',
    ]);
  });

  it('is unaffected by ordinary escaped placeholders', () => {
    expect(unsafeRawPlaceholders('volunteer.approved', '<p>{{volunteerName}}</p>')).toEqual([]);
  });
});

describe('missing values', () => {
  it('renders EMPTY rather than leaving the placeholder visible', () => {
    // `Dear {{donorName}},` arriving in a donor's inbox is worse than `Dear ,`.
    const { output, missing } = renderTemplate('Dear {{donorName}},', {});
    expect(output).toBe('Dear ,');
    expect(missing).toEqual(['donorName']);
  });

  it('treats an empty string as missing, and reports each name once', () => {
    const { missing } = renderTemplate('{{a}} {{a}} {{b}}', { a: '', b: null });
    expect(missing).toEqual(['a', 'b']);
  });

  it('collects what is missing across subject, html and text', () => {
    const rendered = renderNotification(
      { subject: '{{one}}', bodyHtml: '<p>{{two}}</p>', bodyText: '{{three}}' },
      { two: 'present' },
    );
    expect(rendered.missing.sort()).toEqual(['one', 'three']);
  });

  it('accepts a number, which is what an hours count is', () => {
    expect(renderTemplate('{{hours}} hours', { hours: 12 }).output).toBe('12 hours');
  });
});

describe('the registry', () => {
  it('covers every transactional email the workers send', () => {
    for (const slug of [
      'donation.confirmation',
      'donor.login_code',
      'event.registration.confirmed',
      'event.cancelled',
      'volunteer.application.received',
      'volunteer.approved',
      'volunteer.rejected',
      'volunteer.assigned',
      'volunteer.certificate.issued',
    ]) {
      expect(isKnownTemplateSlug(slug)).toBe(true);
    }
  });

  it('exposes a slug list matching the registry', () => {
    expect(NOTIFICATION_TEMPLATE_SLUGS.length).toBe(Object.keys(NOTIFICATION_TEMPLATES).length);
  });

  it('describes every variable it declares, so an editor is not guessing', () => {
    for (const slug of NOTIFICATION_TEMPLATE_SLUGS) {
      const variables = expectedVariables(slug);
      expect(Object.keys(variables).length).toBeGreaterThan(0);
      for (const description of Object.values(variables)) {
        expect(description.length).toBeGreaterThan(3);
      }
    }
  });

  it('returns nothing for a slug it does not know', () => {
    expect(isKnownTemplateSlug('made.up')).toBe(false);
    expect(expectedVariables('made.up')).toEqual({});
  });

  it('NEVER declares the sign-in code email a raw-capable template', () => {
    // The one email whose variable is a secret. Nothing about it may be
    // inserted unescaped, and nothing about it may be logged.
    expect(unsafeRawPlaceholders('donor.login_code', '{{{code}}}')).toEqual(['code']);
  });
});

describe('placeholdersIn', () => {
  it('finds both escaped and raw placeholders', () => {
    expect(placeholdersIn('<p>{{a}}</p><table>{{{b}}}</table>').sort()).toEqual(['a', 'b']);
  });

  it('reports each name once', () => {
    expect(placeholdersIn('{{a}} {{a}}')).toEqual(['a']);
  });

  it('tolerates spaces inside the braces', () => {
    expect(placeholdersIn('{{  spaced  }}')).toEqual(['spaced']);
  });
});

describe('schemas', () => {
  it('will not accept an empty template patch', () => {
    expect(updateNotificationTemplateSchema.safeParse({}).success).toBe(false);
  });

  it('CANNOT change the slug — a processor looks up by it', () => {
    const parsed = updateNotificationTemplateSchema.parse({
      subject: 'A new subject',
      slug: 'something.else',
    });
    // Stripped, not rejected: renaming would silently stop an email going out
    // while everything still looked configured.
    expect('slug' in parsed).toBe(false);
  });

  it('refuses a body too short to be an email', () => {
    expect(updateNotificationTemplateSchema.safeParse({ bodyHtml: '<p>hi</p>' }).success).toBe(
      false,
    );
  });

  it('defaults the send log to the first page', () => {
    const parsed = notificationLogQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(25);
  });

  it('caps the send log page size', () => {
    expect(notificationLogQuerySchema.safeParse({ pageSize: 10_000 }).success).toBe(false);
  });

  it('only accepts statuses the enum actually has', () => {
    expect(notificationLogQuerySchema.safeParse({ status: 'sent' }).success).toBe(true);
    expect(notificationLogQuerySchema.safeParse({ status: 'delivered' }).success).toBe(false);
  });
});
