import { Book, Briefcase, Dog, Heart, Leaf, Shield, Sprout } from 'lucide-react';

import { cn } from '@sailent/ui';

import type { Program } from '@/lib/mock/types';

/**
 * The program's illustrative icon.
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
const ICONS: Record<Program['accentIcon'], typeof Book> = {
  book: Book,
  heart: Heart,
  shield: Shield,
  sprout: Sprout,
  briefcase: Briefcase,
  leaf: Leaf,
  paw: Dog,
};

export function ProgramIcon({
  accent,
  className,
}: {
  accent: Program['accentIcon'];
  className?: string;
}) {
  const Icon = ICONS[accent] ?? Sprout;

  return (
    <span
      className={cn(
        'bg-accent text-primary grid size-9 shrink-0 place-items-center rounded-lg',
        className,
      )}
    >
      <Icon className="size-4.5" aria-hidden="true" />
    </span>
  );
}
