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
              className="text-foreground text-2xl font-extrabold tracking-tight sm:text-[28px]"
            >
              Our Team
            </h2>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              A diverse and dedicated team working on the ground to support our programs and create
              meaningful change in communities.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64 sm:shrink-0">
            <Search className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team members..."
              className="shadow-xs border-border/80 bg-surface text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 w-full rounded-full border py-2.5 pl-9 pr-4 text-xs focus:outline-none focus:ring-2 sm:text-sm"
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
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border-border/80 bg-surface text-foreground hover:border-border-strong border'
                }`}
                aria-pressed={isActive}
              >
                <Icon className={`size-4 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
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
              className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold shadow-sm transition-all duration-200 hover:shadow-md sm:text-base"
            >
              View More Team Members
              <ArrowRight className="size-4" />
            </button>
          </div>
        )}

        {/* ── Empty State ────────────────────────────────────────────────────── */}
        {filteredMembers.length === 0 && (
          <div className="border-border bg-surface rounded-[20px] border border-dashed p-12 text-center">
            <p className="text-foreground text-base font-semibold">No team members found</p>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              Try adjusting your search query or selecting a different department filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveDepartment('all');
                setSearchQuery('');
              }}
              className="bg-muted text-foreground hover:bg-border mt-4 rounded-full px-5 py-2 text-xs font-semibold transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
