import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, CampaignProgress, EmptyState, ImpactStat, StatusBadge } from '@sailent/ui';

describe('Button', () => {
  it('renders a real button element, not a div', () => {
    // Guards the "no divs as buttons" rule from the accessibility foundation.
    render(<Button>Donate</Button>);
    expect(screen.getByRole('button', { name: 'Donate' })).toBeInTheDocument();
  });

  it('keeps its label visible while loading and marks itself busy', () => {
    render(<Button isLoading>Donate</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Donate');
  });

  it('keeps orange for Donate only: `action` is the orange, the default is the brand', () => {
    // Colour roles, owner 2026-11-21 (AGENTS.md §11 item 12).
    const { rerender } = render(<Button>Save</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary');
    expect(screen.getByRole('button')).not.toHaveClass('bg-action');
    rerender(<Button variant="action">Donate</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-action', 'text-action-foreground');
    expect(screen.getByRole('button')).not.toHaveClass('bg-primary');
  });

  it('renders all standardized variants correctly', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary', 'text-primary-foreground');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('border-primary/60', 'text-primary');

    // The quiet outline for Login, Cancel, Back (visual polish Phase 3).
    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('border-border-strong', 'text-foreground');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-transparent');

    rerender(<Button variant="dark">Dark</Button>);
    expect(screen.getByRole('button')).toHaveClass(
      'bg-surface-inverse',
      'text-surface-inverse-foreground',
    );

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-destructive', 'text-destructive-foreground');

    // The old trust-blue variant is now the brand (2026-11-21).
    rerender(<Button variant="info">Info</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('renders 8px-cornered sizes: sm 36px, md 44px, lg 48px (owner, 2026-11-21)', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-9', 'rounded-lg');
    // A small button still gives a 44px hit area on a touch screen.
    expect(screen.getByRole('button').className).toContain('pointer-coarse:touch-target');

    rerender(<Button size="md">Medium</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-11', 'rounded-lg');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-12', 'rounded-lg');

    // `xl` is kept as an alias of `lg`, so old call sites keep working.
    rerender(<Button size="xl">Extra Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-12', 'rounded-lg');
    expect(screen.getByRole('button')).not.toHaveClass('rounded-full');
  });

  it('presses to 0.98 and has no pill shape at any variant', () => {
    for (const variant of ['primary', 'action', 'secondary', 'outline', 'ghost'] as const) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('active:scale-[0.98]');
      expect(button).not.toHaveClass('rounded-full');
      unmount();
    }
  });
});

describe('ImpactStat — decision A14', () => {
  const source = { kind: 'aggregate', description: 'Test aggregate' } as const;

  it('renders nothing when the value is zero', () => {
    // A new campaign shows its story, not "0 donors".
    const { container } = render(<ImpactStat label="Donors" value={0} source={source} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the value is unavailable', () => {
    const { container } = render(<ImpactStat label="Donors" value={null} source={source} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a real value with Indian digit grouping', () => {
    render(<ImpactStat label="Donors" value={420000} source={source} />);
    expect(screen.getByText('4,20,000')).toBeInTheDocument();
  });
});

describe('CampaignProgress', () => {
  it('shows both absolute figures, not just a percentage', () => {
    render(<CampaignProgress raised={42_000_000} goal={100_000_000} />);
    expect(screen.getByText('₹4,20,000')).toBeInTheDocument();
    expect(screen.getByText(/of ₹10,00,000/)).toBeInTheDocument();
  });

  it('suppresses a discouragingly small supporter count', () => {
    render(<CampaignProgress raised={1000} goal={100_000} donorCount={3} />);
    expect(screen.queryByText(/3 supporters/)).not.toBeInTheDocument();
  });

  it('shows the supporter count once it is meaningful', () => {
    render(<CampaignProgress raised={1000} goal={100_000} donorCount={12} />);
    expect(screen.getByText('12 supporters')).toBeInTheDocument();
  });

  it('reports a true over-subscribed value to assistive tech', () => {
    // The bar fill is capped so it cannot overflow, but the number is honest.
    render(<CampaignProgress raised={150_000} goal={100_000} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '150');
  });
});

describe('StatusBadge', () => {
  it('pairs colour with a text label so meaning never rests on colour alone', () => {
    render(<StatusBadge status="paused" />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('distinguishes "no results" from "nothing yet" by offering to clear filters', () => {
    const onClear = vi.fn();
    render(<EmptyState kind="no-results" title="No matches" onClearFilters={onClear} />);
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('offers no filter control when there is simply no content yet', () => {
    render(<EmptyState kind="no-content" title="Nothing yet" />);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});
