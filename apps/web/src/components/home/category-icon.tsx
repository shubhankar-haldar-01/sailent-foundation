import { Book, Heart, PawPrint, Shield, Sprout, Tag, Users, UtensilsCrossed } from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * The icon for a category, by its display name.
 *
 * The approved design puts the area's own mark in each campaign card's chip —
 * a book on Education, a shield on Disaster Relief — rather than one generic
 * tag on all of them.
 *
 * Keyed on the DISPLAY NAME because that is what the campaign list endpoint
 * sends; the slug is not on the summary payload. The lookup is normalised
 * (case, punctuation, and the "&"/"and" spelling) so a category renamed from
 * "Women Empowerment" to "Women's empowerment" keeps its icon.
 *
 * An unknown category falls back to the plain tag rather than to nothing: a
 * chip that sometimes has an icon and sometimes does not is worse than one
 * that always does.
 */
const BY_CATEGORY: Record<string, typeof Book> = {
  education: Book,
  healthcare: Heart,
  health: Heart,
  foodsecurity: UtensilsCrossed,
  foodsupport: UtensilsCrossed,
  disasterrelief: Shield,
  womenempowerment: Users,
  childwelfare: Users,
  livelihood: Sprout,
  environment: Sprout,
  animalwelfare: PawPrint,
  clothing: Tag,
  communitydevelopment: Users,
};

function normalise(category: string): string {
  return category
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z]/g, '')
    .replace(/and/g, '');
}

/**
 * The COLOUR each category is drawn in.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * The approved cards give every category its own hue — Education blue,
 * Disaster Relief violet, Women Empowerment pink — rather than one accent on
 * all of them. It is what lets someone scanning a row of cards tell the
 * programmes apart before reading a word.
 *
 * COLOUR NEVER CARRIES THE MEANING ALONE. Each chip shows its icon and its
 * name as well, so the hue is a third signal, not the signal. That is the rule
 * in docs/design-system.md §3, and it is what makes this safe for anyone who
 * cannot separate violet from pink.
 *
 * `ink` is text on white and clears 4.5:1. `bar` is the progress fill, a
 * non-text graphic, and clears 3:1 against its own track. Two different floors,
 * which is why they are two different tokens rather than one colour reused.
 * ══════════════════════════════════════════════════════════════════════════
 */
interface CategoryTone {
  /** Chip text and icon. Measured on white. */
  ink: string;
  /**
   * The ink as a SOLID fill — the listing's progress bars, drawn in the same
   * colour as the category label above them. A non-text graphic, so its floor
   * is 3:1 against the track; every ink clears that with room to spare.
   */
  fill: string;
  /** Progress fill. A gradient, as the approved bars are. */
  bar: string;
  /**
   * A FILLED pill — soft wash behind the category's own ink.
   *
   * The card chips sit on white and need only the ink. The campaign hero sets
   * the same label as a solid badge, and a bare ink colour there would read as
   * text somebody forgot to style.
   *
   * Same ink as `ink`, so a category is one colour wherever it appears. A
   * listing card and the page it links to must not disagree about what colour
   * Disaster Relief is.
   */
  chip: string;
  /**
   * The same wash at full strength, for a SELECTED state.
   *
   * The listing's cause tiles sit on `chip` and step up to this when chosen,
   * so a selected tile is the same hue, just firmer — not a new colour.
   */
  wash: string;
}

const TONES: Record<string, CategoryTone> = {
  education: {
    ink: 'text-wash-blue-ink',
    fill: 'bg-wash-blue-ink',
    bar: 'from-wash-blue-ink to-wash-blue-ink',
    chip: 'bg-wash-blue/60 text-wash-blue-ink',
    wash: 'bg-wash-blue',
  },
  healthcare: {
    ink: 'text-wash-rose-ink',
    fill: 'bg-wash-rose-ink',
    bar: 'from-wash-blue-ink to-wash-rose-ink',
    chip: 'bg-wash-rose/60 text-wash-rose-ink',
    wash: 'bg-wash-rose',
  },
  health: {
    ink: 'text-wash-rose-ink',
    fill: 'bg-wash-rose-ink',
    bar: 'from-wash-blue-ink to-wash-rose-ink',
    chip: 'bg-wash-rose/60 text-wash-rose-ink',
    wash: 'bg-wash-rose',
  },
  foodsecurity: {
    ink: 'text-wash-gold-ink',
    fill: 'bg-wash-gold-ink',
    bar: 'from-wash-blue-ink to-wash-gold-ink',
    chip: 'bg-wash-amber/60 text-wash-gold-ink',
    wash: 'bg-wash-amber',
  },
  foodsupport: {
    ink: 'text-wash-gold-ink',
    fill: 'bg-wash-gold-ink',
    bar: 'from-wash-blue-ink to-wash-gold-ink',
    chip: 'bg-wash-amber/60 text-wash-gold-ink',
    wash: 'bg-wash-amber',
  },
  disasterrelief: {
    ink: 'text-wash-violet-ink',
    fill: 'bg-wash-violet-ink',
    bar: 'from-wash-blue-ink to-wash-violet-ink',
    chip: 'bg-wash-violet/60 text-wash-violet-ink',
    wash: 'bg-wash-violet',
  },
  womenempowerment: {
    ink: 'text-wash-pink-ink',
    fill: 'bg-wash-pink-ink',
    bar: 'from-wash-blue-ink to-wash-pink-ink',
    chip: 'bg-wash-pink/60 text-wash-pink-ink',
    wash: 'bg-wash-pink',
  },
  childwelfare: {
    ink: 'text-wash-violet-ink',
    fill: 'bg-wash-violet-ink',
    bar: 'from-wash-blue-ink to-wash-violet-ink',
    chip: 'bg-wash-violet/60 text-wash-violet-ink',
    wash: 'bg-wash-violet',
  },
  livelihood: {
    ink: 'text-wash-mint-ink',
    fill: 'bg-wash-mint-ink',
    bar: 'from-wash-blue-ink to-wash-mint-ink',
    chip: 'bg-wash-mint/60 text-wash-mint-ink',
    wash: 'bg-wash-mint',
  },
  environment: {
    ink: 'text-wash-mint-ink',
    fill: 'bg-wash-mint-ink',
    bar: 'from-wash-blue-ink to-wash-mint-ink',
    chip: 'bg-wash-mint/60 text-wash-mint-ink',
    wash: 'bg-wash-mint',
  },
  animalwelfare: {
    ink: 'text-wash-amber-ink',
    fill: 'bg-wash-amber-ink',
    bar: 'from-wash-blue-ink to-wash-amber-ink',
    chip: 'bg-wash-amber/60 text-wash-amber-ink',
    wash: 'bg-wash-amber',
  },
  clothing: {
    ink: 'text-wash-gold-ink',
    fill: 'bg-wash-gold-ink',
    bar: 'from-wash-blue-ink to-wash-gold-ink',
    chip: 'bg-wash-amber/60 text-wash-gold-ink',
    wash: 'bg-wash-amber',
  },
  communitydevelopment: {
    ink: 'text-wash-blue-ink',
    fill: 'bg-wash-blue-ink',
    bar: 'from-wash-blue-ink to-wash-blue-ink',
    chip: 'bg-wash-blue/60 text-wash-blue-ink',
    wash: 'bg-wash-blue',
  },
};

/** Blue on both stops, so an unmapped category is plain rather than odd. */
const NEUTRAL_TONE: CategoryTone = {
  ink: 'text-wash-blue-ink',
  fill: 'bg-wash-blue-ink',
  bar: 'from-wash-blue-ink to-wash-blue-ink',
  chip: 'bg-wash-blue/60 text-wash-blue-ink',
  wash: 'bg-wash-blue',
};

export function categoryTone(category: string | null | undefined): CategoryTone {
  if (!category) return NEUTRAL_TONE;
  return TONES[normalise(category)] ?? NEUTRAL_TONE;
}

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = BY_CATEGORY[normalise(category)] ?? Tag;
  return <Icon className={cn('size-3.5', className)} aria-hidden="true" />;
}

/**
 * What to call the people a campaign serves.
 *
 * The approved cards read "500 children", "1,000 families", "200 women" — the
 * noun changes with the work. There is no per-campaign field for it yet, so
 * this is a DEFAULT DERIVED FROM THE CATEGORY, and an unmapped category falls
 * back to the neutral "beneficiaries".
 *
 * It is a presentational default, not a claim: a literacy campaign for adults
 * filed under Education would read "children" and be wrong. The durable fix is
 * a `beneficiary_noun` column on `campaigns` that an editor sets per campaign;
 * when that lands, this map is deleted rather than extended.
 */
const NOUN_BY_CATEGORY: Record<string, string> = {
  education: 'children',
  childwelfare: 'children',
  healthcare: 'patients',
  health: 'patients',
  foodsecurity: 'families',
  foodsupport: 'families',
  disasterrelief: 'families',
  womenempowerment: 'women',
  livelihood: 'households',
  animalwelfare: 'animals',
};

export function beneficiaryNoun(category: string | null | undefined): string {
  if (!category) return 'beneficiaries';
  return NOUN_BY_CATEGORY[normalise(category)] ?? 'beneficiaries';
}
