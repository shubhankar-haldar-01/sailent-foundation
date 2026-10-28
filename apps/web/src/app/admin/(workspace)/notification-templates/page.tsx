import Link from 'next/link';
import { MailCheck } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sailent/ui';

import { ActivePill } from '@/components/admin/notification-panels';
import { AdminApiError, listNotificationTemplates } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

/**
 * Email templates.
 *
 * Every transactional email the platform sends has a row here (§4.21), and
 * every row is editable without a deployment. An inactive template is not a
 * broken one — the processor falls back to its built-in wording, so turning
 * one off changes the words, never whether the email arrives.
 */
export default async function AdminTemplatesPage() {
  let items;
  try {
    ({ items } = await listNotificationTemplates());
  } catch (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="text-body-sm text-destructive p-4">
          {error instanceof AdminApiError ? error.message : 'Could not load the templates.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Notification Templates"
        description="Transactional email copy for receipts, event confirmations, volunteer updates, and auth notices. Modifying a template versions it dynamically."
        count={items.length}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MailCheck className="text-primary size-4" />
            Configured Templates
          </CardTitle>
          <CardDescription>
            {items.length} transactional templates registered in processor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-border/70 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Template Name & Slug</TableHead>
                  <TableHead className="font-semibold">Default Subject Line</TableHead>
                  <TableHead className="font-semibold">Version</TableHead>
                  <TableHead className="text-right font-semibold">Active State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((template) => (
                  <TableRow key={template.id} className="align-top">
                    <TableCell className="max-w-xs">
                      <Link
                        href={`/admin/notification-templates/${template.id}`}
                        className="text-body-sm hover:text-primary block font-semibold transition-colors"
                      >
                        {template.name}
                      </Link>
                      <p className="text-caption text-muted-foreground/80 mt-0.5 font-mono">
                        {template.slug}
                      </p>
                    </TableCell>
                    <TableCell className="text-body-sm text-muted-foreground max-w-sm truncate">
                      {template.subject}
                    </TableCell>
                    <TableCell className="text-body-sm text-muted-foreground font-mono">
                      v{template.version}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActivePill isActive={template.isActive} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
