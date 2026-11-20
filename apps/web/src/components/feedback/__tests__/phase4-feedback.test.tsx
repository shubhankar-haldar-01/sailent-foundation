import { act, fireEvent, render, screen, within } from '@testing-library/react';
import * as React from 'react';
import { Flag } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminListEmpty, isFiltered } from '@/components/admin/list-empty';
import { ContactMessageActions } from '@/components/admin/contact-message-actions';
import { MaintenanceBanner } from '@/components/feedback/maintenance-banner';
import { TopProgressBar } from '@/components/feedback/top-progress-bar';
import { useEditorGuard } from '@/lib/feedback/use-unsaved-changes-guard';

/*
  Phase 4 of the UI feedback system (2026-11-19): the pieces mounted across
  the site (progress bar, maintenance notice), the admin editors' unsaved-
  changes guard, the admin list empties and the confirmation before a delete.
*/

const push = vi.fn();
const refresh = vi.fn();
// Stable, as Next's own are: a new object each render would read as a navigation.
const searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => '/admin',
  useSearchParams: () => searchParams,
}));

const setContactMessageStatus = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock('@/lib/admin/actions', () => ({ setContactMessageStatus }));

beforeEach(() => {
  push.mockReset();
  setContactMessageStatus.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

/**
 * jsdom cannot navigate: cancel the click on `window`, which hears it last,
 * after the page's own listeners on `document` have had their turn.
 */
function clickWithoutNavigating(link: HTMLElement) {
  const stop = (event: Event) => event.preventDefault();
  window.addEventListener('click', stop);
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  window.removeEventListener('click', stop);
}

describe('TopProgressBar', () => {
  /* eslint-disable @next/next/no-html-link-for-pages -- plain anchors keep these tests free of the router */
  function Page() {
    return (
      <>
        <TopProgressBar />
        <a href="/admin/campaigns">Campaigns</a>
        <a href="/api/reports/export?dataset=donations">Export</a>
      </>
    );
  }
  /* eslint-enable @next/next/no-html-link-for-pages */

  it('shows after a link to another page is followed, if loading takes over 150ms', () => {
    vi.useFakeTimers();
    render(<Page />);

    act(() => clickWithoutNavigating(screen.getByRole('link', { name: 'Campaigns' })));
    expect(screen.queryByRole('progressbar')).toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole('progressbar', { name: 'Loading page' })).toBeInTheDocument();

    // It never hangs: it gives up after 10 seconds.
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('stays away for a download from a route handler, which never changes the page', () => {
    vi.useFakeTimers();
    render(<Page />);

    act(() => clickWithoutNavigating(screen.getByRole('link', { name: 'Export' })));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('MaintenanceBanner', () => {
  it('shows nothing without a message', () => {
    const { container } = render(<MaintenanceBanner message="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the message, and a dismissal holds for that message only', () => {
    const first = 'Donations are unavailable on 2 Dec, 1–2am IST.';
    const { unmount } = render(<MaintenanceBanner message={first} />);
    expect(screen.getByText('Planned maintenance')).toBeVisible();
    expect(screen.getByText(first)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Planned maintenance' }));
    expect(screen.queryByText(first)).toBeNull();
    unmount();

    // The same message stays dismissed; a new one is shown again.
    const { unmount: unmountAgain } = render(<MaintenanceBanner message={first} />);
    expect(screen.queryByText(first)).toBeNull();
    unmountAgain();
    render(<MaintenanceBanner message="Donations are unavailable on 9 Dec, 1–2am IST." />);
    expect(screen.getByText('Donations are unavailable on 9 Dec, 1–2am IST.')).toBeVisible();
  });
});

describe('useEditorGuard (the long admin editors)', () => {
  function Editor({ state }: { state: { ok?: boolean; error?: string } }) {
    const guard = useEditorGuard(state);
    return (
      <form onChange={guard.markDirty}>
        <label>
          Title
          <input name="title" defaultValue="" />
        </label>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the guard intercepts any same-site anchor */}
        <a href="/admin/campaigns">Campaigns</a>
        {guard.dialog}
      </form>
    );
  }

  it('asks before leaving once something is typed, and not after a successful save', async () => {
    const { rerender } = render(<Editor state={{}} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'School kits' } });

    fireEvent.click(screen.getByRole('link', { name: 'Campaigns' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Leave without saving?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(push).not.toHaveBeenCalled();

    // A failed save keeps the guard; a successful one clears it.
    rerender(<Editor state={{ error: 'Could not save.' }} />);
    fireEvent.click(screen.getByRole('link', { name: 'Campaigns' }));
    expect(await screen.findByRole('alertdialog')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));

    rerender(<Editor state={{ ok: true }} />);
    let reachedLink = false;
    const link = screen.getByRole('link', { name: 'Campaigns' });
    link.addEventListener('click', (event) => {
      reachedLink = !event.defaultPrevented;
      event.preventDefault();
    });
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(reachedLink).toBe(true);
  });

  it('lets an untouched editor go without asking', () => {
    render(<Editor state={{}} />);
    let reachedLink = false;
    const link = screen.getByRole('link', { name: 'Campaigns' });
    link.addEventListener('click', (event) => {
      reachedLink = !event.defaultPrevented;
      event.preventDefault();
    });
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(reachedLink).toBe(true);
  });
});

describe('AdminListEmpty', () => {
  const props = {
    icon: Flag,
    noun: 'campaigns',
    clearHref: '/admin/campaigns',
    filteredDescription: 'No campaigns match “kits”.',
    emptyDescription: 'New campaigns appear here, starting as drafts.',
  };

  it('a filtered list says nothing matches and offers the whole list back', () => {
    render(<AdminListEmpty {...props} filtered />);
    expect(screen.getByText('No campaigns match')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/admin/campaigns',
    );
  });

  it('an empty list says so, with no filter to clear', () => {
    render(<AdminListEmpty {...props} filtered={false} />);
    expect(screen.getByText('No campaigns yet')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Clear filters' })).toBeNull();
  });

  it('counts a search or filter as narrowing, but not paging, sorting or "all"', () => {
    expect(isFiltered({ page: '2', sort: 'newest' })).toBe(false);
    expect(isFiltered({ status: 'all' })).toBe(false);
    expect(isFiltered({ status: 'draft' })).toBe(true);
    expect(isFiltered({ q: 'kits' })).toBe(true);
  });
});

describe('ContactMessageActions', () => {
  it('asks before deleting a message, and deletes only when confirmed', async () => {
    render(<ContactMessageActions id="msg-1" status="new" />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete this message?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(setContactMessageStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await act(async () => {
      fireEvent.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'Delete message',
        }),
      );
    });
    await vi.waitFor(() => expect(setContactMessageStatus).toHaveBeenCalledTimes(1));
    const form = (setContactMessageStatus.mock.calls[0] as unknown[])[1] as FormData;
    expect(form.get('id')).toBe('msg-1');
    expect(form.get('status')).toBe('archived');
  });
});

void React;
