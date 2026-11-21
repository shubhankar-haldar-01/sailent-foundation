import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, Button, CampaignProgress, Input } from '@sailent/ui';

import { CampaignCard } from '@/components/campaigns/campaign-card';
import { campaigns } from '@/lib/mock/campaigns';

/*
  Snapshot tests for the key components (visual polish Phase 5, 2026-11-21).

  The markup and classes of each component, in each variant and state, are
  recorded in __snapshots__/. A change to how one LOOKS — a colour role, a
  radius, a size — changes the snapshot, so it shows up in review instead of
  slipping through. Update deliberately with `vitest -u`, never to get green.
*/

describe('Button', () => {
  const variants = [
    'action',
    'primary',
    'secondary',
    'outline',
    'ghost',
    'destructive',
    'link',
  ] as const;
  it.each(variants)('variant %s', (variant) => {
    const { container } = render(<Button variant={variant}>Label</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it.each(['sm', 'md', 'lg', 'icon'] as const)('size %s', (size) => {
    const { container } = render(
      <Button size={size} aria-label="Label">
        Label
      </Button>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('disabled and loading', () => {
    const { container } = render(
      <>
        <Button disabled>Disabled</Button>
        <Button isLoading loadingText="Saving…">
          Save
        </Button>
      </>,
    );
    expect(container).toMatchSnapshot();
  });
});

describe('Badge', () => {
  it.each(['neutral', 'brand', 'success', 'warning', 'destructive', 'info', 'outline'] as const)(
    'variant %s',
    (variant) => {
      const { container } = render(<Badge variant={variant}>Tag</Badge>);
      expect(container.firstChild).toMatchSnapshot();
    },
  );
});

describe('Input', () => {
  it('default, error, valid, prefixed and disabled', () => {
    const { container } = render(
      <>
        <Input aria-label="Default" />
        <Input aria-label="Error" hasError />
        <Input aria-label="Valid" isValid />
        <Input aria-label="Amount" prefix="₹" />
        <Input aria-label="Disabled" disabled />
      </>,
    );
    expect(container).toMatchSnapshot();
  });
});

describe('Campaign figures', () => {
  it('CampaignProgress', () => {
    const { container } = render(
      <CampaignProgress raised={45025000} goal={100000000} donorCount={321} daysLeft={12} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('CampaignCard (open)', () => {
    const { container } = render(<CampaignCard campaign={campaigns[0]!} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
