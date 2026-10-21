import Image from 'next/image';
import { Mail } from 'lucide-react';
import type { TeamMember } from '@/lib/mock/types';
import { LinkedInIcon, XIcon } from './team-icons';

interface LeadershipCardProps {
  member: TeamMember;
}

export function LeadershipCard({ member }: LeadershipCardProps) {
  const photoUrl =
    member.photo?.url ||
    (member.photo?.seed
      ? `/images/${member.photo.seed}.webp`
      : '/images/team-shubhankar-haldar.webp');

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
    <article className="group relative flex h-full items-center gap-3.5 rounded-[16px] border border-slate-200/80 bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-all duration-200 hover:shadow-md sm:p-3.5 dark:border-slate-800 dark:bg-slate-900">
      {/* Photograph */}
      <div className="relative h-[126px] w-[96px] shrink-0 overflow-hidden rounded-[12px] bg-slate-100 sm:h-[130px] sm:w-[100px] dark:bg-slate-800">
        <Image
          src={photoUrl}
          alt={member.photo?.alt || `Portrait of ${member.name}`}
          fill
          sizes="(max-width: 640px) 96px, 100px"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-0.5">
        <div>
          {/* Role Tag */}
          <span className="inline-flex items-center whitespace-nowrap rounded-[4px] bg-[#FFF4EC] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#EB6A1F] sm:text-[11px] dark:bg-orange-950/60 dark:text-orange-400">
            {member.designation}
          </span>

          {/* Name */}
          <h3 className="mt-1 text-sm font-bold leading-tight text-slate-900 sm:text-[15px] dark:text-white">
            {member.name}
          </h3>

          {/* Bio */}
          <p className="mt-1 line-clamp-3 min-h-[46px] text-[11px] leading-relaxed text-slate-500 sm:min-h-[50px] sm:text-xs dark:text-slate-400">
            {member.bio}
          </p>
        </div>

        {/* Social Icons */}
        <div className="mt-2.5 flex items-center gap-2.5 pt-1">
          {linkedIn ? (
            <a
              href={linkedIn.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0A66C2] transition-opacity hover:opacity-80"
              aria-label={`${member.name} on LinkedIn`}
            >
              <LinkedInIcon className="size-4" />
            </a>
          ) : (
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0A66C2] transition-opacity hover:opacity-80"
              aria-label={`${member.name} on LinkedIn`}
            >
              <LinkedInIcon className="size-4" />
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
              <XIcon className="size-3.5" />
            </a>
          ) : (
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-700 transition-colors hover:text-black dark:text-slate-400 dark:hover:text-white"
              aria-label={`${member.name} on X`}
            >
              <XIcon className="size-3.5" />
            </a>
          )}

          {emailLink ? (
            <a
              href={emailLink.url}
              className="text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              aria-label={`Email ${member.name}`}
            >
              <Mail className="size-3.5" />
            </a>
          ) : (
            <a
              href={`mailto:${member.slug}@sailent.org`}
              className="text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              aria-label={`Email ${member.name}`}
            >
              <Mail className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
