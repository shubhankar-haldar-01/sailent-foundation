import Link from 'next/link';

import { cn } from '@sailent/ui';

import { GraduationCap, Heart, Home, PawPrint, Users, UtensilsCrossed } from 'lucide-react';

/**
 * Key focus areas, as a closing strip.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A LINK TO A REAL FILTERED LISTING, NOT A DECORATIVE TILE.
 *
 * Each card goes to `/campaigns?categorySlug=…`, which is the same destination
 * the homepage focus strip and the footer's Programs column use. A row of four
 * pretty tiles that do nothing is the most common filler on an NGO site, and
 * somebody who has just read one campaign and wants another is exactly who this
 * is for.
 *
 * The marks follow the approved design — a graduation cap, a heart, cutlery, a
 * house — rather than the homepage's solid set, because this strip is a compact
 * row of discs and the outline icons read better at 24px than filled ones do.
 * Each sits on its own tinted disc, and the label underneath carries the
 * meaning, so the colour is a second signal rather than the signal.
 * ══════════════════════════════════════════════════════════════════════════
 */
const AREAS = [
  {
    label: 'Education',
    tagline: 'Brighter Futures',
    slug: 'education',
    icon: GraduationCap,
    tone: 'bg-wash-blue text-wash-blue-ink',
  },
  {
    label: 'Healthcare',
    tagline: 'Healthier Communities',
    slug: 'healthcare',
    icon: Heart,
    tone: 'bg-wash-rose text-wash-rose-ink',
  },
  {
    label: 'Food Security',
    tagline: 'Hunger-Free Tomorrow',
    slug: 'food-support',
    icon: UtensilsCrossed,
    tone: 'bg-wash-amber text-wash-gold-ink',
  },
  {
    label: 'Disaster Relief',
    tagline: 'Support When It Matters',
    slug: 'disaster-relief',
    icon: Home,
    tone: 'bg-wash-violet text-wash-violet-ink',
  },
  {
    label: 'Women Empowerment',
    tagline: 'Equal Opportunity',
    slug: 'women-empowerment',
    icon: Users,
    tone: 'bg-wash-pink text-wash-pink-ink',
  },
  {
    label: 'Animal Welfare',
    tagline: 'Compassion For All',
    slug: 'animal-welfare',
    icon: PawPrint,
    tone: 'bg-wash-mint text-wash-mint-ink',
  },
] as const;

export function FocusAreasStrip({ limit = 4 }: { limit?: number }) {
  return (
    <section aria-labelledby="focus-heading" className="mt-14">
      <h2 id="focus-heading" className="text-h1 font-bold">
        Key Focus Areas
      </h2>

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AREAS.slice(0, limit).map((area) => (
          <li key={area.slug}>
            <Link
              href={`/campaigns?categorySlug=${area.slug}`}
              className="border-border bg-surface focus-visible:outline-ring flex h-full flex-col items-center rounded-lg border px-4 py-6 text-center transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span
                aria-hidden="true"
                className={cn('grid size-12 place-items-center rounded-full', area.tone)}
              >
                <area.icon className="size-6" strokeWidth={2.2} />
              </span>
              <span className="text-body-sm mt-3 font-semibold">{area.label}</span>
              <span className="text-caption text-muted-foreground mt-0.5">{area.tagline}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
