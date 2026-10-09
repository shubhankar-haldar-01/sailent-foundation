import Link from 'next/link';
import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { TeamMember } from '@/lib/mock/types';

/**
 * Team member card.
 *
 * Deliberately NOT a social-media profile: a portrait, a role, a department and
 * what the person is responsible for. No follower counts, no personality
 * blurbs, no centred circular avatars over a cover image.
 *
 * Portrait ratio rather than square, because a professional directory reads
 * differently from an app's user list.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE WHOLE CARD IS THE LINK, via a stretched overlay on the name.
 *
 * Phase 9 gave each member a page of their own, and a directory whose only
 * target is a 14px name is a directory nobody opens on a phone. The anchor
 * stays on the NAME so that the accessible name of the link is the person —
 * `::after` inflates its hit area without changing what a screen reader
 * announces, and without nesting the social links inside another anchor, which
 * is invalid and makes them unreachable by keyboard.
 *
 * The biography is CLAMPED here rather than truncated in the loader: the full
 * text belongs on the page the card links to, and a server-side cut would mean
 * the detail page could never show more than the card did.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function TeamMemberCard({
  member,
  className,
  layout = 'portrait',
}: {
  member: TeamMember;
  className?: string;
  /**
   * `portrait` for the directory on /team. `card` for a short row of people —
   * the About page — where a bordered card with a wide photograph across its
   * top keeps three or thirty of them compact and level.
   */
  layout?: 'portrait' | 'card';
}) {
  if (layout === 'card') {
    return (
      <div
        className={cn(
          'border-border bg-surface group relative flex h-full flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md',
          className,
        )}
      >
        <MediaFrame
          media={member.photo}
          aspect="landscape"
          rounded={false}
          // Head and shoulders: a real portrait is cropped wide from its upper
          // part, as the design shows. The drawn placeholder keeps a taller
          // crop, because a wide one cuts its face off at the chin.
          focus="center 22%"
          className={member.photo.url ? 'aspect-[2/1]' : 'aspect-[16/10]'}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
        />
        <div className="flex flex-1 flex-col p-4">
          <h3 className="text-body-lg font-display font-bold leading-tight">
            <Link
              href={`/team/${member.slug}`}
              className="focus-visible:outline-ring rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 group-hover:underline group-hover:underline-offset-4"
            >
              {member.name}
            </Link>
          </h3>
          <p className="text-body-sm text-primary mt-0.5 font-semibold">{member.designation}</p>
          {member.department ? (
            <p className="text-caption text-muted-foreground-strong font-medium">
              {member.department}
            </p>
          ) : null}
          {member.bio ? (
            <p className="text-body-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
              {member.bio}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group relative flex flex-col', className)}>
      <MediaFrame media={member.photo} aspect="portrait" />
      <div className="mt-4">
        <h3 className="text-h4 font-semibold leading-tight">
          <Link
            href={`/team/${member.slug}`}
            className="focus-visible:outline-ring rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 group-hover:underline group-hover:underline-offset-4"
          >
            {member.name}
          </Link>
        </h3>
        <p className="text-body-sm text-primary mt-0.5 font-medium">{member.designation}</p>
        {member.department ? (
          <p className="text-caption text-muted-foreground">{member.department}</p>
        ) : null}
        {member.bio ? (
          <p className="text-body-sm text-muted-foreground mt-3 line-clamp-4 leading-relaxed">
            {member.bio}
          </p>
        ) : null}
        {/* `relative z-10` on the list lifts it above the stretched overlay,
            so a social link is still clickable rather than being covered by the
            card-wide target. */}
        {member.socialLinks?.length ? (
          <ul className="relative z-10 mt-3 flex gap-3">
            {member.socialLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-caption text-muted-foreground hover:text-foreground focus-visible:outline-ring rounded-sm underline underline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {link.label}
                  <span className="sr-only"> profile for {member.name}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
