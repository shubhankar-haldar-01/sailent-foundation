import { Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';

type IconComponent = (props: {
  className?: string;
  'aria-hidden'?: boolean | 'true';
}) => React.ReactNode;

/** The X (formerly Twitter) mark, drawn rather than imported: the icon set has only the old bird. */
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.34l4.37 5.78L17.75 3Zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45Z" />
    </svg>
  );
}

export function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.92-9.91-9.92Zm0 18.15c-1.48 0-2.93-.39-4.19-1.14l-.3-.18-3.12.82.83-3.04-.2-.32c-.82-1.3-1.26-2.82-1.26-4.38 0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.17c-.25-.13-1.47-.73-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.8-.78.96-.14.16-.29.18-.54.06s-.98-.36-1.93-1.21c-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.24.25-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.32-.75-1.81-.2-.48-.4-.42-.55-.43h-.47c-.16 0-.43.06-.65.3-.23.25-.86.84-.86 2.05s.88 2.37 1 2.53c.13.16 1.73 2.63 4.18 3.69.58.25 1.04.4 1.39.51.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.19.21-.59.21-1.09.15-1.19-.06-.1-.18-.14-.43-.27Z" />
    </svg>
  );
}

/** A solid mark drawn on a 24-unit grid; the letterforms are cut out (even-odd). */
function solidMark(d: string) {
  return function SolidMark({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
        <path fillRule="evenodd" clipRule="evenodd" d={d} />
      </svg>
    );
  };
}

export const FacebookSolid = solidMark(
  'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20Zm1.45 19.95V14.1h2.2l.35-2.7h-2.55V9.75c0-.78.22-1.3 1.33-1.3h1.32V6.05c-.25-.03-1.08-.1-2.05-.1-2.02 0-3.25 1.23-3.25 3.48v1.97H8.6v2.7h2.2v7.85Z',
);

export const LinkedInSolid = solidMark(
  'M4.5 2h15A2.5 2.5 0 0 1 22 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 19.5v-15A2.5 2.5 0 0 1 4.5 2Zm2.6 3.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM5.7 9.7v8.9h2.8V9.7Zm4.6 0v8.9h2.8V14c0-1.25.45-2.1 1.55-2.1s1.45.85 1.45 2.1v4.6h2.8v-5.2c0-2.55-1.3-3.9-3.3-3.9-1.25 0-2.05.55-2.5 1.25V9.7Z',
);

export const YouTubeSolid = solidMark(
  'M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42a2.5 2.5 0 0 0-1.76 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81ZM10 15.1V8.9l5.3 3.1Z',
);

/*
  BARE GLYPHS: the letterforms of the solid marks above with no circle or
  square around them, for a page that already draws the circle itself. The
  paths are the same cut-outs, filled, with the view box trimmed to the glyph.
*/
export function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="4.1 5.45 17 17" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M13.45 21.95V14.1h2.2l.35-2.7h-2.55V9.75c0-.78.22-1.3 1.33-1.3h1.32V6.05c-.25-.03-1.08-.1-2.05-.1-2.02 0-3.25 1.23-3.25 3.48v1.97H8.6v2.7h2.2v7.85Z" />
    </svg>
  );
}

export function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="4.7 4.5 15 15" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M7.1 5.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM5.7 9.7v8.9h2.8V9.7Zm4.6 0v8.9h2.8V14c0-1.25.45-2.1 1.55-2.1s1.45.85 1.45 2.1v4.6h2.8v-5.2c0-2.55-1.3-3.9-3.3-3.9-1.25 0-2.05.55-2.5 1.25V9.7Z" />
    </svg>
  );
}

/**
 * Social icons by network label, for the header's mobile menu and the footer.
 *
 * A lookup rather than a field in the settings, because the icon is a property
 * of the network and the URL is a property of the organisation — the links
 * themselves come from Admin → Settings. A network not listed here falls back
 * to its initial at the call site.
 */
export const SOCIAL_ICONS: Record<string, IconComponent> = {
  Facebook,
  X: XLogo,
  Twitter: XLogo,
  Instagram,
  LinkedIn: Linkedin,
  YouTube: Youtube,
  WhatsApp: WhatsAppLogo,
};

/**
 * The phone menu's set, as its design draws them: Facebook, LinkedIn and
 * YouTube as solid marks, X and Instagram as outlines.
 */
export const SOCIAL_ICONS_SOLID: Record<string, IconComponent> = {
  Facebook: FacebookSolid,
  X: XLogo,
  Twitter: XLogo,
  Instagram,
  LinkedIn: LinkedInSolid,
  YouTube: YouTubeSolid,
  WhatsApp: WhatsAppLogo,
};

/**
 * The phone footer's set, as the owner's design draws them inside round white
 * buttons (2026-10-16): a bare "f" and "in", a solid YouTube, X and WhatsApp
 * as before, Instagram as an outline.
 */
export const SOCIAL_ICONS_GLYPH: Record<string, IconComponent> = {
  Facebook: FacebookGlyph,
  X: XLogo,
  Twitter: XLogo,
  Instagram,
  LinkedIn: LinkedInGlyph,
  YouTube: YouTubeSolid,
  WhatsApp: WhatsAppLogo,
};
