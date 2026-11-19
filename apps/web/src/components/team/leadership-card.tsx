import Image from 'next/image';
import type { TeamMember } from '@/lib/mock/types';

interface LeadershipCardProps {
  member: TeamMember;
}

export function LeadershipCard({ member }: LeadershipCardProps) {
  const photoUrl =
    member.photo?.url ||
    (member.photo?.seed
      ? `/images/${member.photo.seed}.webp`
      : '/images/team-shubhankar-haldar.webp');

  return (
    <article className="card-interactive group relative flex h-full items-center gap-3.5 rounded-[20px] p-3 sm:p-3.5 dark:border-slate-800 dark:bg-slate-900">
      {/* Photograph */}
      <div className="relative h-[92px] w-[76px] shrink-0 overflow-hidden rounded-[14px] bg-slate-100 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] sm:h-[100px] sm:w-[82px] dark:bg-slate-800">
        <Image
          src={photoUrl}
          alt={member.photo?.alt || `Portrait of ${member.name}`}
          fill
          sizes="(max-width: 640px) 76px, 82px"
          className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      {/* Details: Name and Designation Only */}
      <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
        <h3 className="truncate text-sm font-bold leading-tight text-slate-900 sm:text-[15px] dark:text-white">
          {member.name}
        </h3>

        <span className="mt-1.5 inline-flex w-fit items-center whitespace-nowrap rounded-full border border-orange-200/60 bg-[#FFF4EC] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#EB6A1F] transition-colors group-hover:border-orange-300 group-hover:bg-orange-100/80 sm:text-[11px] dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300">
          {member.designation}
        </span>
      </div>
    </article>
  );
}
