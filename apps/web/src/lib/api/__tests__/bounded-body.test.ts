// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { MAX_PROXIED_BODY_BYTES, readBoundedBody } from '../bounded-body';

/** A body that arrives in chunks and says nothing about its length. */
function chunkedRequest(chunks: Uint8Array[]): { request: Request; pulled: () => number } {
  let index = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (index < chunks.length) controller.enqueue(chunks[index++]!);
        else controller.close();
      },
    },
    // No read-ahead, so `pulled` counts only what the reader asked for.
    { highWaterMark: 0 },
  );
  const request = new Request('http://localhost/api/bff/x', {
    method: 'POST',
    body: stream,
    // @ts-expect-error: Node's fetch needs this for a streamed body; the DOM types lack it.
    duplex: 'half',
  });
  return { request, pulled: () => index };
}

describe('readBoundedBody', () => {
  it('returns the whole body when it is within the limit', async () => {
    const request = new Request('http://localhost/x', { method: 'POST', body: 'hello world' });

    const body = await readBoundedBody(request, 64);

    expect(new TextDecoder().decode(body!)).toBe('hello world');
  });

  it('accepts a body of exactly the limit', async () => {
    const request = new Request('http://localhost/x', { method: 'POST', body: 'x'.repeat(64) });

    expect((await readBoundedBody(request, 64))?.byteLength).toBe(64);
  });

  it('refuses a declared length over the limit without reading the body', async () => {
    const { request, pulled } = chunkedRequest([new Uint8Array(10)]);
    request.headers.set('content-length', String(MAX_PROXIED_BODY_BYTES + 1));

    expect(await readBoundedBody(request, MAX_PROXIED_BODY_BYTES)).toBeNull();
    expect(pulled()).toBe(0);
  });

  it('stops reading a chunked body at the first chunk past the limit', async () => {
    const { request, pulled } = chunkedRequest([
      new Uint8Array(40),
      new Uint8Array(40),
      new Uint8Array(40),
      new Uint8Array(40),
    ]);

    expect(await readBoundedBody(request, 64)).toBeNull();
    // The second chunk crossed the line; the rest were never pulled.
    expect(pulled()).toBeLessThan(4);
  });

  it('is not fooled by a length that understates the body', async () => {
    const { request } = chunkedRequest([new Uint8Array(50), new Uint8Array(50)]);
    request.headers.set('content-length', '10');

    expect(await readBoundedBody(request, 64)).toBeNull();
  });

  it('treats a request with no body as empty', async () => {
    const request = new Request('http://localhost/x', { method: 'DELETE' });

    expect((await readBoundedBody(request, 64))?.byteLength).toBe(0);
  });

  it('never exceeds the body Next.js hands a route behind middleware, which it truncates', () => {
    // Above this, Next.js cuts the body off silently; refusing whole is better.
    expect(MAX_PROXIED_BODY_BYTES).toBeLessThanOrEqual(10 * 1024 * 1024);
  });
});
