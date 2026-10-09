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
const ICONS: Record<Program['accentIcon'], typeof BookOpen> = {
  book: BookOpen,
  heart: HeartPulse,
  shield: Shield,
  sprout: Sprout,
  briefcase: Briefcase,
  leaf: Leaf,
  paw: PawPrint,
};

/**
 * The disc's colour, by AREA — as the owner's programs design (2026-10-08)
 * draws them: Education, Disaster Relief and Animal Welfare in the brand's
 * soft orange, Healthcare blue, Women Empowerment purple, Environment green.
 * An area the design does not show falls back to the soft orange.
 *
 * These are the programme cards' own colours. The campaign cards keep their
 * approved category colours (`components/home/category-icon.tsx`).
 */
const ORANGE = 'bg-primary/12 text-cta-glow';
const TONES: Record<string, string> = {
  education: ORANGE,
  healthcare: 'bg-wash-blue text-wash-blue-ink',
  childwelfare: 'bg-wash-pink text-wash-pink-ink',
  womenempowerment: 'bg-wash-violet text-wash-violet-ink',
  disasterrelief: ORANGE,
  animalwelfare: ORANGE,
  environment: 'bg-wash-mint text-wash-mint-ink',
};

export function programTone(area: string | null | undefined): string {
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
  const Icon = ICONS[accent] ?? Sprout;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-12 shrink-0 place-items-center rounded-full',
        programTone(area),
        className,
      )}
    >
      <Icon className={cn('size-6', iconClassName)} strokeWidth={1.8} />
    </span>
  );
}
