'use client';

import { Printer } from 'lucide-react';

import { Button } from '@sailent/ui';

/**
 * Print, or save as PDF through the browser's own print dialogue.
 *
 * There is no server-side PDF generator yet. A browser prints a page designed
 * to print perfectly well, and this is one — so this is the export, rather than
 * a "Download PDF" button that would have to lie about what it does.
 *
 * Hidden from print itself, or it appears in the printout.
 */
export function PrintButton() {
  return (
    <Button size="md" variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" aria-hidden="true" />
      Print or save as PDF
    </Button>
  );
}
