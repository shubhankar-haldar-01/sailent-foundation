'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Theme provider.
 *
 * `attribute="class"` matches the `@custom-variant dark (&:where(.dark, .dark *))`
 * declared in the token stylesheet.
 *
 * DARK MODE (owner decision, 2026-10-07): the public site and the admin
 * follow the device's setting until the visitor chooses, and the choice is
 * remembered (next-themes, localStorage key `theme`). The toggle is
 * `components/layout/theme-toggle.tsx`. next-themes sets the class before
 * the first paint, so a dark device never flashes the light theme.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
