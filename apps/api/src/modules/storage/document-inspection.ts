import { inspectImage, UnsupportedImageError } from './image-inspection.js';

/**
 * What is actually in this document?
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SAME RULE AS IMAGES: THE DECLARED TYPE DECIDES NOTHING.
 *
 * `docs/security-architecture.md` §6 — "Magic-byte validation, not extension
 * trust. A `.jpg` whose bytes are a PHP script is rejected." A document
 * library is where that matters most: these files are uploaded by staff,
 * stored for years, and handed back to a browser through a signed URL that
 * says nothing about what it is about to open.
 *
 * PDF AND THE THREE IMAGE FORMATS, AND NOTHING ELSE.
 *
 * §6 also lists Word and Excel among "specific document formats". They are not
 * accepted here, and the reason is not effort: an OOXML file is a zip whose
 * members can carry macros, and proving one safe means reading inside the
 * archive — a real parser, a real dependency, and a real attack surface, to
 * support a format nobody should be publishing a statutory report in anyway.
 * A PDF is what an annual report, an audited statement and a policy actually
 * are. Scans arrive as images, so those are accepted too.
 *
 * Refusing a format outright is a decision somebody can read. Accepting one
 * and hoping is not. This is the same reasoning that keeps SVG out of the
 * media library.
 * ══════════════════════════════════════════════════════════════════════════
 */

export type SupportedDocumentType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

export interface InspectedDocument {
  mimeType: SupportedDocumentType;
}

export class UnsupportedDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedDocumentError';
  }
}

/**
 * PDF: the five-byte header `%PDF-`.
 *
 * Anchored at offset zero. The specification permits leading bytes before the
 * header and most readers tolerate them, but a file that needs that tolerance
 * is a file pretending to be two things at once — which is exactly the
 * polyglot this check exists to refuse.
 */
const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');

function isPdf(bytes: Buffer): boolean {
  return bytes.length >= PDF_SIGNATURE.length && bytes.subarray(0, 5).equals(PDF_SIGNATURE);
}

/**
 * Determine the real type, or refuse.
 *
 * @param declaredMimeType What the client CLAIMED. Used only to make the
 *   error clearer when it disagrees with the bytes — never to decide anything.
 */
export function inspectDocument(bytes: Buffer, declaredMimeType?: string): InspectedDocument {
  if (bytes.length === 0) {
    throw new UnsupportedDocumentError('That file is empty.');
  }

  if (isPdf(bytes)) return { mimeType: 'application/pdf' };

  /*
    Fall through to the image inspector rather than re-implementing three
    signature checks. A scanned certificate is a photograph, and the rules for
    photographs are already written and already tested.
  */
  try {
    return { mimeType: inspectImage(bytes, declaredMimeType).mimeType };
  } catch (error) {
    if (error instanceof UnsupportedImageError) {
      /*
        Name the office formats explicitly. "Unsupported file" sends somebody
        hunting for a setting; being told to export a PDF is something they can
        act on in the next thirty seconds.
      */
      const head = bytes.subarray(0, 8);
      const looksZipped = head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b;
      const looksLikeOldOffice =
        head.length >= 8 &&
        head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));

      if (looksZipped || looksLikeOldOffice) {
        throw new UnsupportedDocumentError(
          'Word, Excel and other office files are not accepted, because proving one safe ' +
            'means reading inside the archive. Export it as PDF and upload that.',
        );
      }

      throw new UnsupportedDocumentError(
        `${error.message} Documents must be a PDF, or a JPEG, PNG or WebP scan.`,
      );
    }
    throw error;
  }
}
