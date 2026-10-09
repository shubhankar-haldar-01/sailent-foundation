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
};

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

/**
 * The phone menu's set, as its design draws them: Facebook, LinkedIn and
 * YouTube as solid marks, X and Instagram as outlines.
 */
export const SOCIAL_ICONS_SOLID: Record<string, IconComponent> = {
  Facebook: solidMark(
    'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20Zm1.45 19.95V14.1h2.2l.35-2.7h-2.55V9.75c0-.78.22-1.3 1.33-1.3h1.32V6.05c-.25-.03-1.08-.1-2.05-.1-2.02 0-3.25 1.23-3.25 3.48v1.97H8.6v2.7h2.2v7.85Z',
  ),
  X: XLogo,
  Twitter: XLogo,
  Instagram,
  LinkedIn: solidMark(
    'M4.5 2h15A2.5 2.5 0 0 1 22 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 19.5v-15A2.5 2.5 0 0 1 4.5 2Zm2.6 3.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM5.7 9.7v8.9h2.8V9.7Zm4.6 0v8.9h2.8V14c0-1.25.45-2.1 1.55-2.1s1.45.85 1.45 2.1v4.6h2.8v-5.2c0-2.55-1.3-3.9-3.3-3.9-1.25 0-2.05.55-2.5 1.25V9.7Z',
  ),
  YouTube: solidMark(
    'M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42a2.5 2.5 0 0 0-1.76 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81ZM10 15.1V8.9l5.3 3.1Z',
  ),
};
