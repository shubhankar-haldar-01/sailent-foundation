import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CONTACT_SUBJECT_LABELS, type ContactSubject } from '@sailent/validation';

import { ContactMessageActions } from '@/components/admin/contact-message-actions';
import { StatusPill } from '@/components/admin/status-pill';
import { AdminApiError, getContactMessage } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** One contact message, in full (Phase 13). */
export default async function AdminMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let message;
  try {
    message = await getContactMessage(id);
  } catch (error) {
    if (error instanceof AdminApiError && (error.status === 404 || error.status === 422))
      notFound();
    return (
      <p
        role="alert"
        className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
      >
        {error instanceof AdminApiError ? error.message : 'Could not load the message.'}
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-body-sm text-muted-foreground">
        <Link href="/admin/messages" className="hover:text-foreground">
          Messages
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{message.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">
            {CONTACT_SUBJECT_LABELS[message.subject as ContactSubject] ?? message.subject}
          </h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            From {message.name} &lt;
            <a href={`mailto:${message.email}`} className="text-primary underline">
              {message.email}
            </a>
            &gt; · {new Date(message.createdAt).toLocaleString('en-IN')}
          </p>
        </div>
        <StatusPill status={message.status} />
      </header>

      <div className="border-border bg-surface text-body whitespace-pre-wrap break-words rounded-lg border p-5">
        {message.message}
      </div>

      {message.handledAt ? (
        <p className="text-body-sm text-muted-foreground">
          Handled {new Date(message.handledAt).toLocaleString('en-IN')}.
        </p>
      ) : null}

      {can(actor, 'contact.manage') ? (
        <ContactMessageActions id={message.id} status={message.status} />
      ) : null}
    </div>
  );
}
