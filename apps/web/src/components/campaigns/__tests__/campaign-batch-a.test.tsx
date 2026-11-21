import { act, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CampaignAbout } from '../campaign-about';
import { cleanStory, cleanSupportProvides, isPlaceholderText } from '../campaign-copy';
import { MobileDonateBar } from '@/components/donations/mobile-donate-bar';
import { campaigns } from '@/lib/mock/campaigns';
import type { Campaign } from '@/lib/mock/types';

/*
  Visual polish Phase 4, batch A (2026-11-21): the campaign page.
*/

describe('placeholder and duplicate campaign text', () => {
  it('treats empty text and the admin form labels as placeholders', () => {
    expect(isPlaceholderText('')).toBe(true);
    expect(isPlaceholderText('  Why This Campaign? (The Story) ')).toBe(true);
    expect(isPlaceholderText('What Will Your Support Provide?')).toBe(true);
    expect(isPlaceholderText('Children walk 6 km to school.')).toBe(false);
  });

  it('drops the "mountain" case: the label as the story and as what support provides', () => {
    const story = cleanStory(['Why This Campaign? (The Story)']);
    expect(story).toEqual([]);
    expect(cleanSupportProvides('Why This Campaign? (The Story)', story)).toBeNull();
  });

  it('drops what support provides when it only repeats the story, and keeps real text', () => {
    const story = ['First paragraph.', 'Second paragraph.'];
    expect(cleanSupportProvides('First paragraph. Second paragraph.', story)).toBeNull();
    expect(cleanSupportProvides('second   PARAGRAPH.', story)).toBeNull();
    expect(cleanSupportProvides('  Kits for 500 children.  ', story)).toBe(
      'Kits for 500 children.',
    );
  });
});

describe('the goal block', () => {
  const base = campaigns[0]!;
  const build = (overrides: Partial<Campaign>) =>
    render(<CampaignAbout campaign={{ ...base, ...overrides }} />);

  it('states goal, raised, donors and people helped with a labelled bar', () => {
    build({});
    const block = screen.getByRole('article', { name: 'Our goal' });
    for (const term of ['Goal', 'Raised', 'Donors']) {
      expect(block).toHaveTextContent(term);
    }
    expect(block).toHaveTextContent(/People helped/);
    expect(screen.getByRole('img', { name: /% of the ₹[\d,]+ goal raised/ })).toBeInTheDocument();
  });

  it('shows no figure the record does not hold (A14)', () => {
    build({ donorCount: 0, beneficiariesReached: 0 });
    const block = screen.getByRole('article', { name: 'Our goal' });
    expect(block).not.toHaveTextContent('Donors');
    expect(block).not.toHaveTextContent('People helped');
  });

  it('is one block: no separate "Your impact" card', () => {
    build({});
    expect(screen.queryByRole('article', { name: 'Your impact' })).toBeNull();
    expect(screen.queryByRole('article', { name: 'Your impact' })).toBeNull();
  });
});

describe('the phone Donate bar', () => {
  let callback: IntersectionObserverCallback = () => {};
  afterEach(() => vi.unstubAllGlobals());

  function setup(total = 50000) {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    window.matchMedia = globalThis.matchMedia;
    window.scrollTo = vi.fn();
    function Harness() {
      const card = React.useRef<HTMLDivElement>(null);
      return (
        <>
          <div ref={card} tabIndex={-1} data-testid="card" />
          <MobileDonateBar target={card} total={total} />
        </>
      );
    }
    return render(<Harness />);
  }

  const visible = (on: boolean) =>
    act(() =>
      callback([{ isIntersecting: on } as IntersectionObserverEntry], {} as IntersectionObserver),
    );

  it('stays hidden while any of the card is on screen, and appears when it is not', () => {
    setup();
    const bar = screen.getByTestId('mobile-donate-bar');
    expect(bar).not.toBeVisible();
    visible(false);
    expect(bar).toBeVisible();
    visible(true);
    expect(bar).not.toBeVisible();
  });

  it('names the total in the action orange and brings the card back with focus', () => {
    setup(50000);
    visible(false);
    const button = screen.getByRole('button', { name: 'Go to the donation card: Donate ₹500' });
    expect(button).toHaveClass('bg-action');
    fireEvent.click(button);
    expect(window.scrollTo).toHaveBeenCalled();
    expect(screen.getByTestId('card')).toHaveFocus();
  });
});
