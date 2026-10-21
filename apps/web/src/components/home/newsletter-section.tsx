'use client';

import * as React from 'react';
import { ArrowRight, Calendar, Check, FileText, Heart, Mail } from 'lucide-react';
import { Button, Label } from '@sailent/ui';
import { emailSchema } from '@sailent/validation';

import { subscribeToNewsletter } from '@/lib/communications/actions';
import { Honeypot } from '@/components/forms/honeypot';
import { PageShell } from '@/components/layout/page-shell';

/**
 * Newsletter subscription section 100% matching the approved design.
 *
 * Balanced horizontal banner with:
 * - Left: Large radiating envelope circle badge, uppercase orange "STAY CONNECTED",
 *   bold "Join Our Newsletter" heading with orange accent, and 2-line description.
 * - Center-Right: High-contrast white input pill with blue-grey mail icon, email input,
 *   and bold brand-orange Subscribe pill button.
 * - Beneath Form: 3 compact benefits with two-line labels separated by clean vertical dividers:
 *   "Latest Stories & Updates", "Upcoming Events", "Volunteer Opportunities".
 * - Far-Right: Rich origami paper airplane with 3D faceted folds, 3 celebration ray bursts,
 *   and a smooth dashed loop flight trail.
 * - Bottom-Left: Subtle botanical leaf watermark.
 */
export function NewsletterSection() {
  const inputId = React.useId();
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = emailSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Enter a valid email address');
      return;
    }
    setError(null);
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await subscribeToNewsletter(data);
      if (response.ok) {
        setSubmitted(true);
      } else {
        setError(response.fieldErrors?.email ?? response.error ?? 'That did not go through.');
      }
    });
  };

  return (
    <section aria-labelledby="newsletter-title" className="relative py-8 lg:py-10">
      <PageShell>
        <div className="shadow-xs border-border-card bg-surface-warm dark:border-border dark:bg-surface relative overflow-hidden rounded-[28px] border px-6 py-8 sm:px-8 sm:py-9 lg:px-12 lg:py-10">
          {/* Subtle botanical watermark in bottom-left corner */}
          <div
            className="pointer-events-none absolute -bottom-6 -left-6 select-none text-[#F4D9C4] opacity-30 dark:opacity-10"
            aria-hidden="true"
          >
            <svg width="200" height="150" viewBox="0 0 220 160" fill="currentColor">
              <path d="M0 160C30 100 90 60 170 30C120 90 60 140 0 160Z" />
              <path d="M40 160C80 110 140 80 220 70C170 115 100 150 40 160Z" opacity="0.75" />
              <path d="M10 160C50 130 90 105 150 95C110 125 60 150 10 160Z" opacity="0.5" />
            </svg>
          </div>

          <div className="relative z-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-8 xl:gap-12">
            {/* Left Area: Icon, Eyebrow, Heading, Description */}
            <div className="flex items-center gap-5 sm:gap-6 lg:col-span-6 xl:col-span-5">
              {/* Circular envelope icon with 3 radiating sun rays at 1 o'clock */}
              <div className="relative shrink-0">
                <span className="sm:size-18 shadow-xs text-primary flex size-16 items-center justify-center rounded-full border border-[#FDE1CD] bg-[#FFF2E5] dark:border-orange-950/60 dark:bg-orange-950/40">
                  <Mail className="size-8 stroke-[2.2] sm:size-9" aria-hidden="true" />
                </span>
                {/* 3 Radiating ray bursts at top-right */}
                <svg
                  className="pointer-events-none absolute -right-2 -top-2 size-7 text-[#EB6A1F]"
                  viewBox="0 0 28 28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="8" y1="13" x2="3" y2="7" />
                  <line x1="16" y1="7" x2="16" y2="1" />
                  <line x1="23" y1="13" x2="27" y2="7" />
                </svg>
              </div>

              {/* Text content */}
              <div className="min-w-0 flex-1">
                <p className="text-primary font-sans text-xs font-bold uppercase tracking-wider">
                  STAY CONNECTED
                </p>
                <h2
                  id="newsletter-title"
                  className="font-display mt-0.5 text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl lg:text-[32px] lg:leading-tight dark:text-white"
                >
                  Join Our <span className="text-primary">Newsletter</span>
                </h2>
                <p className="mt-1.5 max-w-[420px] text-xs leading-relaxed text-[#475569] sm:text-sm dark:text-slate-300">
                  Get the latest stories, updates and opportunities delivered directly to your
                  inbox. Be a part of the change.
                </p>
              </div>
            </div>

            {/* Right Area: Subscription Form, Benefits, and Airplane */}
            <div className="relative lg:col-span-6 lg:pr-24 xl:col-span-7 xl:pr-28">
              {/* Form */}
              <form onSubmit={handleSubmit} noValidate className="relative">
                <Honeypot />
                <Label htmlFor={inputId} className="sr-only">
                  Email address
                </Label>
                <div className="flex flex-col gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:rounded-full dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-1 sm:py-0">
                    <Mail
                      className="size-5 shrink-0 text-[#64748B] dark:text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id={inputId}
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email address"
                      value={value}
                      required
                      disabled={pending}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                      onChange={(event) => {
                        setValue(event.target.value);
                        if (error) {
                          setError(
                            emailSchema.safeParse(event.target.value).success ? null : error,
                          );
                        }
                      }}
                      className="w-full min-w-0 bg-transparent text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={pending}
                    isLoading={pending}
                    loadingLabel="Subscribing"
                    size="md"
                    className="shrink-0"
                  >
                    <span>{pending ? 'Subscribing...' : 'Subscribe'}</span>
                    {!pending && <ArrowRight className="size-4 stroke-[2.5]" aria-hidden="true" />}
                  </Button>
                </div>

                {submitted ? (
                  <div
                    role="status"
                    className="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <Check
                      className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    <span>Nearly done — check your inbox and confirm with the link we sent.</span>
                  </div>
                ) : null}

                {error ? (
                  <p
                    id={`${inputId}-error`}
                    role="alert"
                    className="mt-2 px-1 text-xs font-medium text-red-600 dark:text-red-400"
                  >
                    {error}
                  </p>
                ) : null}
              </form>

              {/* Three compact benefits beneath the form */}
              <div className="mt-4 flex flex-wrap items-center gap-y-3 sm:gap-x-4 lg:gap-x-5">
                {/* Benefit 1 */}
                <div className="flex items-center gap-2.5">
                  <span className="size-7.5 text-primary flex shrink-0 items-center justify-center rounded-full bg-[#FFF2E5] dark:bg-orange-950/50">
                    <FileText className="size-4 stroke-[2.2]" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold leading-tight text-[#334155] dark:text-slate-300">
                    Latest Stories
                    <br className="hidden sm:inline" /> &amp; Updates
                  </span>
                </div>

                <div
                  className="hidden h-7 w-px bg-[#E2E8F0] sm:block dark:bg-slate-800"
                  aria-hidden="true"
                />

                {/* Benefit 2 */}
                <div className="flex items-center gap-2.5">
                  <span className="size-7.5 text-primary flex shrink-0 items-center justify-center rounded-full bg-[#FFF2E5] dark:bg-orange-950/50">
                    <Calendar className="size-4 stroke-[2.2]" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold leading-tight text-[#334155] dark:text-slate-300">
                    Upcoming
                    <br className="hidden sm:inline" /> Events
                  </span>
                </div>

                <div
                  className="hidden h-7 w-px bg-[#E2E8F0] sm:block dark:bg-slate-800"
                  aria-hidden="true"
                />

                {/* Benefit 3 */}
                <div className="flex items-center gap-2.5">
                  <span className="size-7.5 text-primary flex shrink-0 items-center justify-center rounded-full bg-[#FFF2E5] dark:bg-orange-950/50">
                    <Heart className="size-4 stroke-[2.2]" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold leading-tight text-[#334155] dark:text-slate-300">
                    Volunteer
                    <br className="hidden sm:inline" /> Opportunities
                  </span>
                </div>
              </div>

              {/* Decorative origami paper airplane and dashed flight trail on far right */}
              <div
                className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 select-none lg:block xl:-right-4"
                aria-hidden="true"
              >
                <svg
                  width="130"
                  height="120"
                  viewBox="0 0 130 120"
                  fill="none"
                  className="overflow-visible"
                >
                  {/* Dashed flight trail curve */}
                  <path
                    d="M10 105 C 35 110, 50 75, 28 60 C 12 48, 32 30, 75 48"
                    stroke="#EB6A1F"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    opacity="0.5"
                  />
                  {/* 3 Celebration / speed sparks at top-right of airplane */}
                  <line
                    x1="112"
                    y1="16"
                    x2="122"
                    y2="13"
                    stroke="#EB6A1F"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="118"
                    y1="25"
                    x2="128"
                    y2="28"
                    stroke="#EB6A1F"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="110"
                    y1="34"
                    x2="119"
                    y2="41"
                    stroke="#EB6A1F"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* Origami Paper Airplane */}
                  <g transform="translate(62, 18) rotate(-10)">
                    <polygon points="50,22 0,0 28,26" fill="#EB6A1F" />
                    <polygon points="50,22 14,32 28,26" fill="#D95B12" />
                    <polygon points="50,22 0,0 14,32" fill="#F97316" opacity="0.9" />
                    <polygon points="28,26 14,32 22,42" fill="#C2410C" />
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </section>
  );
}
