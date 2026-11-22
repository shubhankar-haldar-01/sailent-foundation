import { render, screen, within } from '@testing-library/react';
import { CalendarDays } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { HeroStat, InteriorHero } from '../interior-hero';

const breadcrumbs = [
  { name: 'Home', path: '/' },
  { name: 'About us', path: '/about' },
];
const image = { src: '/images/about-hero-photo.webp', alt: 'A coordinator greeting an elder' };

describe('InteriorHero', () => {
  it('puts the page title in a real, visible h1 — not inside the picture', () => {
    render(
      <InteriorHero
        variant="split"
        id="about-title"
        breadcrumbs={breadcrumbs}
        eyebrow="About us"
        title="Real people. Lasting change."
        lead="We work with communities."
        image={image}
      />,
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Real people. Lasting change.' });
    expect(heading).toHaveAttribute('id', 'about-title');
    // Visible: no screen-reader-only wrapper around it (the old banners hid it).
    expect(heading.closest('.sr-only')).toBeNull();
    expect(
      screen.getByRole('region', { name: 'Real people. Lasting change.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('We work with communities.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: image.alt })).toBeInTheDocument();
  });

  it('shows a visible breadcrumb back to Home', () => {
    render(<InteriorHero variant="compact" id="t" breadcrumbs={breadcrumbs} title="About us" />);
    const trail = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(within(trail).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('lists facts only as given — it never invents one', () => {
    const { rerender } = render(
      <InteriorHero
        variant="split"
        id="t"
        breadcrumbs={breadcrumbs}
        title="About us"
        image={image}
        facts={['12A registered', '80G registered']}
      />,
    );
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      expect.arrayContaining(['12A registered', '80G registered']),
    );

    rerender(
      <InteriorHero
        variant="split"
        id="t"
        breadcrumbs={breadcrumbs}
        title="About us"
        image={image}
      />,
    );
    expect(screen.queryByText(/registered/)).not.toBeInTheDocument();
  });

  it('draws no photograph in the compact hero, and shows its aside and footer', () => {
    render(
      <InteriorHero
        variant="compact"
        id="events-title"
        breadcrumbs={breadcrumbs}
        title="Events"
        aside={<p>aside slot</p>}
        footer={<p>footer slot</p>}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('aside slot')).toBeInTheDocument();
    expect(screen.getByText('footer slot')).toBeInTheDocument();
  });

  it('keeps the overlay hero’s photograph and heading', () => {
    render(
      <InteriorHero
        variant="overlay"
        id="programs-title"
        breadcrumbs={breadcrumbs}
        title="Long-term work, lasting impact"
        image={image}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Long-term work, lasting impact' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: image.alt })).toBeInTheDocument();
  });
});

describe('InteriorHero — editorial', () => {
  it('reveals the heading word by word, yet it reads as one heading', () => {
    const { container } = render(
      <InteriorHero
        variant="editorial"
        id="team-title"
        breadcrumbs={breadcrumbs}
        eyebrow="Our people"
        title="The people behind every possibility."
        lead="Meet the people."
        aside={<p>aside slot</p>}
      />,
    );

    // One h1 whose accessible name is the whole sentence, spaces and all.
    expect(
      screen.getByRole('heading', { level: 1, name: 'The people behind every possibility.' }),
    ).toBeInTheDocument();
    // Each word moves on its own (the site's CSS entrance, staggered).
    const words = container.querySelectorAll('h1 .rise-in');
    expect(words).toHaveLength(5);
    const delays = Array.from(words).map((word) =>
      (word as HTMLElement).style.getPropertyValue('--rise-delay'),
    );
    expect(new Set(delays).size).toBe(5);

    expect(screen.getByText('Our people')).toBeInTheDocument();
    expect(screen.getByText('aside slot')).toBeInTheDocument();
    // Typography-led: no photograph.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('HeroStat', () => {
  it('shows the count and what it counts', () => {
    render(<HeroStat value={3} label="upcoming events" icon={CalendarDays} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('upcoming events')).toBeInTheDocument();
  });
});
