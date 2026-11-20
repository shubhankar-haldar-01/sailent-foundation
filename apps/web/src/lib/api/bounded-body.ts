/**
 * A request body read whole, but never past a ceiling.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THE PROXY NEEDS ONE.
 *
 * `request.arrayBuffer()` holds the entire body in memory, however large, and
 * the BFF proxy reads it before the API has seen anything: before any session
 * is checked. The origin check stops another site's page, not a script, which
 * can send whatever Origin it likes. Without a ceiling, anyone could make this
 * server hold as much as they cared to send, many requests at a time.
 *
 * A declared `Content-Length` over the ceiling is refused without reading a
 * byte. A body that does not declare its length (chunked) is counted as it
 * arrives and abandoned at the first byte past the ceiling, so a false or
 * missing length gains nothing.
 *
 * Next.js already caps the body it hands a route when `proxy.ts` (Next.js's
 * middleware) runs on that path (`proxyClientMaxBodySize`, 10 MB), but it
 * TRUNCATES silently:
 * the API then receives a cut-off upload and refuses it with a confusing
 * error. And `proxy.ts` does not run on a path that ends in a file
 * extension (see its matcher), which the catch-all proxy route still accepts,
 * so `/api/bff/anything.png` had no cap at all.
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * Equal to Next.js's own body limit behind `proxy.ts`, so a body over it is refused
 * whole with a 413 instead of being cut off. The largest legitimate body
 * through the proxy is an admin image upload, which the API caps at 10 MB.
 */
export const MAX_PROXIED_BODY_BYTES = 10 * 1024 * 1024;

/** The body's bytes, or `null` when it is larger than `limit`. */
export async function readBoundedBody(
  request: Pick<Request, 'body' | 'headers'>,
  limit: number,
): Promise<ArrayBuffer | null> {
  const declared = request.headers.get('content-length');
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > limit) return null;

  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}
