import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { SpotlightSection, type SpotlightItem } from '../spotlight-section';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  window.HTMLElement.prototype.scrollBy = function () {};
  window.HTMLElement.prototype.scrollTo = function () {};
});

describe('SpotlightSection', () => {
  it('renders section header, eyebrow accent, and supporting text', () => {
    render(<SpotlightSection />);

    // Heading "In The Spotlight"
    const heading = screen.getByRole('heading', { level: 2, name: /In The Spotlight/i });
    expect(heading).toBeInTheDocument();

    // Supporting copy
    expect(screen.getByText('Our work and impact across the media')).toBeInTheDocument();
  });

  it('renders the publication logos matching the visual reference', () => {
    render(<SpotlightSection />);

    expect(screen.getAllByText('COMMUNITY').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('POST').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Impact').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Journal').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('TODAY').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('INDIA').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Daily').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Voice').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Changemakers').length).toBeGreaterThanOrEqual(1);
  });

  it('renders accessible pause and resume animation controls', () => {
    render(<SpotlightSection />);

    const pauseBtn = screen.getByRole('button', {
      name: /pause publication showcase animation/i,
    });
    expect(pauseBtn).toBeInTheDocument();

    fireEvent.click(pauseBtn);
    expect(
      screen.getByRole('button', { name: /resume publication showcase animation/i }),
    ).toBeInTheDocument();
  });

  it('renders continuous marquee tracks for seamless looping', () => {
    const { container } = render(<SpotlightSection />);

    const tracks = container.querySelectorAll('.spotlight-continuous-track');
    expect(tracks).toHaveLength(2);
    expect(tracks[1]).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders custom publication items when provided', () => {
    const customPubs: SpotlightItem[] = [
      { id: 'hindustan-times', name: 'Hindustan Times' },
      { id: 'the-hindu', name: 'The Hindu' },
    ];

    render(<SpotlightSection publications={customPubs} />);

    expect(screen.getAllByText('Hindustan Times').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('The Hindu').length).toBeGreaterThanOrEqual(1);
  });
});
