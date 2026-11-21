'use client';

import * as React from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  X,
} from 'lucide-react';

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@sailent/ui';

interface ParsedDateTime {
  year: number;
  month: number; // 0-11
  day: number; // 1-31
  hours12: number; // 1-12
  minutes: number; // 0-59
  ampm: 'AM' | 'PM';
}

function parseIso(val?: string | null): ParsedDateTime | null {
  if (!val || val.length < 16) return null;
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10) - 1;
  const day = parseInt(match[3]!, 10);
  const hours24 = parseInt(match[4]!, 10);
  const minutes = parseInt(match[5]!, 10);
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return { year, month, day, hours12, minutes, ampm };
}

function toIsoString(
  year: number,
  month: number, // 0-11
  day: number,
  hours12: number,
  minutes: number,
  ampm: 'AM' | 'PM',
): string {
  let hours24 = hours12 % 12;
  if (ampm === 'PM') hours24 += 12;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours24)}:${pad(minutes)}`;
}

function formatDisplay(val?: string | null): string {
  const parsed = parseIso(val);
  if (!parsed) return '';
  const dateObj = new Date(parsed.year, parsed.month, parsed.day);
  const weekday = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
  const monthName = dateObj.toLocaleDateString('en-IN', { month: 'short' });
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${weekday}, ${parsed.day} ${monthName} ${parsed.year} • ${pad(parsed.hours12)}:${pad(parsed.minutes)} ${parsed.ampm}`;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
// Every minute, 00–59: an event can start at any minute, and a stored time
// such as 10:07 must show as 07, not fall back to 00.
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const TIME_PRESETS: { label: string; hours12: number; minutes: number; ampm: 'AM' | 'PM' }[] = [
  { label: '09:00 AM', hours12: 9, minutes: 0, ampm: 'AM' },
  { label: '10:00 AM', hours12: 10, minutes: 0, ampm: 'AM' },
  { label: '02:00 PM', hours12: 2, minutes: 0, ampm: 'PM' },
  { label: '05:00 PM', hours12: 5, minutes: 0, ampm: 'PM' },
];

export interface DateTimePickerProps {
  name: string;
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
}

export function DateTimePicker({
  name,
  id,
  value = '',
  onChange,
  placeholder = 'Select date & time...',
  required = false,
  disabled = false,
  hasError = false,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = React.useMemo(() => parseIso(value), [value]);

  // Calendar view navigation (Year & Month)
  const today = new Date();
  const [viewYear, setViewYear] = React.useState(parsed ? parsed.year : today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(parsed ? parsed.month : today.getMonth());

  // Keep view in sync when value changes externally
  React.useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [parsed]);

  // Time state defaults
  const currentHours12 = parsed ? parsed.hours12 : 10;
  const currentMinutes = parsed ? parsed.minutes : 0;
  const currentAmpm = parsed ? parsed.ampm : 'AM';

  const updateValue = (
    y: number,
    m: number,
    d: number,
    h12: number,
    min: number,
    ap: 'AM' | 'PM',
  ) => {
    const iso = toIsoString(y, m, d, h12, min, ap);
    onChange?.(iso);
  };

  const handleSelectDay = (day: number) => {
    updateValue(viewYear, viewMonth, day, currentHours12, currentMinutes, currentAmpm);
  };

  const handleSetTime = (h12: number, min: number, ap: 'AM' | 'PM') => {
    const y = parsed ? parsed.year : viewYear;
    const m = parsed ? parsed.month : viewMonth;
    const d = parsed ? parsed.day : today.getDate();
    updateValue(y, m, d, h12, min, ap);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const setQuickDate = (targetDate: Date) => {
    setViewYear(targetDate.getFullYear());
    setViewMonth(targetDate.getMonth());
    updateValue(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      currentHours12,
      currentMinutes,
      currentAmpm,
    );
  };

  // Generate days for viewMonth grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className={cn('relative w-full', className)}>
      <input type="hidden" name={name} id={id || name} value={value} />
      {required ? (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            width: 1,
            height: 1,
            margin: -1,
            padding: 0,
            border: 0,
          }}
          value={value}
          required={required}
          onChange={() => {}}
          onFocus={() => setOpen(true)}
          aria-hidden="true"
        />
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-invalid={hasError || undefined}
            className={cn(
              'border-input bg-surface text-body flex h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
              'focus-visible:border-primary focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-0',
              hasError && 'border-destructive ring-destructive/20 ring-1',
              disabled && 'cursor-not-allowed opacity-50',
              !value && 'text-muted-foreground',
            )}
          >
            <div className="flex items-center gap-2.5 truncate">
              <CalendarIcon className="text-primary size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{value ? formatDisplay(value) : placeholder}</span>
            </div>

            <div className="flex items-center gap-1">
              {value && !disabled ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onChange?.('');
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md p-1 transition-colors"
                  title="Clear"
                  aria-label="Clear selected date"
                >
                  <X className="size-3.5" />
                </span>
              ) : null}
            </div>
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[324px] p-3 shadow-lg">
          {/* Header Month / Year controls */}
          <div className="flex items-center justify-between pb-2">
            <span className="text-body-sm text-foreground font-semibold">{monthLabel}</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={prevMonth}
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={nextMonth}
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="mb-2 flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setQuickDate(new Date())}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setQuickDate(tomorrow);
              }}
            >
              Tomorrow
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                setQuickDate(nextWeek);
              }}
            >
              In 1 week
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="text-muted-foreground grid grid-cols-7 gap-1 pb-1 text-center text-[12px] font-medium">
            {WEEKDAYS.map((wd) => (
              <span key={wd}>{wd}</span>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Days from previous month */}
            {Array.from({ length: firstDayWeekday }, (_, i) => {
              const d = daysInPrevMonth - firstDayWeekday + i + 1;
              return (
                <button
                  type="button"
                  key={`prev-${d}`}
                  onClick={() => {
                    if (viewMonth === 0) {
                      setViewYear((y) => y - 1);
                      setViewMonth(11);
                      updateValue(viewYear - 1, 11, d, currentHours12, currentMinutes, currentAmpm);
                    } else {
                      setViewMonth((m) => m - 1);
                      updateValue(
                        viewYear,
                        viewMonth - 1,
                        d,
                        currentHours12,
                        currentMinutes,
                        currentAmpm,
                      );
                    }
                  }}
                  className="text-muted-foreground/35 hover:bg-muted h-8 w-8 rounded-md text-[13px] transition-colors"
                >
                  {d}
                </button>
              );
            })}

            {/* Days in current month */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const isSelected =
                parsed !== null &&
                parsed.year === viewYear &&
                parsed.month === viewMonth &&
                parsed.day === d;
              const isToday =
                today.getFullYear() === viewYear &&
                today.getMonth() === viewMonth &&
                today.getDate() === d;

              return (
                <button
                  type="button"
                  key={`cur-${d}`}
                  onClick={() => handleSelectDay(d)}
                  className={cn(
                    'h-8 w-8 rounded-md text-[13px] font-medium transition-colors',
                    isSelected
                      ? 'bg-primary shadow-xs text-primary-foreground font-semibold'
                      : isToday
                        ? 'border-primary text-primary hover:bg-primary/10 border font-semibold'
                        : 'text-foreground hover:bg-muted',
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-border my-3 border-t" />

          {/* Time Picker Controls */}
          <div className="space-y-2">
            <div className="text-body-sm flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                <Clock className="text-primary size-3.5" /> Time (IST)
              </span>
              <span className="text-foreground font-mono text-xs font-semibold">
                {currentHours12.toString().padStart(2, '0')}:
                {currentMinutes.toString().padStart(2, '0')} {currentAmpm}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Hour Dropdown */}
              <div className="flex-1">
                <Select
                  value={currentHours12.toString().padStart(2, '0')}
                  onValueChange={(val) => {
                    handleSetTime(parseInt(val, 10), currentMinutes, currentAmpm);
                  }}
                >
                  <SelectTrigger className="h-9 px-2 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start">
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={h} className="text-xs">
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-muted-foreground text-sm font-bold">:</span>

              {/* Minute Dropdown */}
              <div className="flex-1">
                <Select
                  value={currentMinutes.toString().padStart(2, '0')}
                  onValueChange={(val) => {
                    handleSetTime(currentHours12, parseInt(val, 10), currentAmpm);
                  }}
                >
                  <SelectTrigger className="h-9 px-2 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start">
                    {MINUTES.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* AM / PM Toggle */}
              <div className="border-input bg-muted/40 flex h-9 rounded-md border p-0.5">
                <button
                  type="button"
                  onClick={() => handleSetTime(currentHours12, currentMinutes, 'AM')}
                  className={cn(
                    'rounded px-2.5 text-xs font-semibold transition-colors',
                    currentAmpm === 'AM'
                      ? 'bg-primary shadow-xs text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => handleSetTime(currentHours12, currentMinutes, 'PM')}
                  className={cn(
                    'rounded px-2.5 text-xs font-semibold transition-colors',
                    currentAmpm === 'PM'
                      ? 'bg-primary shadow-xs text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Quick time preset pills */}
            <div className="flex flex-wrap gap-1 pt-1">
              {TIME_PRESETS.map((preset) => {
                const isActive =
                  currentHours12 === preset.hours12 &&
                  currentMinutes === preset.minutes &&
                  currentAmpm === preset.ampm;
                return (
                  <button
                    type="button"
                    key={preset.label}
                    onClick={() => handleSetTime(preset.hours12, preset.minutes, preset.ampm)}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                      isActive
                        ? 'bg-primary/15 text-primary border-primary/40 border font-semibold'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="border-border mt-3 flex items-center justify-between border-t pt-2.5">
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive h-7 gap-1 px-2 text-xs"
                onClick={handleClear}
              >
                <RotateCcw className="size-3" /> Reset
              </Button>
            ) : (
              <span />
            )}

            <Button
              type="button"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
