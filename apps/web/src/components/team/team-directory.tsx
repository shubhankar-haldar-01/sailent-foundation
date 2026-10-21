'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react';
import type { TeamMember } from '@/lib/mock/types';
import { LeadershipCard } from './leadership-card';
import { MemberCard } from './member-card';

interface TeamDirectoryProps {
  initialMembers: TeamMember[];
}

type DepartmentFilter = 'all' | 'Leadership' | 'Programmes' | 'Community Outreach' | 'Operations';

const departments: { key: DepartmentFilter; label: string; icon: typeof Users }[] = [
  { key: 'all', label: 'All Team Members', icon: Users },
  { key: 'Leadership', label: 'Leadership', icon: Award },
  { key: 'Programmes', label: 'Programmes', icon: BookOpen },
  { key: 'Community Outreach', label: 'Community Outreach', icon: UsersRound },
  { key: 'Operations', label: 'Operations', icon: Settings },
];

export function TeamDirectory({ initialMembers }: TeamDirectoryProps) {
  const [activeDepartment, setActiveDepartment] = useState<DepartmentFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [visibleCount, setVisibleCount] = useState(6);

  const leadershipScrollRef = useRef<HTMLDivElement>(null);

  const scrollLeadership = (direction: 'left' | 'right') => {
    if (leadershipScrollRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      leadershipScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Extract all unique roles/designations for the dropdown
  const allRoles = useMemo(() => {
    const roles = new Set<string>();
    initialMembers.forEach((m) => {
      if (m.designation) roles.add(m.designation);
    });
    return Array.from(roles);
  }, [initialMembers]);

  // Filter members based on department, search query, and role
  const filteredMembers = useMemo(() => {
    return initialMembers.filter((m) => {
      // Department filter
      if (activeDepartment !== 'all') {
        if (activeDepartment === 'Programmes') {
          if (m.department !== 'Programmes' && m.department !== 'Programs') return false;
        } else if (m.department !== activeDepartment) {
          return false;
        }
      }

      // Role filter
      if (selectedRole !== 'all' && m.designation !== selectedRole) {
        return false;
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
  }, [initialMembers, activeDepartment, selectedRole, searchQuery]);

  // Separate into Leadership and General Team
  const leadershipMembers = useMemo(() => {
    return filteredMembers.filter((m) => m.department === 'Leadership');
  }, [filteredMembers]);

  const generalTeamMembers = useMemo(() => {
    return filteredMembers.filter((m) => m.department !== 'Leadership');
  }, [filteredMembers]);

  // Determine whether to display the leadership section
  const showLeadershipSection =
    (activeDepartment === 'all' || activeDepartment === 'Leadership') &&
    leadershipMembers.length > 0;

  // Determine whether to display general team section
  const showGeneralTeamSection =
    (activeDepartment === 'all' || activeDepartment !== 'Leadership') &&
    generalTeamMembers.length > 0;

  return (
    <div className="mt-8 space-y-10 sm:mt-10 sm:space-y-12">
      {/* ── Toolbar: Department Tabs + Search & Role Select ────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Department Pills */}
        <div className="flex flex-wrap items-center gap-2">
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

        {/* Search Input & Role Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:w-60 sm:flex-none">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team members..."
              className="w-full rounded-full border border-slate-200/80 bg-white py-2 pl-9 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#EB6A1F] focus:outline-none focus:ring-2 focus:ring-[#EB6A1F]/20 sm:text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Role Dropdown */}
          <div className="relative">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              aria-label="Filter by role"
              className="appearance-none rounded-full border border-slate-200/80 bg-white py-2 pl-4 pr-9 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-[#EB6A1F] focus:outline-none focus:ring-2 focus:ring-[#EB6A1F]/20 sm:text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700"
            >
              <option value="all">All Roles</option>
              {allRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      </div>

      {/* ── Section 1: Leadership Team ─────────────────────────────────────── */}
      {showLeadershipSection && (
        <section
          aria-labelledby="leadership-heading"
          className="space-y-4 rounded-[24px] bg-[#F4F8FC] p-5 sm:space-y-5 sm:p-7 dark:border dark:border-slate-800/80 dark:bg-slate-900/60"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2
                id="leadership-heading"
                className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-[28px] dark:text-white"
              >
                Leadership Team
              </h2>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
                Guiding our vision and ensuring we create meaningful and lasting impact in the
                communities we serve.
              </p>
            </div>

            {/* Navigation Arrows for Carousel */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollLeadership('left')}
                aria-label="Previous leadership members"
                className="flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollLeadership('right')}
                aria-label="Next leadership members"
                className="flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          {/* Leadership Cards Container */}
          <div
            ref={leadershipScrollRef}
            className="scrollbar-none flex gap-3.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-4"
          >
            {leadershipMembers.map((member) => (
              <div key={member.slug} className="h-full min-w-[270px] flex-shrink-0 sm:min-w-0">
                <LeadershipCard member={member} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 2: Our Team (Staff & Outreach) ─────────────────────────── */}
      {showGeneralTeamSection && (
        <section aria-labelledby="our-team-heading" className="space-y-4">
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

          {/* 6-Column Responsive Grid */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            {generalTeamMembers.slice(0, visibleCount).map((member) => (
              <MemberCard key={member.slug} member={member} />
            ))}
          </div>

          {/* View More Button */}
          {generalTeamMembers.length > visibleCount && (
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
        </section>
      )}

      {/* Empty State */}
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
              setSelectedRole('all');
            }}
            className="mt-4 rounded-full bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
