'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  Heart,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  CampaignProgress,
  Card,
  FieldError,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  fieldErrorProps,
} from '@sailent/ui';

import { CampaignCard } from '@/components/campaigns/campaign-card';
import { campaigns } from '@/lib/mock/campaigns';

/**
 * Every shared component in every state, light and dark side by side (visual
 * polish Phase 3, 2026-11-21). Served at /dev/ui-states outside production.
 *
 * Hover and press are live (point at them). Focus is shown both live (Tab to
 * it) and forced on one sample per kind, since a screenshot cannot hover.
 */

const FORCED_FOCUS = 'outline outline-2 outline-offset-2 outline-ring';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-caption text-muted-foreground font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-h4 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Gallery({ id }: { id: string }) {
  const [chip, setChip] = React.useState(1000);
  const sample = campaigns[0]!;
  const closed = { ...sample, id: `${sample.id}-closed`, status: 'completed' as const };

  return (
    <div className="space-y-10">
      <Block title="Buttons">
        <Row label="Variants (md)">
          <Button variant="action">Donate ₹1,000</Button>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
          <Button variant="link">Link</Button>
        </Row>
        <Row label="Sizes: sm 36px · md 44px · lg 48px · icon 44px">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" variant="outline" aria-label="Add">
            <Plus aria-hidden="true" />
          </Button>
        </Row>
        <Row label="States: focus (forced) · disabled · loading · with icons">
          <Button className={FORCED_FOCUS}>Focused</Button>
          <Button disabled>Disabled</Button>
          <Button variant="action" disabled>
            Donate
          </Button>
          <Button isLoading loadingText="Saving…">
            Save
          </Button>
          <Button variant="secondary">
            Read more
            <ArrowRight aria-hidden="true" />
          </Button>
        </Row>
      </Block>

      <Block title="Form fields">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`}>Full name</Label>
            <Input id={`${id}-name`} placeholder="As on your receipt" />
            <p className="text-caption text-muted-foreground">Default, with helper text.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-focus`}>Focused (forced)</Label>
            <Input
              id={`${id}-focus`}
              defaultValue="Asha Verma"
              className="border-primary outline-primary outline outline-2 outline-offset-0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-email`}>Email</Label>
            <Input
              id={`${id}-email`}
              defaultValue="asha@"
              hasError
              {...fieldErrorProps(`${id}-email`, 'Enter a full email address.')}
            />
            <FieldError fieldId={`${id}-email`} error="Enter a full email address." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-pan`}>PAN</Label>
            <Input id={`${id}-pan`} defaultValue="ABCDE1234F" isValid />
            <p className="text-caption text-success flex items-center gap-1">
              <CircleCheck className="size-3.5" aria-hidden="true" /> Looks right.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-amount`}>Other amount</Label>
            <Input id={`${id}-amount`} prefix="₹" inputMode="numeric" placeholder="Enter amount" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-disabled`}>Disabled</Label>
            <Input id={`${id}-disabled`} defaultValue="Locked" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-select`}>Select</Label>
            <Select defaultValue="education">
              <SelectTrigger id={`${id}-select`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-message`}>Message</Label>
            <Textarea id={`${id}-message`} placeholder="Write to us" rows={2} />
          </div>
        </div>
      </Block>

      <Block title="Amount chips (selected is not success)">
        <div role="group" aria-label="Amount" className="flex flex-wrap gap-1.5">
          {[500, 1000, 2500, 5000].map((rupees) => {
            const pressed = chip === rupees;
            return (
              <button
                key={rupees}
                type="button"
                aria-pressed={pressed}
                onClick={() => setChip(rupees)}
                className={
                  'text-caption duration-(--duration-fast) inline-flex h-9 min-w-[68px] items-center justify-center gap-1 rounded-lg border px-3 font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ' +
                  (pressed
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border bg-surface hover:border-border-strong')
                }
              >
                {pressed ? <Check className="size-3.5" aria-hidden="true" /> : null}₹
                {rupees.toLocaleString('en-IN')}
              </button>
            );
          })}
        </div>
        <p className="text-caption text-muted-foreground">
          Mirrors the donation card&apos;s chips; review the real ones on a campaign page.
        </p>
      </Block>

      <Block title="Badges (24px pills)">
        <Row label="Variants">
          <Badge>Neutral</Badge>
          <Badge variant="brand">Education</Badge>
          <Badge variant="success">
            <CircleCheck aria-hidden="true" /> Paid
          </Badge>
          <Badge variant="warning">
            <Clock aria-hidden="true" /> Pending
          </Badge>
          <Badge variant="destructive">
            <CircleAlert aria-hidden="true" /> Failed
          </Badge>
          <Badge variant="info">
            <Info aria-hidden="true" /> Note
          </Badge>
          <Badge variant="outline">Outline</Badge>
        </Row>
      </Block>

      <Block title="Progress">
        <CampaignProgress raised={45025000} goal={100000000} donorCount={321} daysLeft={12} />
        <Progress value={100} tone="success" label="Goal reached" />
      </Block>

      <Block title="Tabs">
        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="faqs">FAQs</TabsTrigger>
            <TabsTrigger value="off" disabled>
              Disabled
            </TabsTrigger>
          </TabsList>
          <TabsContent value="products" className="text-body-sm text-muted-foreground">
            Arrow keys move between tabs.
          </TabsContent>
          <TabsContent value="about" className="text-body-sm text-muted-foreground">
            About.
          </TabsContent>
          <TabsContent value="faqs" className="text-body-sm text-muted-foreground">
            FAQs.
          </TabsContent>
        </Tabs>
      </Block>

      <Block title="Accordion: the FAQ list (one card, divided rows)">
        <Accordion type="single" collapsible variant="list" defaultValue="a">
          <AccordionItem value="a">
            <AccordionTrigger className="font-semibold">
              Do I get a tax benefit on my donation?
            </AccordionTrigger>
            <AccordionContent>
              Relief is claimed through Form 10BE, issued after our annual Form 10BD filing.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger className="font-semibold">
              Besides donating, how else can I help?
            </AccordionTrigger>
            <AccordionContent>Volunteer with us, or share a campaign.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </Block>

      <Block title="Cards (border-first; only clickable cards lift)">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="font-semibold">Standard</p>
            <p className="text-body-sm text-muted-foreground">Hairline, no shadow.</p>
          </Card>
          <Link href="#gallery" className="block rounded-2xl focus-visible:outline-2">
            <Card interactive className="p-4">
              <p className="font-semibold">Interactive</p>
              <p className="text-body-sm text-muted-foreground">Lifts on hover.</p>
            </Card>
          </Link>
          <Card variant="featured" className="p-4">
            <p className="flex items-center gap-1 font-semibold">
              <Heart className="text-primary size-4" aria-hidden="true" /> Featured
            </p>
            <p className="text-body-sm text-muted-foreground">A stronger border.</p>
          </Card>
        </div>
      </Block>

      <Block title="Campaign card (open and completed)">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampaignCard campaign={sample} />
          <CampaignCard campaign={closed} showStatus />
        </div>
      </Block>
    </div>
  );
}

/** The gallery twice: the page's theme, then forced dark. */
export function ComponentGallery() {
  return (
    <section id="gallery" aria-labelledby="gallery-title" className="space-y-4">
      <div>
        <h2 id="gallery-title" className="text-h2 font-semibold">
          Components (visual polish Phase 3)
        </h2>
        <p className="text-body-sm text-muted-foreground mt-1">
          Every shared component and its states. Left: light. Right: dark.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="bg-background border-border min-w-0 rounded-2xl border p-5 sm:p-6">
          <Gallery id="light" />
        </div>
        <div className="bg-background text-foreground border-border dark min-w-0 rounded-2xl border p-5 sm:p-6">
          <Gallery id="dark" />
        </div>
      </div>
    </section>
  );
}
