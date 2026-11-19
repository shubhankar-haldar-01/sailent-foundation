import Image from 'next/image';
import type { TeamMember } from '@/lib/mock/types';

interface MemberCardProps {
  member: TeamMember;
}

export function MemberCard({ member }: MemberCardProps) {
  const photoUrl =
    member.photo?.url ||
    (member.photo?.seed ? `/images/${member.photo.seed}.webp` : '/images/team-priya-mehta.webp');

  return (
    <article className="card-interactive group relative flex h-full flex-col overflow-hidden rounded-[20px] p-2.5 sm:p-3 dark:border-slate-800 dark:bg-slate-900">
      {/* Photograph Container with Portrait Aspect Ratio */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[14px] bg-slate-100 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-slate-800">
        <Image
          src={photoUrl}
          alt={member.photo?.alt || `Portrait of ${member.name}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 220px"
          className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
        />
        {/* Soft vignette hover effect */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      {/* Details: Centered, Clean & Balanced */}
      <div className="flex flex-1 flex-col items-center justify-center pb-0.5 pt-2.5 text-center">
        <h3 className="w-full truncate text-[14px] font-bold tracking-tight text-slate-900 sm:text-[15px] dark:text-white">
          {member.name}
        </h3>

        <span className="mt-1.5 inline-flex items-center rounded-full border border-orange-200/60 bg-[#FFF4EC] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#EB6A1F] transition-colors group-hover:border-orange-300 group-hover:bg-orange-100/80 sm:text-[11px] dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300">
          Team
        </span>
      </div>
    </article>
  );
}
