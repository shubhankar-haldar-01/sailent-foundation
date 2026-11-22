import Image from 'next/image';
import type { TeamMember } from '@/lib/mock/types';

interface MemberCardProps {
  member: TeamMember;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * One person in the /team directory: a portrait, and their name under it.
 *
 * Owner, 2026-11-22: the name only — every staff member has the same role, so
 * a "Team" tag on each card said nothing the page does not — set in plain type
 * BELOW the photograph (the editorial hero brief: no glass, no heavy shadow,
 * modest corners). The only motion is a slight ease-in of the photograph on
 * hover, and none under `prefers-reduced-motion`.
 *
 * NO STAND-IN FACE. A member without a photograph gets their initials, never
 * somebody else's portrait (the card used to fall back to another member's
 * photo).
 *
 * Not a link: there are no per-person pages (`AGENTS.md` §10).
 */
export function MemberCard({ member }: MemberCardProps) {
  // `url` is set by the content layer only when a real photograph exists
  // (from the API, or a file named for the seed), so it is the whole test.
  const photoUrl = member.photo?.url ?? null;

  return (
    <article className="group">
      <div className="bg-muted relative aspect-[4/5] w-full overflow-hidden rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/10">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={member.photo?.alt || `Portrait of ${member.name}`}
            fill
            sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 240px"
            className="object-cover object-[center_20%] transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <div
            role="img"
            aria-label={`No photograph of ${member.name}`}
            className="bg-accent text-primary grid size-full place-items-center text-2xl font-semibold tracking-tight"
          >
            <span aria-hidden="true">{initialsOf(member.name)}</span>
          </div>
        )}
      </div>
      <h3 className="text-foreground mt-3 truncate text-[0.9375rem] font-semibold leading-snug tracking-tight">
        {member.name}
      </h3>
    </article>
  );
}
