import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Input } from '@sailent/ui';

import { CampaignCard } from '@/components/campaigns/campaign-card';
import { campaigns } from '@/lib/mock/campaigns';

/*
  Visual polish Phase 3 (owner, 2026-11-21): the shared components' new
  states and shapes.
*/

describe('Input', () => {
  it('draws a fixed prefix inside the field, hidden from assistive tech', () => {
    render(<Input aria-label="Other amount" prefix="₹" />);
    const field = screen.getByRole('textbox', { name: 'Other amount' });
    expect(field).toHaveClass('pl-8');
    const prefix = screen.getByText('₹');
    expect(prefix).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the error state with aria-invalid and a red ring, and the valid state in teal', () => {
    const { rerender } = render(<Input aria-label="Email" hasError />);
    const field = screen.getByRole('textbox', { name: 'Email' });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.className).toContain('focus-visible:outline-destructive');

    rerender(<Input aria-label="Email" isValid />);
    const valid = screen.getByRole('textbox', { name: 'Email' });
    expect(valid).not.toHaveAttribute('aria-invalid');
    expect(valid).toHaveClass('border-success');
  });

  it('an error outranks valid: no teal, no check mark', () => {
    const { container } = render(<Input aria-label="PAN" hasError isValid />);
    expect(screen.getByRole('textbox', { name: 'PAN' })).not.toHaveClass('border-success');
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('Accordion list variant', () => {
  it('puts every question in ONE card with divided rows, not a box each', () => {
    const { container } = render(
      <Accordion type="single" collapsible variant="list">
        <AccordionItem value="a">
          <AccordionTrigger>One?</AccordionTrigger>
          <AccordionContent>Yes.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Two?</AccordionTrigger>
          <AccordionContent>Yes.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute('data-variant', 'list');
    expect(root).toHaveClass('rounded-xl', 'border', 'divide-y');
    expect(container.querySelectorAll('[data-accordion-item]')).toHaveLength(2);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});

describe('Campaign card (simplified, AGENTS.md §11 item 2)', () => {
  const campaign = campaigns[0]!;

  it('keeps its figures, the labelled bar and one way to give — not in orange', () => {
    render(<CampaignCard campaign={campaign} />);
    expect(screen.getAllByRole('term')).toHaveLength(3);
    for (const term of ['Raised', 'Goal', 'Donors']) {
      expect(screen.getByText(term, { selector: 'dt' })).toBeInTheDocument();
    }
    expect(screen.getByRole('img', { name: /% of the ₹[\d,]+ goal raised/ })).toBeInTheDocument();
    const donate = screen.getByRole('link', { name: /Donate now/ });
    expect(donate).toHaveAttribute('href', `/campaigns/${campaign.slug}#give`);
    expect(donate).not.toHaveClass('bg-action');
  });

  it('shows one programme tag and no coloured icon discs', () => {
    const { container } = render(<CampaignCard campaign={campaign} />);
    expect(screen.getAllByText(campaign.category!)).toHaveLength(1);
    expect(container.querySelector('[class*="bg-wash-"]')).toBeNull();
  });
});
