import Image from 'next/image';
import { ArrowRight, Mail } from 'lucide-react';
import type { TeamMember } from '@/lib/mock/types';
import { LinkedInIcon, XIcon } from './team-icons';

interface MemberCardProps {
  member: TeamMember;
}

export function MemberCard({ member }: MemberCardProps) {
  const photoUrl =
    member.photo?.url ||
    (member.photo?.seed ? `/images/${member.photo.seed}.webp` : '/images/team-priya-mehta.webp');

  const linkedIn = member.socialLinks?.find(
    (l) => l.label.toLowerCase() === 'linkedin' || l.url.includes('linkedin'),
  );
  const xLink = member.socialLinks?.find(
    (l) =>
      l.label.toLowerCase() === 'x' ||
      l.label.toLowerCase() === 'twitter' ||
      l.url.includes('x.com'),
  );
  const emailLink = member.socialLinks?.find(
    (l) => l.label.toLowerCase() === 'email' || l.url.startsWith('mailto:'),
  );

  return (
    <article className="card-interactive group relative flex h-full flex-col rounded-[16px] p-2.5 sm:p-3 dark:border-slate-800 dark:bg-slate-900">
      {/* Photograph */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[12px] bg-slate-100 dark:bg-slate-800">
        <Image
          src={photoUrl}
          alt={member.photo?.alt || `Portrait of ${member.name}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 220px"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col pt-2.5">
        <h3 className="truncate text-sm font-bold text-slate-900 sm:text-[15px] dark:text-white">
          {member.name}
        </h3>

        <span className="mt-1 inline-block w-fit rounded-[4px] bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#2563EB] sm:text-[11px] dark:bg-blue-950/60 dark:text-blue-400">
          {member.designation}
        </span>

        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-500 sm:text-xs dark:text-slate-400">
          {member.bio}
        </p>

        {/* Bottom Bar: Socials + Arrow Action */}
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex items-center gap-2">
            {linkedIn ? (
              <a
                href={linkedIn.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0A66C2] transition-opacity hover:opacity-80"
                aria-label={`${member.name} on LinkedIn`}
              >
                <LinkedInIcon className="size-3.5" />
              </a>
            ) : (
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0A66C2] transition-opacity hover:opacity-80"
                aria-label={`${member.name} on LinkedIn`}
              >
                <LinkedInIcon className="size-3.5" />
              </a>
            )}

            {xLink ? (
              <a
                href={xLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-700 transition-colors hover:text-black dark:text-slate-400 dark:hover:text-white"
                aria-label={`${member.name} on X`}
              >
                <XIcon className="size-3" />
              </a>
            ) : (
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-700 transition-colors hover:text-black dark:text-slate-400 dark:hover:text-white"
                aria-label={`${member.name} on X`}
              >
                <XIcon className="size-3" />
              </a>
            )}

            {emailLink ? (
              <a
                href={emailLink.url}
                className="text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                aria-label={`Email ${member.name}`}
              >
                <Mail className="size-3" />
              </a>
            ) : (
              <a
                href={`mailto:${member.slug}@sailent.org`}
                className="text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                aria-label={`Email ${member.name}`}
              >
                <Mail className="size-3" />
              </a>
            )}
          </div>

          <span
            className="flex size-6 items-center justify-center rounded-full border border-orange-200 text-[#EB6A1F] transition-colors group-hover:bg-[#EB6A1F] group-hover:text-white dark:border-orange-900/50"
            aria-hidden="true"
          >
            <ArrowRight className="size-3" />
          </span>
        </div>
      </div>
    </article>
  );
}
