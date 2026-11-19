import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FormStatus } from '@/components/admin/form-shell';
import type { ActionState } from '@/lib/admin/actions';

/*
  The owner's rule (2026-11-19): after saving anything, the page goes to the
  message. These pin the shared mechanism that every save-result message on
  the site uses.
*/

const scrollIntoView = vi.fn();
let rect = { top: 0, bottom: 0 };

beforeEach(() => {
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ ...rect, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 }) as DOMRect,
  );
  rect = { top: 2000, bottom: 2060 }; // below the fold by default
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A page that has not been touched yet gets a fresh module, so the "interacted" flag starts false. */
async function freshModule() {
  vi.resetModules();
  return import('../reveal-result');
}

function Harness({
  useReveal,
  result,
}: {
  useReveal: (value: unknown) => React.RefObject<HTMLDivElement | null>;
  result: string | null;
}) {
  const ref = useReveal(result);
  return result ? (
    <div ref={ref} role="status">
      {result}
    </div>
  ) : null;
}

describe('useRevealResult', () => {
  it('leaves a message alone when the page has only just loaded', async () => {
    const { useRevealResult } = await freshModule();

    render(<Harness useReveal={useRevealResult} result="Saved." />);

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it('scrolls a new result into view and puts focus on it, after the person has acted', async () => {
    const { useRevealResult } = await freshModule();
    const { rerender } = render(<Harness useReveal={useRevealResult} result={null} />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown'));
    });
    rerender(<Harness useReveal={useRevealResult} result="Saved." />);

    const message = screen.getByRole('status');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(document.activeElement).toBe(message);
    // Focusable by script, not a stop on the Tab order.
    expect(message).toHaveAttribute('tabindex', '-1');
  });

  it('does not scroll when the message is already fully in view, but still focuses it', async () => {
    const { useRevealResult, markInteractedForTests } = await freshModule();
    markInteractedForTests();
    rect = { top: 200, bottom: 260 };

    render(<Harness useReveal={useRevealResult} result="Saved." />);

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('status'));
  });

  it('jumps instead of gliding for someone who asked for reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    const { useRevealResult, markInteractedForTests } = await freshModule();
    markInteractedForTests();

    render(<Harness useReveal={useRevealResult} result="Saved." />);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
  });
});

describe('FormStatus (every admin form)', () => {
  it('reveals "Saved." and an error after each save, even when the result repeats', () => {
    // A real keypress, which the copy of the module FormStatus uses is listening for.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown'));
    });
    const { rerender } = render(<FormStatus state={{}} />);

    rerender(<FormStatus state={{ ok: true } as ActionState} />);
    expect(document.activeElement).toBe(screen.getByRole('status'));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // Saving again gives a new state object with the same message: revealed again.
    (document.activeElement as HTMLElement).blur();
    rerender(<FormStatus state={{ ok: true } as ActionState} />);
    expect(document.activeElement).toBe(screen.getByRole('status'));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);

    rerender(<FormStatus state={{ error: 'Could not save.' } as ActionState} />);
    expect(document.activeElement).toBe(screen.getByRole('alert'));
  });
});
