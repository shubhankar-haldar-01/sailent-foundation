'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@sailent/ui';

/**
 * Light / dark switch (owner decision, 2026-10-07).
 *
 * The site follows the device's setting until somebody presses this; from
 * then on their choice is remembered (`providers/theme-provider.tsx`).
 *
 * WHY THE `mounted` FLAG. The server cannot know the device's theme, so it
 * renders the switch as "not pressed". Reporting a state before hydration
 * would be a guess, and a wrong guess is a hydration mismatch, so the pressed
 * state is only announced once the client knows it. The ICON never needs the
 * flag: both are rendered and the `.dark` class (set by next-themes before
 * the first paint) decides which one shows.
 */
function useDarkMode() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';
  return {
    mounted,
    isDark,
    toggle: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
  };
}

/** The header's icon button: a moon in light mode, a sun in dark mode. */
export function ThemeToggle({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  const { mounted, isDark, toggle } = useDarkMode();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Dark mode"
      aria-pressed={mounted ? isDark : undefined}
      className={cn(
        'text-muted-foreground inline-flex size-10 items-center justify-center rounded-lg transition-colors',
        'hover:bg-muted hover:text-foreground',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
    >
      <Moon className={cn('size-[1.125rem] dark:hidden', iconClassName)} aria-hidden="true" />
      <Sun className={cn('hidden size-[1.125rem] dark:block', iconClassName)} aria-hidden="true" />
    </button>
  );
}

/**
 * The phone menu's row: "Dark mode" with a switch at the end. A real
 * `role="switch"` so a screen reader announces it as on or off.
 */
export function ThemeToggleRow({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  const { mounted, isDark, toggle } = useDarkMode();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={toggle}
      className={cn('w-full text-left', className)}
    >
      <Moon className={cn('dark:hidden', iconClassName)} aria-hidden="true" />
      <Sun className={cn('hidden dark:block', iconClassName)} aria-hidden="true" />
      Dark mode
      <span
        aria-hidden="true"
        className={cn(
          'ml-auto inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors',
          mounted && isDark ? 'bg-primary' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'bg-surface size-5 rounded-full shadow-sm transition-transform',
            mounted && isDark ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  );
}
