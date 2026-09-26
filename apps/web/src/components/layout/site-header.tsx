'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronDown, Menu, Search, X } from 'lucide-react';
import { Button, cn } from '@sailent/ui';

import { primaryCta, primaryNav, type NavEntry } from '@/lib/site-config';
import { BrandLockup } from './brand-mark';

/**
 * Site header.
 *
 * Behaviour that matters more than the styling:
 *   • Donate is the ONLY button in the header, at every breakpoint. Two
 *     competing primary actions halve the effect of both.
 *   • Dropdowns open on hover AND on click, and close on Escape with focus
 *     returned — a hover-only menu is unusable by keyboard and on touch.
 *   • The mobile drawer traps nothing it should not: it locks body scroll,
 *     restores the scroll position on close, and closes on navigation.
 *   • The header condenses on scroll but never hides and reappears, which is
 *     disorienting and hides the donate action exactly when someone is
 *     scrolling to look for it.
 */
export function SiteHeader({ accountSlot }: { accountSlot?: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    setIsOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  // Lock body scroll while the drawer is open; restore position on close.
  React.useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openMenu) setOpenMenu(null);
      if (isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, openMenu]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  const isGroupActive = (entry: NavEntry) =>
    isActive(entry.href) || (entry.children?.some((child) => isActive(child.href)) ?? false);

  /** Small delay on close so the pointer can travel from trigger to panel. */
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  return (
    <header
      className={cn(
        'bg-background/95 duration-(--duration-base) sticky top-0 z-50 border-b backdrop-blur-sm transition-shadow',
        isScrolled ? 'border-border shadow-sm' : 'border-transparent',
      )}
    >
      <div className="container-page md:h-18 flex h-16 items-center justify-between gap-2 md:gap-4">
        {/* min-w-0 + a smaller type step at the narrowest widths: at 320px the
            logo and the action cluster together overflowed by a few pixels,
            and a wordmark that cannot shrink forces the page to scroll. */}
        <BrandLockup />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {primaryNav.map((entry) => {
              const active = isGroupActive(entry);

              if (!entry.children) {
                return (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'text-body-sm rounded-md px-3 py-2 font-medium transition-colors',
                        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                        active ? 'text-primary' : 'text-foreground hover:text-primary',
                      )}
                    >
                      {entry.label}
                    </Link>
                  </li>
                );
              }

              const menuId = `nav-menu-${entry.label.replace(/\s+/g, '-').toLowerCase()}`;
              const expanded = openMenu === entry.label;

              return (
                <li
                  key={entry.label}
                  className="relative"
                  onMouseEnter={() => {
                    cancelClose();
                    setOpenMenu(entry.label);
                  }}
                  onMouseLeave={scheduleClose}
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={menuId}
                    onClick={() => setOpenMenu(expanded ? null : entry.label)}
                    className={cn(
                      'text-body-sm inline-flex items-center gap-1 rounded-md px-3 py-2 font-medium transition-colors',
                      'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                      active ? 'text-primary' : 'text-foreground hover:text-primary',
                    )}
                  >
                    {entry.label}
                    <ChevronDown
                      className={cn('size-3.5 transition-transform', expanded && 'rotate-180')}
                      aria-hidden="true"
                    />
                  </button>

                  <div
                    id={menuId}
                    hidden={!expanded}
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                    className="absolute left-0 top-full w-72 pt-2"
                  >
                    <ul className="border-border bg-surface rounded-lg border p-1.5 shadow-md">
                      {entry.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              'hover:bg-muted block rounded-md px-3 py-2 transition-colors',
                              'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2',
                            )}
                          >
                            <span className="text-body-sm block font-medium">{child.label}</span>
                            {child.description ? (
                              <span className="text-caption text-muted-foreground block">
                                {child.description}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/search"
            aria-label="Search the site"
            className={cn(
              'text-muted-foreground hidden size-10 items-center justify-center rounded-lg transition-colors md:inline-flex',
              'hover:bg-muted hover:text-foreground',
              'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
          >
            <Search className="size-4" aria-hidden="true" />
          </Link>

          {/* A pill, matching the brand lockup's round mark. The shape is the
              only thing that differs from the standard button — size, colour,
              focus ring and contrast all come from the same component. */}
          <Button asChild size="md" className="hidden rounded-full sm:inline-flex">
            <Link href={primaryCta.href}>
              {primaryCta.label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          {/* No arrow below `sm`: the label alone fits the pill, and the
              glyph costs width the touch target needs more. */}
          <Button asChild size="md" className="rounded-full sm:hidden">
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>

          {/* The signed-in donor's initials, supplied by the server. Absent for
              everybody else — see `account-badge.tsx`. */}
          {accountSlot}

          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-lg lg:hidden',
              'hover:bg-muted transition-colors',
              'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
          >
            {isOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
            <span className="sr-only">{isOpen ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>

      {/* Mobile drawer. Rendered but hidden so the element stays stable for
          assistive technology rather than mounting and unmounting. */}
      <div
        id="mobile-navigation"
        hidden={!isOpen}
        className="border-border bg-background max-h-[calc(100dvh-4rem)] overflow-y-auto border-t lg:hidden"
      >
        <nav aria-label="Mobile" className="container-page py-4">
          <Button asChild size="lg" fullWidth className="mb-3">
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>

          <ul className="flex flex-col">
            {primaryNav.map((entry) => (
              <li key={entry.label} className="border-border/60 border-b last:border-0">
                <Link
                  href={entry.href}
                  className={cn(
                    'text-body flex min-h-12 items-center rounded-md px-1 font-medium transition-colors',
                    'hover:text-primary focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                    isGroupActive(entry) && 'text-primary',
                  )}
                >
                  {entry.label}
                </Link>
                {entry.children ? (
                  <ul className="border-border mb-2 ml-3 flex flex-col border-l pl-3">
                    {entry.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:outline-ring flex min-h-11 items-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
            <li className="border-border/60 border-t pt-1">
              <Link
                href="/search"
                className="text-body hover:text-primary focus-visible:outline-ring flex min-h-12 items-center gap-2 px-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Search className="size-4" aria-hidden="true" />
                Search
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
