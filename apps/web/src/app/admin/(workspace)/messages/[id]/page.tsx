import { notFound } from 'next/navigation';
import { Mail, Clock, CheckCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

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
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="text-body-sm text-destructive p-4">
          {error instanceof AdminApiError ? error.message : 'Could not load the message.'}
        </CardContent>
      </Card>
    );
  }

  const subjectLabel = CONTACT_SUBJECT_LABELS[message.subject as ContactSubject] ?? message.subject;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={subjectLabel}
        description={`Inquiry from ${message.name} · Submitted ${new Date(
          message.createdAt,
        ).toLocaleString('en-IN')}`}
        status={<StatusPill status={message.status} />}
      />

      <Card>
        <CardHeader className="border-border/60 border-b pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="text-primary size-4" />
                {message.name}
              </CardTitle>
              <CardDescription className="mt-0.5">
                <a
                  href={`mailto:${message.email}`}
                  className="text-primary font-medium hover:underline"
                >
                  {message.email}
                </a>
              </CardDescription>
            </div>
            <div className="text-caption text-muted-foreground flex items-center gap-2 font-mono">
              <Clock className="size-3.5" />
              {new Date(message.createdAt).toLocaleString('en-IN')}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="bg-muted/30 text-body border-border/60 whitespace-pre-wrap break-words rounded-lg border p-5 font-sans leading-relaxed">
            {message.message}
          </div>

          {message.handledAt ? (
            <div className="text-body-sm text-success mt-4 flex items-center gap-2 font-medium">
              <CheckCircle className="size-4" />
              Marked handled on {new Date(message.handledAt).toLocaleString('en-IN')}.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {can(actor, 'contact.manage') ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inquiry Status Controls</CardTitle>
            <CardDescription>
              Mark message as handled or archive the inquiry record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContactMessageActions id={message.id} status={message.status} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
