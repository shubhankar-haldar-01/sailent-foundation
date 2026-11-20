'use client';

import * as React from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import {
  Banner,
  Button,
  CampaignProgress,
  ConfirmationDialog,
  EmptyState,
  ErrorBoundary,
  ErrorState,
  FieldError,
  Input,
  Label,
  OfflineBanner,
  Progress,
  Skeleton,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonText,
  Spinner,
  StatusBadge,
  fieldErrorProps,
  toast,
} from '@sailent/ui';

import { useAsyncAction } from '@/lib/feedback/use-async-action';
import { useUnsavedChangesGuard } from '@/lib/feedback/use-unsaved-changes-guard';

import { TopProgressBar, doneProgress, startProgress } from './top-progress-bar';

/**
 * Every feedback and state building block, live, for review (Phase 1
 * checkpoint, 2026-11-19). Served at /dev/ui-states outside production only.
 */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-surface space-y-4 rounded-xl border p-5">
      <div>
        <h2 className="text-h4 font-semibold">{title}</h2>
        {note ? <p className="text-body-sm text-muted-foreground mt-1">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Thrower({ fail }: { fail: boolean }) {
  if (fail) throw new Error('A section failed to render (demo).');
  return <p className="text-body-sm">This section rendered normally.</p>;
}

export function UiStatesShowcase() {
  const [saving, setSaving] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [replay, setReplay] = React.useState(0);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [crash, setCrash] = React.useState(false);
  const [boundaryKey, setBoundaryKey] = React.useState(0);
  const [dirty, setDirty] = React.useState(false);
  const guard = useUnsavedChangesGuard(dirty);

  const succeed = useAsyncAction(async () => wait(1200), { success: 'Campaign saved' });
  const fail = useAsyncAction(
    async () => {
      await wait(1200);
      throw Object.assign(new Error('internal'), { code: 'INTERNAL_ERROR', status: 500 });
    },
    { errorTitle: 'Couldn’t save campaign' },
  );
  const exporting = useAsyncAction(async () => wait(2000), {
    loading: 'Preparing export…',
    success: 'Export ready',
    successDescription: 'Donations, 1 Apr – 19 Nov 2026',
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <TopProgressBar />
      <header>
        <p className="text-caption text-muted-foreground font-semibold uppercase tracking-wider">
          Development only
        </p>
        <h1 className="text-h2 font-bold">UI feedback and states</h1>
        <p className="text-body text-muted-foreground mt-1">
          The shared building blocks from Phase 1, before they are rolled out. Rules:
          docs/ui-feedback.md.
        </p>
      </header>

      <Panel
        title="Toasts"
        note="Bottom right on desktop, bottom centre on a phone. Success and info 4s, warning and undo 6s, errors stay. Hover or focus pauses; Esc or × closes; three at most."
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => toast.success('Campaign saved')}>
            Success
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              toast.error('Couldn’t save campaign', {
                description: 'We couldn’t reach our server. Try again in a moment.',
                action: { label: 'Try again', onClick: () => toast.success('Campaign saved') },
              })
            }
          >
            Error with Try again
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              toast.warning('Image is large', { description: 'It may load slowly on phones.' })
            }
          >
            Warning
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.info('Draft restored', { description: 'From 2 minutes ago.' })}
          >
            Info
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const id = toast.loading('Uploading photo…');
              setTimeout(
                () => toast.update(id, { type: 'success', title: 'Photo uploaded' }),
                1800,
              );
            }}
          >
            Loading → success
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.undo('Campaign archived', () => toast.info('Campaign restored'))}
          >
            Undo
          </Button>
          <Button size="sm" variant="secondary" onClick={() => toast.copied('Link copied')}>
            Copied pill
          </Button>
        </div>
      </Panel>

      <Panel
        title="Buttons and useAsyncAction"
        note="The label is kept (or replaced by the loading text), the width does not shrink, and a second click while loading does nothing."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button isLoading={saving} loadingText="Saving…" onClick={() => setSaving((on) => !on)}>
            Save settings
          </Button>
          <Button
            variant="secondary"
            isLoading={succeed.pending}
            loadingText="Saving…"
            onClick={() => void succeed.run()}
          >
            Save (succeeds)
          </Button>
          <Button
            variant="secondary"
            isLoading={fail.pending}
            loadingText="Saving…"
            onClick={() => void fail.run()}
          >
            Save (fails)
          </Button>
          <Button
            variant="subtle"
            isLoading={exporting.pending}
            loadingText="Exporting…"
            onClick={() => void exporting.run()}
          >
            Export donations
          </Button>
          <Button
            variant="secondary"
            isLoading={downloading}
            onClick={() => setDownloading((on) => !on)}
          >
            <Download aria-hidden="true" /> Download receipt
          </Button>
          <span className="text-body-sm text-muted-foreground inline-flex items-center gap-2">
            <Spinner /> The one spinner
          </span>
        </div>
      </Panel>

      <Panel
        title="Skeletons"
        note="They appear only after 300ms (press Replay and watch the gap), and hold their space so nothing shifts."
      >
        <Button size="sm" variant="secondary" onClick={() => setReplay((n) => n + 1)}>
          Replay
        </Button>
        <div key={replay} className="grid gap-4 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <SkeletonAvatar />
              <Skeleton className="h-4 w-32" />
            </div>
            <SkeletonText lines={4} />
          </div>
          <SkeletonCard />
          <table className="w-full">
            <tbody>
              <SkeletonTableRow columns={3} />
              <SkeletonTableRow columns={3} />
              <SkeletonTableRow columns={3} />
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Top progress bar"
        note="Shows during navigation; also driven by hand for a slow fetch."
      >
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={startProgress}>
            Start
          </Button>
          <Button size="sm" variant="secondary" onClick={doneProgress}>
            Done
          </Button>
        </div>
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Empty state">
          <EmptyState
            title="You haven’t donated yet"
            description="When you give to a campaign, it appears here with its receipt."
            action={
              <Button asChild size="sm">
                <Link href="/campaigns">Explore campaigns</Link>
              </Button>
            }
          />
          <EmptyState
            kind="no-results"
            title="No campaigns match"
            description="Try fewer filters."
            onClearFilters={() => toast.info('Filters cleared')}
          />
        </Panel>
        <Panel title="Error state (a section)">
          <ErrorState
            title="Updates didn’t load"
            description="The rest of the page is fine. Try again."
            requestId="b0ea52fe-af64-472c"
            onRetry={() => toast.info('Retrying…')}
          />
        </Panel>
      </div>

      <Panel
        title="Banners"
        note="For conditions that last. Dismissible ones are remembered in this browser."
      >
        <Banner tone="info" title="Scheduled maintenance tonight" storageKey="dev-demo-maintenance">
          Donations pause from 11:30 pm to midnight IST.
        </Banner>
        <Banner
          tone="warning"
          title="Add your PAN to your profile"
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard/profile">Add PAN</Link>
            </Button>
          }
        >
          We need it to report your donations for Form 10BE.
        </Banner>
        <Banner tone="error" title="This campaign is paused">
          Donations are closed for now.
        </Banner>
        <OfflineBanner preview="offline" className="rounded-xl" />
        <OfflineBanner preview="online" className="rounded-xl" />
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel
          title="Confirm dialog"
          note="Focus stays inside, Esc closes, the button names the action."
        >
          <ConfirmationDialog
            trigger={
              <Button variant="destructive" size="sm">
                Delete campaign
              </Button>
            }
            title="Delete “Educate Rural Children”?"
            description="This removes the campaign and its draft updates. It can’t be undone."
            confirmLabel="Delete campaign"
            variant="destructive"
            onConfirm={async () => {
              await wait(800);
              toast.success('Campaign deleted');
            }}
          />
        </Panel>
        <Panel
          title="Field error"
          note="Shown when you leave the field; linked to it for screen readers."
        >
          <div>
            <Label htmlFor="demo-email">Email</Label>
            <Input
              id="demo-email"
              type="email"
              onBlur={(event) =>
                setEmailError(
                  /^\S+@\S+\.\S+$/.test(event.currentTarget.value)
                    ? null
                    : 'Enter an email address like name@example.com',
                )
              }
              {...fieldErrorProps('demo-email', emailError)}
            />
            <FieldError fieldId="demo-email" error={emailError} />
          </div>
        </Panel>
      </div>

      <Panel title="Status badges">
        <div className="flex flex-wrap gap-2">
          {(['draft', 'active', 'paused', 'completed', 'archived'] as const).map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['pending', 'processing', 'successful', 'failed', 'cancelled'] as const).map(
            (status) => (
              <StatusBadge key={status} status={status} />
            ),
          )}
        </div>
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Progress">
          <CampaignProgress raised={6_250_000} goal={10_000_000} donorCount={48} daysLeft={12} />
          <Progress value={42} label="Uploading photo, 42%" />
        </Panel>
        <Panel title="Error boundary (a section)">
          <Button size="sm" variant="secondary" onClick={() => setCrash(true)}>
            Break this section
          </Button>
          <ErrorBoundary key={boundaryKey}>
            <Thrower fail={crash} />
          </ErrorBoundary>
          {crash ? (
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                setCrash(false);
                setBoundaryKey((n) => n + 1);
              }}
            >
              Reset demo
            </Button>
          ) : null}
        </Panel>
      </div>

      <Panel
        title="Unsaved-changes guard"
        note="Type something, then follow the link: you are asked first. Reloading the tab gets the browser's prompt."
      >
        <textarea
          aria-label="Draft text"
          className="border-input bg-surface text-body-sm w-full rounded-md border px-3 py-2"
          rows={3}
          onChange={(event) => setDirty(event.currentTarget.value.length > 0)}
        />
        <Link href="/" className="text-info-action text-body-sm font-semibold underline">
          Go to the home page
        </Link>
        {guard.dialog}
      </Panel>
    </div>
  );
}
