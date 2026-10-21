'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Lock, MessageSquare, Phone, UserRound } from 'lucide-react';
import { Alert, Button, Card, Input, Label, cn, formatDate } from '@sailent/ui';

import { registerForEvent, type DonorActionState } from '@/lib/donor/actions';
import { CancelRegistrationButton } from './cancel-registration-button';
import type { CardAction } from './events-query';

interface EventRegistrationFlowProps {
  eventId: string;
  slug: string;
  eventTitle: string;
  startsAt: string;
  endsAt?: string | null;
  venueName?: string | null;
  city?: string | null;
  isOnline?: boolean;
  meetingUrl?: string | null;
  isRegistered?: boolean;
  isSignedIn?: boolean;
  /**
   * What the shared rule (`registrationAvailability`, via `cardAction`) says
   * about this event — the same answer its card on /events and the API give.
   */
  availability: CardAction['kind'];
  registrationDeadline?: string | null;
  signInHref?: string;
  initialProfile?: {
    fullName?: string;
    email?: string;
    phone?: string;
  } | null;
}

export function EventRegistrationFlow({
  eventId,
  slug,
  eventTitle,
  startsAt,
  endsAt,
  venueName,
  city,
  isOnline,
  meetingUrl,
  isRegistered = false,
  isSignedIn = false,
  availability,
  registrationDeadline = null,
  signInHref,
  initialProfile,
}: EventRegistrationFlowProps) {
  const [fullName, setFullName] = React.useState(initialProfile?.fullName || '');
  const [phone, setPhone] = React.useState(initialProfile?.phone || '');
  const [message, setMessage] = React.useState('');
  const [consent, setConsent] = React.useState(false);

  const [fieldErrors, setFieldErrors] = React.useState<{
    fullName?: string;
    phone?: string;
    consent?: string;
  }>({});

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverState, setServerState] = React.useState<DonorActionState>({});
  const [isSuccess, setIsSuccess] = React.useState(false);

  /*
    THE ORDER IS THE SHARED RULE'S, as the event panel this replaced had it:
    cancelled before everything — somebody arriving at a cancelled camp needs
    to read that it is off — then finished, then the donor's own place (which
    outranks "full"), then full and closed, and only then the form.
  */
  const statusCard = (title: string, body: string) => (
    <Card className="shadow-xs rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{body}</p>
      <div className="mt-6">
        <Button asChild variant="secondary" className="rounded-full">
          <Link href="/events">See other events</Link>
        </Button>
      </div>
    </Card>
  );

  if (availability === 'cancelled') {
    return statusCard(
      'This event has been cancelled',
      'It will not take place. If you had registered, we have emailed you.',
    );
  }

  if (availability === 'finished') {
    return statusCard('This event has finished', 'Upcoming events are listed on the events page.');
  }

  // If already registered on initial render
  if (isRegistered) {
    return (
      <Card className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
              You are registered
            </h2>
            <p className="text-sm font-medium text-emerald-700">1 seat reserved for this event</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          We look forward to seeing you at <strong className="text-slate-900">{eventTitle}</strong>.
          Confirmation details have been emailed to your account.
        </p>

        {meetingUrl && isOnline ? (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Online Meeting Link
            </p>
            <a
              href={meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-semibold text-blue-800 underline hover:no-underline"
            >
              {meetingUrl}
            </a>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-6">
          <Button asChild variant="secondary" className="rounded-full">
            <Link href={`/events/${slug}`}>View Event Details</Link>
          </Button>
          <CancelRegistrationButton eventId={eventId} slug={slug} />
        </div>
      </Card>
    );
  }

  if (availability === 'closed') {
    const deadlinePassed =
      registrationDeadline !== null && new Date(registrationDeadline).getTime() <= Date.now();
    return statusCard(
      'Registration is closed',
      deadlinePassed
        ? `Registration closed on ${formatDate(registrationDeadline!)}.`
        : 'Registration for this event is not open.',
    );
  }

  // No id means the page is rendering from the fixture fallback with the API
  // unreachable: a form that cannot name an event would fail on submit.
  if (!eventId) {
    return (
      <Card className="shadow-xs rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <p className="text-sm leading-relaxed text-slate-600">
          Registration is unavailable at the moment. Please try again shortly.
        </p>
      </Card>
    );
  }

  // If event is at capacity
  if (availability === 'full') {
    return (
      <Card className="shadow-xs rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
          This event is full
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Every place has been taken. Places sometimes open up when somebody cancels, so it is worth
          checking back.
        </p>
        <div className="mt-6">
          <Button asChild variant="secondary" className="rounded-full">
            <Link href="/events">See other events</Link>
          </Button>
        </div>
      </Card>
    );
  }

  // Success view after completing registration
  if (isSuccess || serverState.ok) {
    const eventDate = new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(startsAt));

    return (
      <Card className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
              Registration Confirmed!
            </h2>
            <p className="text-sm font-medium text-emerald-700">1 seat successfully reserved</p>
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-5 text-sm">
          <p className="font-semibold text-slate-900">{eventTitle}</p>
          <p className="text-slate-600">
            <strong>Date:</strong> {eventDate}
          </p>
          <p className="text-slate-600">
            <strong>Attendee:</strong> {fullName || initialProfile?.fullName || 'Guest'} (1 person)
          </p>
          <p className="text-slate-600">
            <strong>Location:</strong> {isOnline ? 'Online' : venueName || city || 'In-person'}
          </p>
          {endsAt ? (
            <p className="text-slate-600">
              <strong>Ends:</strong>{' '}
              {new Intl.DateTimeFormat('en-IN', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata',
              }).format(new Date(endsAt))}
            </p>
          ) : null}
          <p className="text-slate-600">
            <strong>Seat Reservation:</strong> Exactly 1 seat reserved
          </p>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-slate-600">
          A confirmation has been sent to your email. You can manage or cancel your reservation
          anytime from your donor dashboard.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 border-t border-slate-100 pt-6">
          <Button asChild className="rounded-full bg-[#EB6A1F] hover:bg-[#D45914]">
            <Link href={`/events/${slug}`}>Back to Event Details</Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-full">
            <Link href="/events">Explore More Events</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required.';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Please enter a valid full name.';
    }

    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!cleanPhone) {
      errors.phone = 'Mobile number is required.';
    } else if (!/^(\+91)?[6-9]\d{9}$/.test(cleanPhone)) {
      errors.phone = 'Please enter a valid 10-digit Indian mobile number.';
    }

    if (!consent) {
      errors.consent = 'You must agree to the Terms and Conditions and Privacy Policy.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    if (!isSignedIn) {
      // Guide unauthenticated users to sign in to confirm
      setServerState({
        error:
          'Please sign in to register for this event. You will receive a 6-digit verification code.',
      });
      return;
    }

    setIsSubmitting(true);
    setServerState({});

    try {
      const formData = new FormData();
      formData.append('eventId', eventId);
      formData.append('slug', slug);
      formData.append('fullName', fullName);
      formData.append('phone', phone);
      if (message.trim()) formData.append('message', message.trim());
      formData.append('consent', consent ? 'true' : 'false');

      const result = await registerForEvent({}, formData);
      if (result.ok) {
        setIsSuccess(true);
      } else {
        setServerState(result);
      }
    } catch {
      setServerState({ error: 'Something went wrong while submitting. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] sm:p-8">
      {/* Eyebrow Badge */}
      <span className="text-primary inline-flex items-center rounded-full bg-[#FFF0E6] px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-wider">
        EVENT REGISTRATION
      </span>

      {/* Form Header */}
      <div className="mt-3">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#0A2540] sm:text-3xl">
          Reserve your place
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#486581]">
          Join us for this meaningful event and be part of a community that cares.
          <br className="hidden sm:inline" /> Fill in the form below to register and secure your
          seat.
        </p>
      </div>

      {/* Unauthenticated notice if not signed in */}
      {!isSignedIn ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 sm:text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold">Sign in required to register</p>
            <p className="mt-0.5 text-amber-800">
              Registration requires a donor session so your seat is reserved under your verified
              account.{' '}
              <Link
                href={signInHref || `/sign-in?next=/events/${slug}`}
                className="font-bold underline hover:no-underline"
              >
                Sign in to register
              </Link>{' '}
              to quickly complete registration.
            </p>
          </div>
        </div>
      ) : null}

      {/* Server error banner */}
      {serverState.error ? (
        <Alert variant="destructive" className="mt-5" role="alert">
          <div className="flex flex-col gap-2">
            <span>{serverState.error}</span>
            {!isSignedIn ? (
              <Button
                asChild
                size="sm"
                className="text-primary-foreground w-fit rounded-full bg-[#EB6A1F] text-xs font-bold"
              >
                <Link href={signInHref || `/sign-in?next=/events/${slug}`}>Sign In Now</Link>
              </Button>
            ) : null}
          </div>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
        {/* Full Name */}
        <div>
          <Label htmlFor="reg-full-name" className="text-sm font-bold text-[#0A2540]">
            Full Name <span className="text-red-500">*</span>
          </Label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <UserRound className="size-4.5" aria-hidden="true" />
            </span>
            <Input
              id="reg-full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (fieldErrors.fullName)
                  setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              className={cn(
                'h-12 rounded-xl pl-10 text-sm transition-colors',
                fieldErrors.fullName && 'border-red-500 focus-visible:ring-red-400',
              )}
            />
          </div>
          {fieldErrors.fullName ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>
          ) : null}
        </div>

        {/*
          NO EMAIL FIELD. The confirmation goes to the address on the donor's
          account — the API takes it from there, not from the form — so a field
          here would collect an address nothing uses.
        */}
        {initialProfile?.email ? (
          <p className="text-sm text-slate-600">
            We will send the confirmation to{' '}
            <span className="font-semibold text-[#0A2540]">{initialProfile.email}</span>, the
            address on your account.
          </p>
        ) : null}

        {/* Mobile Number with country-code control */}
        <div>
          <Label htmlFor="reg-phone" className="text-sm font-bold text-[#0A2540]">
            Mobile Number <span className="text-red-500">*</span>
          </Label>
          <div className="relative mt-1.5 flex gap-2">
            <div className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 sm:text-sm">
              <Phone className="size-4 text-slate-400" aria-hidden="true" />
              <span>+91</span>
            </div>
            <div className="relative flex-1">
              <Input
                id="reg-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                className={cn(
                  'h-12 rounded-xl text-sm transition-colors',
                  fieldErrors.phone && 'border-red-500 focus-visible:ring-red-400',
                )}
              />
            </div>
          </div>
          {fieldErrors.phone ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
          ) : null}
        </div>

        {/* Message (Optional) */}
        <div>
          <Label htmlFor="reg-message" className="text-sm font-bold text-[#0A2540]">
            Message <span className="font-normal text-slate-500">(Optional)</span>
          </Label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400">
              <MessageSquare className="size-4.5" aria-hidden="true" />
            </span>
            <textarea
              id="reg-message"
              name="message"
              rows={3}
              placeholder="Let us know if you have any special requirements or questions..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#EB6A1F] focus:outline-none focus:ring-2 focus:ring-[#EB6A1F]/20"
            />
          </div>
        </div>

        {/* One Registration = One Seat Box matching reference */}
        <div className="sm:p-4.5 flex items-center gap-3.5 rounded-2xl bg-[#EDF6FD] p-4">
          <div className="shrink-0">
            <svg
              className="size-8 text-[#0284C7]"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 2L4 5.5V11.5C4 16.5 7.4 21.1 12 22.3C16.6 21.1 20 16.5 20 11.5V5.5L12 2Z"
                className="fill-[#0284C7]"
              />
              <path
                d="M9.5 12.2L11.2 13.9L14.8 10.3"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="h-9 w-px bg-slate-300/60" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-display text-sm font-bold text-[#0A2540] sm:text-base">
              One registration = one seat
            </p>
            <p className="mt-0.5 text-xs text-[#486581]">Each person must register individually.</p>
          </div>
        </div>

        {/* Consent Checkbox */}
        <div>
          <label className="flex cursor-pointer select-none items-start gap-2.5">
            <input
              type="checkbox"
              name="consent"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (fieldErrors.consent)
                  setFieldErrors((prev) => ({ ...prev, consent: undefined }));
              }}
              className="size-4.5 text-primary mt-0.5 rounded-[4px] border-slate-300 focus:ring-[#EB6A1F]"
            />
            <span className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              I agree to the{' '}
              <Link
                href="/terms"
                target="_blank"
                className="text-primary font-semibold underline underline-offset-2 hover:text-[#D45914]"
              >
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy-policy"
                target="_blank"
                className="text-primary font-semibold underline underline-offset-2 hover:text-[#D45914]"
              >
                Privacy Policy
              </Link>{' '}
              of Sailent Foundation. <span className="text-red-500">*</span>
            </span>
          </label>
          {fieldErrors.consent ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.consent}</p>
          ) : null}
        </div>

        {/* Confirm Registration Button */}
        <div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12.5 text-primary-foreground hover:bg-primary-hover group flex w-full items-center justify-center gap-2 rounded-full bg-[#EB6A1F] text-base font-bold shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EB6A1F] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <span>Confirming Registration…</span>
            ) : (
              <>
                <span>Confirm Registration</span>
                <ArrowRight
                  className="size-4.5 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
