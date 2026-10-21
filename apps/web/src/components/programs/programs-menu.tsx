'use client';

import Link from 'next/link';
import { ChevronDown, LayoutGrid } from 'lucide-react';

import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sailent/ui';

import { accentIcon, programTone, type AccentIcon } from './program-icon';

export interface ProgramsMenuItem {
  label: string;
  href: string;
  /** The entry in force: marked for assistive tech and by a tint. */
  current: boolean;
  /** An area's icon, or the grid for "All categories". */
  accent: AccentIcon | 'all';
}

/**
 * The "All categories" menu — every area as a listing link, as the owner's
 * design (2026-10-14) draws it. The trigger names the area in force.
 *
 * EACH ENTRY IS A LINK to its own listing URL, so a pick is a navigation the
 * back button understands and the server renders. The menu itself needs
 * scripting (Radix), which is why the search beside it does not: the
 * listing stays usable without it.
 */
export function ProgramsMenu({
  label,
  items,
  className,
}: {
  /** What is in force, as the trigger shows it. */
  label: string;
  items: ProgramsMenuItem[];
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'bg-primary border-primary text-primary-foreground hover:bg-primary-hover group inline-flex h-12 shrink-0 items-center gap-3 whitespace-nowrap rounded-full border px-8 text-[0.9375rem] font-semibold transition-colors',
          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
          className,
        )}
      >
        {label}
        <ChevronDown
          className="duration-(--duration-base) ml-auto size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-56 rounded-xl p-1.5 shadow-lg">
        {items.map((item) => {
          const Icon = item.accent === 'all' ? LayoutGrid : accentIcon(item.accent);
          return (
            <DropdownMenuItem
              key={item.href}
              asChild
              className={cn(
                'cursor-pointer gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem]',
                item.current && 'bg-primary-soft text-primary font-semibold',
              )}
            >
              <Link
                href={item.href}
                scroll={false}
                aria-current={item.current ? 'true' : undefined}
              >
                <Icon
                  className={
                    item.accent === 'all' ? 'text-muted-foreground' : programTone(item.label).ink
                  }
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
