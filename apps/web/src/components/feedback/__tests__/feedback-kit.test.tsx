import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Banner,
  Button,
  ConfirmationDialog,
  ErrorBoundary,
  OfflineBanner,
  Skeleton,
  SkeletonTableRow,
  Toaster,
  resetToastsForTests,
  toast,
} from '@sailent/ui';

import { useAsyncAction } from '@/lib/feedback/use-async-action';
import { useUnsavedChangesGuard } from '@/lib/feedback/use-unsaved-changes-guard';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  resetToastsForTests();
  push.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const titles = () =>
  within(screen.getByRole('region', { name: 'Notifications' }))
    .queryAllByText(/./, { selector: 'p' })
    .map((node) => node.textContent);

describe('toasts', () => {
  it('closes a success after 4s and keeps an error until it is closed', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.success('Campaign saved');
      toast.error('Couldn’t save campaign');
    });

    expect(screen.getByRole('status')).toHaveTextContent('Campaign saved');
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t save campaign');

    act(() => vi.advanceTimersByTime(4100));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('alert')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Close notification' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows at most three, newest on top', () => {
    render(<Toaster />);
    act(() => {
      for (const n of [1, 2, 3, 4]) toast.info(`Note ${n}`);
    });
    expect(titles()).toEqual(['Note 4', 'Note 3', 'Note 2']);
  });

  it('pauses while hovered, and Esc closes the one in focus', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.success('Settings saved');
    });
    const item = screen.getByRole('status');

    fireEvent.mouseEnter(item);
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole('status')).toBeVisible();
    fireEvent.mouseLeave(item);
    act(() => vi.advanceTimersByTime(4100));
    expect(screen.queryByRole('status')).toBeNull();

    act(() => {
      toast.warning('Image is large');
    });
    fireEvent.keyDown(screen.getByRole('status'), { key: 'Escape' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('turns a loading toast into its outcome, which then times out as that type', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    let id = '';
    act(() => {
      id = toast.loading('Preparing export…');
    });
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('status')).toHaveTextContent('Preparing export…');

    act(() => toast.update(id, { type: 'success', title: 'Export ready' }));
    expect(screen.getByRole('status')).toHaveTextContent('Export ready');
    act(() => vi.advanceTimersByTime(4100));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers Undo for six seconds, and a copied pill for two', () => {
    vi.useFakeTimers();
    const restore = vi.fn();
    render(<Toaster />);
    act(() => {
      toast.undo('Campaign archived', restore);
    });
    act(() => vi.advanceTimersByTime(5000));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(restore).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Campaign archived')).toBeNull();

    act(() => {
      toast.copied('Link copied');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Link copied');
    act(() => vi.advanceTimersByTime(2100));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('useAsyncAction', () => {
  it('shows a success toast, and ignores a second run while the first is in flight', async () => {
    render(<Toaster />);
    let finish: () => void = () => undefined;
    const action = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useAsyncAction(action, { success: 'Campaign saved' }));

    let first: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.run();
      void result.current.run();
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);

    await act(async () => {
      finish();
      await first;
    });
    expect(result.current.pending).toBe(false);
    expect(screen.getByRole('status')).toHaveTextContent('Campaign saved');
  });

  it('shows a friendly error with Try again, which repeats the call', async () => {
    render(<Toaster />);
    const action = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('db down'), { code: 'INTERNAL_ERROR', status: 500 }),
      )
      .mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() =>
      useAsyncAction(action, { success: 'Campaign saved', errorTitle: 'Couldn’t save campaign' }),
    );

    await act(async () => {
      await result.current.run('draft-1');
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t save campaign');
    expect(alert).not.toHaveTextContent('db down');

    await act(async () => {
      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    });
    expect(action).toHaveBeenLastCalledWith('draft-1');
    expect(screen.getByRole('status')).toHaveTextContent('Campaign saved');
  });

  it('treats a server action’s { error } result as a failure', async () => {
    render(<Toaster />);
    const { result } = renderHook(() =>
      useAsyncAction(async () => ({ error: 'Enter a title.' }), { success: 'Story saved' }),
    );
    await act(async () => {
      await result.current.run();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a title.');
    expect(screen.queryByText('Story saved')).toBeNull();
  });
});

describe('Button loading', () => {
  it('disables the button, says it is busy and shows the loading text', () => {
    const onClick = vi.fn();
    render(
      <Button isLoading loadingText="Saving…" onClick={onClick}>
        Save settings
      </Button>,
    );
    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent('Saving…');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('ConfirmationDialog', () => {
  it('names the action on its button, and Esc closes it', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        trigger={<Button>Delete campaign</Button>}
        title="Delete this campaign?"
        description="It can’t be undone."
        confirmLabel="Delete campaign"
        variant="destructive"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete campaign' }));
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.getByRole('dialog'));
    expect(within(dialog).getByRole('button', { name: 'Delete campaign' })).toBeVisible();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('skeletons', () => {
  it('appear after a delay unless asked to be immediate, and keep the table’s shape', () => {
    const { container } = render(
      <>
        <Skeleton data-testid="delayed" />
        <Skeleton data-testid="now" immediate />
        <table>
          <tbody>
            <SkeletonTableRow columns={5} />
          </tbody>
        </table>
      </>,
    );
    expect(screen.getByTestId('delayed')).toHaveClass('skeleton');
    expect(screen.getByTestId('now')).toHaveClass('animate-pulse');
    expect(container.querySelectorAll('td')).toHaveLength(5);
  });
});

describe('Banner', () => {
  it('remembers being dismissed', () => {
    const { unmount } = render(
      <Banner title="Scheduled maintenance tonight" storageKey="maintenance-test" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(screen.queryByText('Scheduled maintenance tonight')).toBeNull();
    unmount();

    render(<Banner title="Scheduled maintenance tonight" storageKey="maintenance-test" />);
    expect(screen.queryByText('Scheduled maintenance tonight')).toBeNull();
  });
});

describe('OfflineBanner', () => {
  it('says so when the connection drops, and briefly when it returns', () => {
    vi.useFakeTimers();
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).toBeNull();

    online.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline');

    online.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Back online');
    act(() => vi.advanceTimersByTime(3100));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('ErrorBoundary', () => {
  it('contains a failing section and lets it retry', () => {
    let fail = true;
    function Section() {
      if (fail) throw new Error('boom');
      return <p>Updates</p>;
    }
    render(
      <>
        <p>The rest of the page</p>
        <ErrorBoundary title="Updates didn’t load">
          <Section />
        </ErrorBoundary>
      </>,
    );
    expect(screen.getByText('The rest of the page')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Updates didn’t load');

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Updates')).toBeVisible();
  });
});

describe('useUnsavedChangesGuard', () => {
  function Form({ dirty }: { dirty: boolean }) {
    const guard = useUnsavedChangesGuard(dirty);
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the guard intercepts any same-site anchor; a plain one keeps the test free of the router */}
        <a href="/campaigns">Campaigns</a>
        {guard.dialog}
      </>
    );
  }

  it('asks before following a link away from unsaved edits, and leaves only if told to', async () => {
    render(<Form dirty />);
    fireEvent.click(screen.getByRole('link', { name: 'Campaigns' }));

    const dialog = await screen.findByRole('alertdialog').catch(() => screen.getByRole('dialog'));
    expect(dialog).toHaveTextContent('Leave without saving?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave page' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/campaigns'));
  });

  it('asks the browser to confirm closing the tab, only while there are unsaved edits', () => {
    const { rerender } = render(<Form dirty />);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    rerender(<Form dirty={false} />);
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
  });

  it('lets links through when nothing is unsaved', () => {
    render(<Form dirty={false} />);
    const link = screen.getByRole('link', { name: 'Campaigns' });
    let reachedLink = false;
    // jsdom cannot navigate; stop it at the link, after the guard has had its turn.
    link.addEventListener('click', (event) => {
      reachedLink = !event.defaultPrevented;
      event.preventDefault();
    });
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(reachedLink).toBe(true);
    expect(screen.queryByText('Leave without saving?')).toBeNull();
  });
});

void React;
