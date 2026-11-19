/**
 * Multer limits for a form that carries one file and a few short fields.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE FILE WAS CAPPED; THE FORM AROUND IT WAS NOT.
 *
 * Multer's defaults allow any number of text fields of up to 1 MB each, and
 * every one is held in memory before the handler (and its validation) runs.
 * A form with a 5 MB file limit would still take a request carrying hundreds
 * of megabytes of fields. The avatar upload is open to every donor, and a
 * donor account costs only an email address.
 *
 * Each upload form here has a handful of short fields. The longest value is a
 * document's description, at most 2,000 characters (8 KB in UTF-8), so 16 KB
 * per field refuses nothing legitimate. Over a limit, multer stops parsing
 * and Nest answers 400 (413 for the file itself).
 * ══════════════════════════════════════════════════════════════════════════
 */

export const MAX_UPLOAD_FIELD_BYTES = 16 * 1024;

export function singleFileUploadLimits(fileSize: number, fields: number) {
  return {
    fileSize,
    files: 1,
    fields,
    // Every part is a field or the file; nothing else may arrive.
    parts: fields + 1,
    fieldSize: MAX_UPLOAD_FIELD_BYTES,
    fieldNameSize: 100,
  };
}
