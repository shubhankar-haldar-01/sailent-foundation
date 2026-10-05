'use client';

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

import {
  CAMPAIGN_STATUSES,
  STATUS_LABELS,
  parseStatus,
  type CampaignStatusFilter,
} from './listing-query';
import { STATUS_VISUALS } from './campaign-status';

/**
 * The status filter beside the search box.
 *
 * Built on the design system's `Select` (Radix), so it is a real listbox:
 * arrow keys, Home/End, typeahead on the label, Escape to close, and focus
 * returned to the trigger afterwards. Only the look is new.
 *
 * The trigger is ONE LINE — the current choice's mark and name — at exactly
 * the search pill's height, with its focus ring drawn inside the edge as the
 * search pill's is. A second "Show" caption line and an outline offset outside
 * the pill both made it read larger than the box beside it. The menu repeats
 * every mark with its explanation and ticks the one in force. The pick applies
 * straight away, as the cause tiles do.
 */
export function CampaignStatusMenu({
  value,
  onChange,
}: {
  value: CampaignStatusFilter;
  onChange: (next: CampaignStatusFilter) => void;
}) {
  const current = STATUS_VISUALS[value];
  const CurrentIcon = current.icon;

  return (
    <Select name="status" value={value} onValueChange={(next) => onChange(parseStatus(next))}>
      <SelectTrigger
        aria-label="Show campaigns"
        className={cn(
          'bg-surface ring-border text-body-sm group/status h-14 cursor-pointer gap-2 rounded-full border-0 py-0 pl-2.5 pr-4 text-left shadow-md ring-1',
          'duration-(--duration-fast) transition-shadow hover:shadow-lg',
          // Inside the edge, like the search pill — not an outline that grows it.
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
          'data-[state=open]:ring-wash-mint-ink/45 data-[state=open]:ring-2',
          // The design system's chevron: firmer, and turned over while open.
          '[&>svg:last-child]:duration-(--duration-base) [&>svg:last-child]:opacity-80 [&>svg:last-child]:transition-transform data-[state=open]:[&>svg:last-child]:rotate-180',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-full',
              // Tips and grows under the pointer.
              'duration-(--duration-slow) ease-(--ease-out-soft) transition-[scale,rotate] motion-safe:group-hover/status:-rotate-12 motion-safe:group-hover/status:scale-110',
              current.wash,
              current.ink,
            )}
          >
            <CurrentIcon className="size-3.5" />
          </span>
          <span className="truncate font-bold">
            {/* Explicit, so the trigger shows the name alone rather than the
                whole option with its explanation. */}
            <SelectValue>{STATUS_LABELS[value]}</SelectValue>
          </span>
        </span>
      </SelectTrigger>

      <SelectContent
        align="end"
        sideOffset={8}
        className={cn(
          'border-border/70 min-w-[19rem] rounded-2xl p-1 shadow-lg',
          // A short fade-and-settle on open; nothing at all under reduced motion.
          'origin-(--radix-select-content-transform-origin) starting:scale-95 starting:opacity-0 transition-[opacity,scale] duration-150 motion-reduce:transition-none',
        )}
      >
        <SelectGroup>
          <SelectLabel className="text-overline tracking-(--text-overline--letter-spacing) px-3 pb-1.5 pt-2 font-semibold uppercase">
            Show campaigns
          </SelectLabel>
          {CAMPAIGN_STATUSES.map((status) => {
            const option = STATUS_VISUALS[status];
            const Icon = option.icon;

            return (
              <SelectItem
                key={status}
                value={status}
                textValue={STATUS_LABELS[status]}
                indicatorSide="end"
                className={cn(
                  // The tick inherits this ink; the label and the explanation set their own.
                  'text-wash-mint-ink-strong group/item cursor-pointer rounded-xl py-2.5 pl-2.5 pr-10',
                  'duration-(--duration-fast) transition-colors',
                  'focus:bg-wash-mint/40 data-[state=checked]:bg-wash-mint/60',
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full',
                      // Grows as the option is reached, by pointer or arrow key.
                      'duration-(--duration-base) ease-(--ease-out-soft) transition-[scale] motion-safe:group-data-[highlighted]/item:scale-110',
                      option.wash,
                      option.ink,
                    )}
                  >
                    <Icon className="size-[1.125rem]" />
                  </span>
                  <span className="leading-tight">
                    <span className="text-body-sm text-foreground block font-semibold">
                      {STATUS_LABELS[status]}
                    </span>
                    <span className="text-caption text-muted-foreground mt-0.5 block">
                      {option.description}
                    </span>
                  </span>
                </span>
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
