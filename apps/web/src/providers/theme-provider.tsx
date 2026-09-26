'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Theme provider.
 *
 * `attribute="class"` matches the `@custom-variant dark (&:where(.dark, .dark *))`
 * declared in the token stylesheet.
 *
 * `defaultTheme="light"` for the public site: it is photography-led, and a dark
 * variant that compromises the images would cost more than it gains. The admin
 * layout opts into system preference, where dark mode genuinely helps people
 * who are in the tool all day.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
