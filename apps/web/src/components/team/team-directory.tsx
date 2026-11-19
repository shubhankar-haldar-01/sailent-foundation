'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Search, Settings, Users, UsersRound } from 'lucide-react';
import type { TeamMember } from '@/lib/mock/types';
import { MemberCard } from './member-card';

interface TeamDirectoryProps {
  initialMembers: TeamMember[];
}

type DepartmentFilter = 'all' | 'Programmes' | 'Community Outreach' | 'Operations';

const departments: { key: DepartmentFilter; label: string; icon: typeof Users }[] = [
  { key: 'all', label: 'All Team Members', icon: Users },
  { key: 'Programmes', label: 'Programmes', icon: BookOpen },
  { key: 'Community Outreach', label: 'Community Outreach', icon: UsersRound },
  { key: 'Operations', label: 'Operations', icon: Settings },
];

export function TeamDirectory({ initialMembers }: TeamDirectoryProps) {
  const [activeDepartment, setActiveDepartment] = useState<DepartmentFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(6);

  // Filter members based on department and search query (excluding leadership)
  const filteredMembers = useMemo(() => {
    return initialMembers.filter((m) => {
      // Exclude leadership section members from public staff directory
      if (m.department === 'Leadership') return false;

      // Department filter
      if (activeDepartment !== 'all') {
        if (activeDepartment === 'Programmes') {
          if (m.department !== 'Programmes' && m.department !== 'Programs') return false;
        } else if (m.department !== activeDepartment) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = m.name.toLowerCase().includes(query);
        const matchesRole = m.designation.toLowerCase().includes(query);
        const matchesDept = m.department?.toLowerCase().includes(query) ?? false;
        const matchesBio = m.bio?.toLowerCase().includes(query) ?? false;
        return matchesName || matchesRole || matchesDept || matchesBio;
      }

      return true;
    });
  }, [initialMembers, activeDepartment, searchQuery]);

  return (
    <div className="mt-8 space-y-8 sm:mt-10 sm:space-y-10">
      <section aria-labelledby="our-team-heading" className="space-y-6">
        {/* ── Section Header & Integrated Search ─────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="our-team-heading"
              className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-[28px] dark:text-white"
            >
              Our Team
            </h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              A diverse and dedicated team working on the ground to support our programs and create
              meaningful change in communities.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64 sm:shrink-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team members..."
              className="shadow-xs w-full rounded-full border border-slate-200/80 bg-white py-2.5 pl-9 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#EB6A1F] focus:outline-none focus:ring-2 focus:ring-[#EB6A1F]/20 sm:text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* ── Department Filter Tabs ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {departments.map(({ key, label, icon: Icon }) => {
            const isActive = activeDepartment === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveDepartment(key);
                  setVisibleCount(6);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${
                  isActive
                    ? 'bg-[#EB6A1F] text-white shadow-sm'
                    : 'border border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700'
                }`}
                aria-pressed={isActive}
              >
                <Icon className={`size-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── 6-Column Responsive Grid ───────────────────────────────────────── */}
        {filteredMembers.length > 0 && (
          <div className="grid grid-cols-1 gap-3.5 pt-2 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            {filteredMembers.slice(0, visibleCount).map((member) => (
              <MemberCard key={member.slug} member={member} />
            ))}
          </div>
        )}

        {/* ── View More Button ───────────────────────────────────────────────── */}
        {filteredMembers.length > visibleCount && (
          <div className="pt-4 text-center sm:pt-6">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 6)}
              className="inline-flex items-center gap-2 rounded-full bg-[#EB6A1F] px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#D95F1B] hover:shadow-md sm:text-base"
            >
              View More Team Members
              <ArrowRight className="size-4" />
            </button>
          </div>
        )}

        {/* ── Empty State ────────────────────────────────────────────────────── */}
        {filteredMembers.length === 0 && (
          <div className="rounded-[20px] border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              No team members found
            </p>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              Try adjusting your search query or selecting a different department filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveDepartment('all');
                setSearchQuery('');
              }}
              className="mt-4 rounded-full bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
