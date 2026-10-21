/**
 * A donor's profile photo, and the limits that keep the value small and safe.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE WRITER. Only `POST /me/avatar` sets `donors.avatar_url`, and it builds
 * the value itself from an image it has inspected and stripped: the object
 * store's public URL, or — on a machine with no object store, never in
 * production — the image inline as a `data:` URL. `PATCH /me` does not accept
 * the field at all (its schema is `.strict()`).
 *
 * EVERY READ IS CHECKED AS WELL, because the column is plain `text` and a row
 * written before these limits, or by hand, could hold anything. A value that
 * is not an http(s) URL of sensible length, or an inline JPEG, PNG or WebP
 * within the inline cap, is served as `null`, and the donor sees initials.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** The longest URL served as a photo: room for any object-store key, nowhere near a payload. */
export const MAX_AVATAR_URL_LENGTH = 2048;

/**
 * The largest photo kept inline, after its metadata is stripped.
 *
 * The inline copy rides in every `GET /me` — the dashboard asks on each page —
 * so it is kept small. Production never stores one: it refuses the upload
 * when there is no object store.
 */
export const MAX_INLINE_AVATAR_BYTES = 256 * 1024;

const INLINE_PREFIX = /^data:image\/(?:jpeg|png|webp);base64,/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function inlineAvatarUrl(mimeType: string, bytes: Buffer): string {
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

/** What to serve for a stored `avatar_url`: the value when it is acceptable, otherwise `null`. */
export function servableAvatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  const inline = INLINE_PREFIX.exec(value);
  if (inline) {
    const payload = value.slice(inline[0].length);
    // Four base64 characters for every three bytes.
    if (payload.length > Math.ceil(MAX_INLINE_AVATAR_BYTES / 3) * 4) return null;
    return BASE64.test(payload) ? value : null;
  }

  if (value.length > MAX_AVATAR_URL_LENGTH) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

/**
 * For the session token, which travels in a cookie: a URL only, never an
 * inline image, and nothing `servableAvatarUrl` would refuse.
 */
export function sessionAvatarUrl(value: string | null | undefined): string | null {
  const url = servableAvatarUrl(value);
  return url && !url.startsWith('data:') ? url : null;
}
