import { Mail } from 'lucide-react';

import { NewsletterForm } from '@/components/layout/newsletter-form';
import { PageShell } from '@/components/layout/page-shell';

/**
 * Newsletter sign-up.
 *
 * The form itself is the existing `NewsletterForm`, which already handles its
 * own validation, pending and error states. This is the band around it.
 *
 * One row at `lg`, as approved: label and blurb on the left, the field and its
 * button in the middle, the privacy line beside them rather than beneath. The
 * field's visible label is dropped to `sr-only` for that — the placeholder and
 * the heading beside it already say what to type, and the label is still read
 * out.
 */
export function NewsletterSection() {
  return (
    <section aria-labelledby="newsletter-title" className="bg-background border-border border-b">
      <PageShell className="py-5 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
          <div className="flex items-center gap-3 lg:flex-1">
            <span className="bg-wash-blue text-info-action hidden size-10 shrink-0 place-items-center rounded-lg sm:grid">
              <Mail className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="newsletter-title" className="text-body-lg font-bold">
                Stay Updated
              </h2>
              <p className="text-caption text-muted-foreground mt-0.5">
                Get the latest stories, updates and opportunities delivered to your inbox.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
            <NewsletterForm compact tone="info" className="lg:w-80" />
            <p className="text-caption text-muted-foreground whitespace-nowrap">
              We respect your privacy. No spam, ever.
            </p>
          </div>
        </div>
      </PageShell>
    </section>
  );
}
