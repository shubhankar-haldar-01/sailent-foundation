'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Loader2, Search } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  cn,
} from '@sailent/ui';

import { eventsHref, type DateOption, type EventsQuery } from './events-query';

/** The menu's "no month" choice. Radix refuses an empty string as an item value. */
const ALL_DATES = 'all';

/** One menu row: the tick at the end, the chosen month lightly washed in the brand's orange. */
const ITEM =
  'cursor-pointer rounded-lg py-2.5 pl-3 pr-9 data-[state=checked]:bg-primary-soft data-[state=checked]:font-semibold';

/**
 * The search box and the "All Dates" menu — the only two controls the
 * owner's design (2026-10-17) puts over the events grid. On one row from `md`,
 * stacked on a phone.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A REAL GET FORM, INTERCEPTED — the campaigns and programs searches'
 * pattern. Enter submits `?q=…` (with the month in force), and the client
 * turns that into a clean URL and navigates without a reload or a jump to
 * the top; the server renders the match. Emptying the box lifts the search
 * at once.
 *
 * (Not a no-script promise: like /campaigns and /programs, this listing
 * streams in behind a loading state, and showing streamed content takes the
 * page's scripts.)
 *
 * THE INPUT IS UNCONTROLLED, as the programs search's is: on a slow device the
 * page is usable before React hydrates it, and a controlled input would wipe
 * whatever had been typed by then. The `key` remounts it when the URL's
 * search changes underneath (the back button, "Clear filters").
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The menu applies on pick, keeping whatever is in the search box. It is the
 * design system's `Select` (Radix): a real listbox, with arrow keys,
 * typeahead, Escape, and focus returned to the trigger. Its choices are the
 * months that have an upcoming event — never a month with nothing in it.
 *
 * Either change goes back to the first page of its own results. While one is
 * on its way, a `data-pending` marker lets the page dim the cards below with
 * CSS alone (`group-has-[[data-pending]]`).
 */
export function EventToolbar({
  query,
  activeDate,
  months,
  className,
}: {
  query: EventsQuery;
  /** The month in force, already resolved against the real ones. */
  activeDate: string | null;
  months: DateOption[];
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const current = query.q ?? '';

  function go(next: { q: string | null; date: string | null }) {
    const href = eventsHref({ q: next.q?.trim() || null, date: next.date });
    startTransition(() => router.push(href, { scroll: false }));
  }

  const dateLabel = months.find((option) => option.value === activeDate)?.label ?? 'All Dates';

  return (
    <form
      role="search"
      aria-label="Events"
      action="/events"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        go({ q: String(new FormData(event.currentTarget).get('q') ?? ''), date: activeDate });
      }}
      className={cn('grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem] lg:gap-4', className)}
    >
      {pending ? <span data-pending="" hidden /> : null}
      {/* So the form's own submission carries the month in force. */}
      {activeDate ? <input type="hidden" name="date" value={activeDate} /> : null}

      <div className="relative">
        <span
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute inset-y-0 left-4 grid place-items-center"
        >
          {pending ? (
            <Loader2 className="size-[1.125rem] animate-spin" />
          ) : (
            <Search className="size-[1.125rem]" strokeWidth={2} />
          )}
        </span>
        <label htmlFor="event-search" className="sr-only">
          Search events
        </label>
        <input
          ref={inputRef}
          key={current}
          id="event-search"
          type="search"
          name="q"
          defaultValue={current}
          onChange={(event) => {
            if (event.target.value === '' && query.q) go({ q: null, date: activeDate });
          }}
          maxLength={200}
          autoComplete="off"
          placeholder="Search events by title or keyword..."
          aria-busy={pending || undefined}
          /*
            No `outline-none` here: in Tailwind v4 it sets the outline STYLE to
            none, which the focus ring below would inherit — leaving keyboard
            focus marked by a 1px border alone.
          */
          className={cn(
            'bg-surface border-border text-foreground placeholder:text-muted-foreground shadow-xs h-12 w-full min-w-0 rounded-xl border pl-11 pr-4 text-sm',
            'duration-(--duration-base) transition-[border-color,box-shadow] hover:shadow-sm',
            'focus-visible:border-primary focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-0',
          )}
        />
      </div>

      <Select
        value={activeDate ?? ALL_DATES}
        onValueChange={(next) =>
          go({
            // What is in the box now, submitted or not — picking a month keeps it.
            q: inputRef.current?.value ?? query.q,
            date: next === ALL_DATES ? null : next,
          })
        }
      >
        <SelectTrigger
          aria-label="Filter events by date"
          className={cn(
            'bg-surface border-border text-foreground shadow-xs h-12 cursor-pointer gap-2 rounded-xl border px-4 text-left text-sm',
            'duration-(--duration-base) transition-shadow hover:shadow-sm',
            'focus-visible:border-primary focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-0',
            '[&>svg:last-child]:duration-(--duration-base) [&>svg:last-child]:transition-transform data-[state=open]:[&>svg:last-child]:rotate-180',
          )}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <CalendarDays
              className="text-muted-foreground size-[1.125rem] shrink-0"
              aria-hidden="true"
            />
            <span className="truncate font-medium">
              <SelectValue>{dateLabel}</SelectValue>
            </span>
          </span>
        </SelectTrigger>

        <SelectContent
          align="end"
          sideOffset={8}
          className={cn(
            'border-border/70 min-w-[15rem] rounded-xl p-1 shadow-lg',
            'origin-(--radix-select-content-transform-origin) starting:scale-95 starting:opacity-0 transition-[opacity,scale] duration-150 motion-reduce:transition-none',
          )}
        >
          <SelectGroup>
            <SelectLabel className="text-overline tracking-(--text-overline--letter-spacing) px-3 pb-1.5 pt-2 font-semibold uppercase">
              Show events in
            </SelectLabel>
            <SelectItem value={ALL_DATES} indicatorSide="end" className={ITEM}>
              All Dates
            </SelectItem>
            {months.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                indicatorSide="end"
                className={ITEM}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </form>
  );
}
