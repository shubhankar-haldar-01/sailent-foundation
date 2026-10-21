import { BookOpen, Briefcase, HeartPulse, Leaf, PawPrint, Shield, Sprout } from 'lucide-react';

import { cn } from '@sailent/ui';

import { categoryKey } from '@/lib/categories';
import type { Program } from '@/lib/mock/types';

/**
 * The program's illustrative icon, on a soft disc in its area's colour.
 *
 * Purely decorative: every card states its program in text directly beside
 * it, so the icon adds recognition on a second visit and carries nothing on
 * the first. Hence `aria-hidden` — announcing "book" before "Education" is
 * noise, not information.
 *
 * The mapping is exhaustive over `accentIcon`, so a new value added to the
 * database without a matching icon fails to compile rather than rendering
 * nothing.
 */
export type AccentIcon = Program['accentIcon'];

const ICONS: Record<AccentIcon, typeof BookOpen> = {
  book: BookOpen,
  heart: HeartPulse,
  shield: Shield,
  sprout: Sprout,
  briefcase: Briefcase,
  leaf: Leaf,
  paw: PawPrint,
};

/** The icon component for a programme's `accentIcon`, for the toolbar's chips and menus. */
export function accentIcon(accent: AccentIcon): typeof BookOpen {
  return ICONS[accent] ?? Sprout;
}

export interface ProgramTone {
  /** The soft disc behind the icon. */
  disc: string;
  /** The icon's own colour — also the chip icon, with no disc. */
  ink: string;
}

/**
 * The colours, by AREA — as the owner's programs design (2026-10-14) draws
 * them: Education in the brand's soft orange, Healthcare blue, Child Welfare
 * pink, Women Empowerment purple, Disaster Relief and Environment green,
 * Animal Welfare amber. An area the design does not show falls back to the
 * soft orange.
 *
 * These are the programme cards' own colours. The campaign cards keep their
 * approved category colours (`components/home/category-icon.tsx`).
 */
const ORANGE: ProgramTone = { disc: 'bg-cta/12', ink: 'text-cta-glow' };
const TONES: Record<string, ProgramTone> = {
  education: ORANGE,
  healthcare: { disc: 'bg-wash-blue', ink: 'text-wash-blue-ink' },
  childwelfare: { disc: 'bg-wash-pink', ink: 'text-wash-pink-ink' },
  womenempowerment: { disc: 'bg-wash-violet', ink: 'text-wash-violet-ink' },
  disasterrelief: { disc: 'bg-wash-mint', ink: 'text-wash-mint-ink' },
  animalwelfare: { disc: 'bg-wash-amber', ink: 'text-wash-gold-ink' },
  environment: { disc: 'bg-wash-mint', ink: 'text-wash-mint-ink' },
};

export function programTone(area: string | null | undefined): ProgramTone {
  return TONES[categoryKey(area)] ?? ORANGE;
}

export function ProgramIcon({
  accent,
  area,
  className,
  iconClassName,
}: {
  accent: Program['accentIcon'];
  /** The programme's area (or its name), which picks the disc's colour. */
  area: string | null | undefined;
  className?: string;
  iconClassName?: string;
}) {
  const Icon = accentIcon(accent);
  const tone = programTone(area);

  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-12 shrink-0 place-items-center rounded-full',
        tone.disc,
        tone.ink,
        className,
      )}
    >
      <Icon className={cn('size-6', iconClassName)} strokeWidth={1.8} />
    </span>
  );
}
