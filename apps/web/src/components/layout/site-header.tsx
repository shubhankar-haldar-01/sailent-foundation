'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronDown, Menu, Search, UserRound, X } from 'lucide-react';
import { Button, cn } from '@sailent/ui';

import { primaryCta, primaryNav, siteConfig, type NavEntry } from '@/lib/site-config';
import { BrandLockup } from './brand-mark';
import { ThemeToggle, ThemeToggleRow } from './theme-toggle';
import { SOCIAL_ICONS_SOLID } from './social-icons';

/**
 * Site header.
 *
 * Behaviour that matters more than the styling:
 *   • The bar's one button, from `sm` up, is "Login / Sign Up" (owner
 *     request, 2026-10-08 — it replaced Donate there). There is no separate
 *     sign-up: a donor account is created by the first donation, so the
 *     button goes to /sign-in. A signed-in donor sees their initials instead
 *     (`accountSlot`). On a phone the bar shows only the brand, dark mode
 *     and the menu; inside the menu Donate stays the first full-width
 *     button, and "Login / Sign Up" (or "My account") is a row below it.
 *   • Dropdowns open on hover AND on click, and close on Escape with focus
 *     returned — a hover-only menu is unusable by keyboard and on touch.
 *   • The mobile drawer traps nothing it should not: it locks body scroll,
 *     restores the scroll position on close, and closes on navigation.
 *   • The header condenses on scroll but never hides and reappears, which is
 *     disorienting and hides the donate action exactly when someone is
 *     scrolling to look for it.
 */
export function SiteHeader({
  accountSlot,
  signedIn = false,
  socialLinks = [],
}: {
  accountSlot?: React.ReactNode;
  /** A donor is signed in: the bar shows `accountSlot` rather than the login button. */
  signedIn?: boolean;
  /**
   * The organisation's social links, from Admin → Settings, for the foot of
   * the mobile menu. Passed in by the server layout; none means no row.
   */
  socialLinks?: { label: string; url: string }[];
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);
  /** The group open in the mobile menu — one at a time, as the design shows. */
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
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

  /*
    THE PHONE MENU'S OWN "CURRENT PAGE".

    Its groups list their own links (`mobileChildren`), and two of those are
    also somewhere else: Stories has a top-level row, and "Partner with Us"
    shares /contact with the Contact Us row under the groups. On those pages
    the row marks the current page, and no group claims it.
  */
  const mobileChildrenOf = (entry: NavEntry) => entry.mobileChildren ?? entry.children ?? [];
  const isMobileChildActive = (href: string) => href !== '/contact' && isActive(href);
  const hasTopLevelRow = primaryNav.some((entry) => !entry.children && isActive(entry.href));
  const isMobileGroupActive = (entry: NavEntry) =>
    !hasTopLevelRow && mobileChildrenOf(entry).some((child) => isMobileChildActive(child.href));

  // On opening: open the group holding the current page, and put focus on the
  // close button so a keyboard or screen-reader user starts inside.
  React.useEffect(() => {
    if (!isOpen) return;
    setOpenGroup(
      primaryNav.find((entry) => entry.children && isMobileGroupActive(entry))?.label ?? null,
    );
    closeRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [isOpen]);

  const closeDrawer = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  /** Keep Tab inside the open menu: it covers the page, so nothing behind it is reachable. */
  const trapFocus = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab' || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  /** Small delay on close so the pointer can travel from trigger to panel. */
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  return (
    <>
      <header
        className={cn(
          // Pure white on the tinted page (owner decision, 2026-10-08), so the bar
          // stands apart from the content below it.
          'bg-surface duration-(--duration-base) sticky top-0 z-50 border-b backdrop-blur-sm transition-shadow',
          isScrolled ? 'border-border shadow-sm' : 'max-sm:border-border/60 border-transparent',
        )}
      >
        <div className="container-page md:h-18 flex h-16 items-center justify-between gap-2 md:gap-4 lg:max-xl:gap-2.5">
          {/* min-w-0 + a smaller type step at the narrowest widths: at 320px the
            logo and the action cluster together overflowed by a few pixels,
            and a wordmark that cannot shrink forces the page to scroll. */}
          <BrandLockup variant="header" tagline="always" />

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
                          'whitespace-nowrap rounded-md px-1.5 py-2 text-[0.8125rem] font-medium transition-colors xl:px-3 xl:text-[0.875rem]',
                          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                          active
                            ? 'text-primary font-semibold'
                            : 'text-foreground hover:text-primary',
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
                        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-2 text-[0.8125rem] font-medium transition-colors xl:px-3 xl:text-[0.875rem]',
                        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                        active
                          ? 'text-primary font-semibold'
                          : 'text-foreground hover:text-primary',
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

          {/* No search icon in the bar (owner request, 2026-10-07). Search stays
            reachable from the menu and at /search. */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            {/* Light / dark (owner decision, 2026-10-07): before the login button from
              `sm` up; on a phone beside the menu button, at the menu icon's
              size and navy (owner request). */}
            <ThemeToggle
              className="max-sm:text-accent-900 max-sm:dark:text-foreground max-sm:size-11"
              iconClassName="max-sm:size-7 max-sm:[stroke-width:1.75]"
            />

            {/* Signed in: the donor's initials, supplied by the server (see
              `account-badge.tsx`). Otherwise a pill to sign in, matching the
              brand lockup's round mark; size, colour, focus ring and contrast
              come from the standard button. */}
            {signedIn ? (
              accountSlot
            ) : (
              <Button
                asChild
                size="md"
                // Narrower beside the full nav at 1024–1279px, so the brand name keeps its room.
                className="hidden rounded-full sm:inline-flex lg:max-xl:px-3.5"
              >
                <Link href="/sign-in" aria-current={isActive('/sign-in') ? 'page' : undefined}>
                  <UserRound className="size-4 lg:max-xl:hidden" aria-hidden="true" />
                  Login / Sign Up
                </Link>
              </Button>
            )}

            <button
              ref={triggerRef}
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              aria-expanded={isOpen}
              aria-controls="mobile-navigation"
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-lg lg:hidden',
                'max-sm:text-accent-900 max-sm:dark:text-foreground',
                'hover:bg-muted transition-colors',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
              )}
            >
              {/* Always "Open menu": while the menu is open it covers this
                  button and has its own close button — two controls named
                  "Close menu" would be ambiguous. `aria-expanded` says which. */}
              <Menu
                className="size-5 max-sm:size-[1.875rem] max-sm:[stroke-width:1.6]"
                aria-hidden="true"
              />
              <span className="sr-only">Open menu</span>
            </button>
          </div>
        </div>
      </header>

      {/*
        ══════════════════════════════════════════════════════════════════════
        THE MOBILE MENU — full screen, as the approved mobile design has it.

        A SIBLING of the header, not inside it: the header's backdrop blur
        makes it the containing block for anything `fixed` within it, which
        would shrink this to the header's 64px. Rendered but hidden while
        closed, so the element stays stable for assistive technology.

        It is a modal dialog while open: focus moves to its close button,
        Tab stays inside it, Escape closes it (the listener above) and focus
        goes back to the button that opened it. Body scroll is locked behind
        it by the effect above.
        ══════════════════════════════════════════════════════════════════════
      */}
      <div
        id="mobile-navigation"
        ref={drawerRef}
        hidden={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onKeyDown={trapFocus}
        className={cn(
          'bg-surface fixed inset-0 z-[60] flex-col overflow-y-auto lg:hidden',
          isOpen ? 'flex' : 'hidden',
        )}
      >
        <div className="container-page flex h-16 shrink-0 items-center justify-between gap-3">
          <BrandLockup variant="header" tagline="always" />
          <button
            ref={closeRef}
            type="button"
            onClick={closeDrawer}
            className="hover:bg-muted focus-visible:outline-ring inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <X className="size-9.5" strokeWidth={1.3} aria-hidden="true" />
            <span className="sr-only">Close menu</span>
          </button>
        </div>

        <nav aria-label="Mobile" className="container-page flex flex-1 flex-col pb-8">
          {/* Pulled out 6px so the pills sit wider than the button below them. */}
          <ul className="-mx-1.5 flex flex-col">
            {primaryNav.map((entry) => {
              const children = entry.children ? mobileChildrenOf(entry) : null;
              // One soft pill at a time, as the design draws it: the open
              // group's, or — with every group closed — the current page's.
              const highlighted = openGroup
                ? entry.label === openGroup
                : children
                  ? isMobileGroupActive(entry)
                  : isActive(entry.href);
              const row = cn(
                // 44px to touch; the transparent border insets the pill to 38px.
                'text-body px-4.5 flex h-11 w-full items-center justify-between gap-3 rounded-full border-y-[3px] border-transparent bg-clip-padding text-left font-medium transition-colors',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2',
                highlighted ? 'bg-primary/7 text-primary' : 'text-foreground hover:bg-muted/60',
              );

              if (!children) {
                return (
                  <li key={entry.label}>
                    <Link
                      href={entry.href}
                      aria-current={isActive(entry.href) ? 'page' : undefined}
                      onClick={() => setIsOpen(false)}
                      className={row}
                    >
                      {entry.label}
                    </Link>
                  </li>
                );
              }

              const expanded = openGroup === entry.label;
              const groupId = `mobile-group-${entry.label.replace(/\s+/g, '-').toLowerCase()}`;
              return (
                <li key={entry.label}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={groupId}
                    onClick={() => setOpenGroup(expanded ? null : entry.label)}
                    className={row}
                  >
                    {entry.label}
                    <ChevronDown
                      aria-hidden="true"
                      strokeWidth={1.9}
                      className={cn(
                        '-mr-1 size-7 shrink-0 transition-transform',
                        expanded && 'rotate-180',
                      )}
                    />
                  </button>
                  <ul id={groupId} hidden={!expanded} className="mb-1 mt-1 flex flex-col">
                    {children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={isMobileChildActive(child.href) ? 'page' : undefined}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            'text-body flex min-h-8 items-center rounded-full pl-10 pr-4 transition-colors',
                            'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2',
                            isMobileChildActive(child.href)
                              ? 'text-primary font-medium'
                              : 'text-accent-900/80 hover:text-primary dark:text-foreground/75',
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>

          {/* Stretched by the column, 4px in from the gutter on each side. */}
          <Button asChild size="lg" className="h-12.5 mx-1 mt-4 rounded-full">
            <Link href={primaryCta.href} onClick={() => setIsOpen(false)}>
              {primaryCta.label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>

          <ul
            className={cn(
              'border-border mx-1 mt-5 border-t pb-2 pt-2.5',
              socialLinks.length > 0 && 'border-b',
            )}
          >
            <li>
              <Link
                href={signedIn ? '/dashboard' : '/sign-in'}
                aria-current={isActive(signedIn ? '/dashboard' : '/sign-in') ? 'page' : undefined}
                onClick={() => setIsOpen(false)}
                className={utilityRow(isActive(signedIn ? '/dashboard' : '/sign-in'))}
              >
                <UserRound className="size-7 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                {signedIn ? 'My account' : 'Login / Sign Up'}
              </Link>
            </li>
            <li>
              <Link
                href="/search"
                aria-current={isActive('/search') ? 'page' : undefined}
                onClick={() => setIsOpen(false)}
                className={utilityRow(isActive('/search'))}
              >
                <Search className="size-7 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                Search
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                aria-current={isActive('/contact') ? 'page' : undefined}
                onClick={() => setIsOpen(false)}
                className={utilityRow(isActive('/contact'))}
              >
                <MailSolid className="size-7 shrink-0" />
                Contact Us
              </Link>
            </li>
            <li>
              <ThemeToggleRow className={utilityRow(false)} iconClassName="size-7 shrink-0" />
            </li>
          </ul>

          {socialLinks.length > 0 ? (
            <ul className="mx-0.5 flex items-center justify-between gap-2 pt-3">
              {socialLinks.map((link) => {
                const Icon = SOCIAL_ICONS_SOLID[link.label];
                return (
                  <li key={link.label}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${siteConfig.name} on ${link.label}`}
                      className="text-(--neutral-700) hover:text-foreground dark:text-foreground/80 focus-visible:outline-ring grid size-11 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {Icon ? (
                        <Icon className="size-7" aria-hidden="true" />
                      ) : (
                        <span aria-hidden="true" className="text-body-sm font-semibold">
                          {link.label.slice(0, 1)}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </nav>
      </div>
    </>
  );
}

/** Login, Search, Contact Us and Dark mode, under the menu's Donate button. */
function utilityRow(current: boolean) {
  return cn(
    'text-body flex h-11 items-center gap-5 rounded-lg px-1.5 transition-colors',
    'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2',
    current ? 'text-primary font-medium' : 'text-foreground hover:text-primary',
  );
}

/** A solid envelope, as the menu's design draws Contact Us; the flap is cut out. */
function MailSolid({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M4 4h16a2 2 0 0 1 2 2v.35l-10 6.3-10-6.3V6a2 2 0 0 1 2-2Zm18 4.7V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.7l9.47 5.97a1 1 0 0 0 1.06 0L22 8.7Z" />
    </svg>
  );
}
