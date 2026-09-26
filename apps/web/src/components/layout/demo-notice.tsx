import { Info } from 'lucide-react';

import { isDemoContent } from '@/lib/mock';

/**
 * Standing notice that this is a development build.
 *
 * Decision A14 forbids presenting unverifiable numbers as fact. Phase 2 builds
 * the complete site against fixtures, which means the pages are full of
 * realistic-looking figures. This banner is what makes that honest rather than
 * misleading, and it is tied to the same `FEATURE_MOCK_DATA` flag that the
 * config schema REFUSES to leave enabled in production — so the notice cannot
 * be forgotten and the fixtures cannot silently become the live site.
 *
 * It disappears on its own when real content arrives.
 */
export function DemoNotice() {
  if (!isDemoContent) return null;

  return (
    <div className="border-warning/25 bg-warning-subtle border-b">
      <div className="container-page flex items-start gap-2.5 py-2">
        <Info className="text-warning-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="text-caption text-warning-foreground leading-relaxed">
          <span className="font-semibold">Development preview.</span> Everything on this site is
          placeholder content used to build and review the design — campaigns, statistics, stories,
          documents, photographs, partner names, contact details, and the registration numbers
          (marked <span className="font-semibold">DEMO</span>). Nothing here describes a real
          program or a real registration.
        </p>
      </div>
    </div>
  );
}
