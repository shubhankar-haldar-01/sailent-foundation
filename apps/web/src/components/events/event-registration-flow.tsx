'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { Alert, Button, Card, Input, Label, cn, Spinner } from '@sailent/ui';

import {
  createEventRegistrationOrder,
  registerForEvent,
  requestEventRegistrationOtp,
  verifyEventRegistrationOtp,
  type DonorActionState,
} from '@/lib/donor/actions';
import { loadRazorpayScript, openRazorpayCheckout } from '@/lib/payments/razorpay-checkout';
import { CancelRegistrationButton } from './cancel-registration-button';
import { downloadPassImage } from './download-pass';
import { EventEntryPass } from './event-entry-pass';
import type { CardAction } from './events-query';
import { useRevealResult } from '@/lib/ui/reveal-result';

interface EventRegistrationFlowProps {
  eventId: string;
  slug: string;
  eventTitle: string;
  startsAt: string;
  endsAt?: string | null;
  venueName?: string | null;
  city?: string | null;
  isPaid?: boolean;
  feeAmount?: number | null;
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
  supportEmail?: string | null;
  supportPhone?: string | null;
  functions?: string[] | null;
}

export function EventRegistrationFlow({
  eventId,
  slug,
  eventTitle,
  startsAt,
  endsAt,
  venueName,
  city,
  isPaid = false,
  feeAmount = null,
  isRegistered = false,
  isSignedIn = false,
  availability,
  registrationDeadline: _registrationDeadline = null,
  signInHref,
  initialProfile,
  supportEmail,
  supportPhone,
  functions,
}: EventRegistrationFlowProps) {
  // Activity / Function selection (if event offers multiple activities, e.g. Dance, Singing, Running)
  const availableFunctions = React.useMemo(() => {
    return Array.isArray(functions)
      ? functions.filter((f) => typeof f === 'string' && f.trim().length > 0)
      : [];
  }, [functions]);

  const [selectedFunction, setSelectedFunction] = React.useState<string>(
    availableFunctions[0] || '',
  );

  // Multi-Pass selection (1 to 4 passes)
  const [passCount, setPassCount] = React.useState<number>(1);
  const [attendeeNames, setAttendeeNames] = React.useState<string[]>([
    initialProfile?.fullName || '',
    '',
    '',
    '',
  ]);

  const [email, setEmail] = React.useState(initialProfile?.email || '');
  const [phone, setPhone] = React.useState(initialProfile?.phone || '');
  const [consent, setConsent] = React.useState(false);

  // Email verification with OTP (single primary email verifies the booking)
  const [isEmailVerified, setIsEmailVerified] = React.useState(Boolean(isSignedIn));
  const [isOtpSent, setIsOtpSent] = React.useState(false);
  const [otpCode, setOtpCode] = React.useState('');
  const [isSendingOtp, setIsSendingOtp] = React.useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = React.useState(false);
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [otpSuccessMessage, setOtpSuccessMessage] = React.useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = React.useState(0);

  const [fieldErrors, setFieldErrors] = React.useState<{
    attendees?: string[];
    functionName?: string;
    email?: string;
    phone?: string;
    consent?: string;
  }>({});

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverState, setServerState] = React.useState<DonorActionState>({});
  const resultRef = useRevealResult(serverState);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState(false);

  // Total payable fee based on pass quantity
  const totalPayableFee = isPaid && feeAmount ? feeAmount * passCount : null;

  const handleDownloadPass = async (passCode: string) => {
    setIsDownloading(true);
    try {
      const attendeesForDownload =
        serverState.pass?.attendees ||
        attendeeNames.slice(0, passCount).map((name, idx) => ({
          fullName:
            name.trim() ||
            (idx === 0 ? attendeeNames[0] || 'Guest Attendee' : `Attendee ${idx + 1}`),
          passNumber: passCount > 1 ? `${passCode}-${idx + 1}` : passCode,
        }));

      await downloadPassImage({
        passNumber: passCode,
        eventTitle,
        startsAt,
        endsAt,
        venueName,
        city,
        fullName:
          attendeeNames[0]?.trim() ||
          serverState.pass?.fullName ||
          initialProfile?.fullName ||
          'Guest Attendee',
        email: email || serverState.pass?.email || initialProfile?.email,
        phone: phone || serverState.pass?.phone || initialProfile?.phone,
        isPaid,
        feeAmount: totalPayableFee,
        registeredAt: serverState.pass?.registeredAt,
        supportEmail: supportEmail || 'hello@sailentfoundation.org',
        supportPhone: supportPhone || '+91 98765 43210',
        functionName: selectedFunction || serverState.pass?.functionName || null,
        attendees: attendeesForDownload,
      });
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (err) {
      console.error('Failed to download pass:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Sync initial profile values if they load asynchronously
  React.useEffect(() => {
    if (initialProfile?.fullName && !attendeeNames[0]) {
      setAttendeeNames((prev) => {
        const next = [...prev];
        next[0] = initialProfile.fullName || '';
        return next;
      });
    }
    if (initialProfile?.email && !email) {
      setEmail(initialProfile.email);
      if (isSignedIn) setIsEmailVerified(true);
    }
    if (initialProfile?.phone && !phone) {
      setPhone(initialProfile.phone);
    }
  }, [initialProfile, attendeeNames, email, phone, isSignedIn]);

  // Resend OTP countdown timer
  React.useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const statusCard = (
    title: string,
    body: string,
    state: 'cancelled' | 'finished' | 'full' | 'closed' = 'closed',
  ) => {
    const badgeConfig = {
      cancelled: {
        label: 'Event Cancelled',
        className: 'bg-destructive-subtle text-destructive ring-destructive/30',
      },
      finished: {
        label: 'Event Concluded',
        className: 'bg-muted text-foreground ring-border',
      },
      full: {
        label: 'Event Full',
        className: 'bg-warning-subtle text-warning-foreground ring-warning/30',
      },
      closed: {
        label: 'Registration Closed',
        className: 'bg-destructive-subtle text-destructive ring-destructive/30',
      },
    }[state];

    return (
      <Card className="border-border/80 bg-surface rounded-3xl border p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-caption inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold tracking-wider ring-1',
              badgeConfig.className,
            )}
          >
            {badgeConfig.label}
          </span>
        </div>
        <h2 className="font-display text-foreground mt-3 text-xl font-bold sm:text-2xl">{title}</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
        <div className="mt-6">
          <Button asChild variant="secondary" className="rounded-full">
            <Link href="/events">Explore other events</Link>
          </Button>
        </div>
      </Card>
    );
  };

  if (availability === 'cancelled') {
    return statusCard(
      'This event has been cancelled',
      'It will not take place. If you had previously registered, our team has emailed you with details.',
      'cancelled',
    );
  }

  if (availability === 'finished') {
    return statusCard(
      'This event has concluded',
      'Thank you for your interest. Upcoming events are listed on our events directory.',
      'finished',
    );
  }

  // If already registered on initial render
  if (isRegistered) {
    const existingPassCode = `SF-EVT-${eventId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    return (
      <Card
        data-pass-container
        className="pass-outer-card print:border-none! print:bg-transparent! print:shadow-none! border-success/30 bg-surface rounded-3xl border p-6 shadow-sm sm:p-8 print:m-0 print:border-0 print:p-0"
      >
        <div className="flex items-center gap-3.5 print:hidden">
          <div className="bg-success-subtle text-success ring-success/50 flex size-12 shrink-0 items-center justify-center rounded-2xl ring-4">
            <CheckCircle2 className="size-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-caption bg-success-subtle/70 text-success inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold">
              Admission Confirmed
            </span>
            <h2 className="font-display text-foreground text-xl font-bold sm:text-2xl">
              You are registered
            </h2>
          </div>
        </div>

        <p className="text-muted-foreground mt-4 text-sm leading-relaxed print:hidden">
          We look forward to seeing you at <strong className="text-foreground">{eventTitle}</strong>
          . Your reservation confirmation has been registered with our team.
        </p>

        <div className="mt-5 print:m-0 print:p-6">
          <EventEntryPass
            passNumber={existingPassCode}
            eventTitle={eventTitle}
            startsAt={startsAt}
            endsAt={endsAt}
            venueName={venueName}
            city={city}
            fullName={attendeeNames[0] || initialProfile?.fullName || 'Registered Attendee'}
            email={email || initialProfile?.email}
            phone={phone || initialProfile?.phone}
            isPaid={isPaid}
            feeAmount={feeAmount}
            functionName={selectedFunction || null}
            supportEmail={supportEmail}
            supportPhone={supportPhone}
          />
        </div>

        <div className="border-border mt-6 flex flex-wrap items-center gap-3 border-t pt-6 print:hidden">
          <Button
            type="button"
            onClick={() => handleDownloadPass(existingPassCode)}
            disabled={isDownloading}
            className="bg-primary text-primary-foreground hover:bg-primary-hover gap-2 rounded-full text-xs font-bold shadow-sm sm:text-sm"
          >
            {downloaded ? (
              <>
                <Check className="size-4 text-white" />
                <span>Pass downloaded</span>
              </>
            ) : isDownloading ? (
              <>
                <Spinner className="size-4 text-white" />
                <span>Downloading pass…</span>
              </>
            ) : (
              <>
                <Download className="size-4" />
                <span>Download Pass</span>
              </>
            )}
          </Button>
          {isSignedIn ? (
            <Button
              asChild
              className="border-border bg-surface text-foreground hover:bg-background rounded-full border text-xs font-bold sm:text-sm"
            >
              <Link href="/dashboard/events">View in Dashboard</Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary" className="rounded-full text-xs font-bold sm:text-sm">
            <Link href={`/events/${slug}`}>Event Details</Link>
          </Button>
          {isSignedIn ? <CancelRegistrationButton eventId={eventId} slug={slug} /> : null}
        </div>
      </Card>
    );
  }

  if (availability === 'full') {
    return statusCard(
      'This event is full',
      'Every place has been taken. Places sometimes open up if someone cancels, so please check back.',
      'full',
    );
  }

  if (availability === 'closed') {
    return statusCard(
      'Registration is closed',
      'Registration for this event is not open. Thank you for your interest in our programs.',
      'closed',
    );
  }

  // Success view after completing registration in this session
  if (isSuccess || serverState.ok) {
    const pass = serverState.pass;
    const passNumber =
      pass?.passNumber ||
      `SF-EVT-${(pass?.id || eventId).replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    const effectiveAttendees =
      pass?.attendees && pass.attendees.length > 0
        ? pass.attendees
        : attendeeNames.slice(0, passCount).map((name, idx) => ({
            fullName: name.trim() || `Attendee ${idx + 1}`,
            passNumber: passCount > 1 ? `${passNumber}-${idx + 1}` : passNumber,
          }));

    return (
      <Card
        data-pass-container
        className="pass-outer-card print:border-none! print:bg-transparent! print:shadow-none! border-success/30 bg-surface overflow-hidden rounded-3xl border p-6 shadow-sm sm:p-8 lg:p-9 print:m-0 print:border-0 print:p-0"
      >
        <div className="flex items-center gap-3.5 print:hidden">
          <div className="bg-success-subtle text-success ring-success/50 flex size-12 shrink-0 items-center justify-center rounded-2xl ring-4">
            <CheckCircle2 className="size-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-caption bg-success-subtle/70 text-success inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold">
              Registration Successful
            </span>
            <h2 className="font-display text-foreground text-xl font-bold sm:text-2xl">
              Registration Confirmed!
            </h2>
          </div>
        </div>

        <p className="text-muted-foreground mt-3 text-sm leading-relaxed print:hidden">
          Your reservation is secured for <strong className="text-foreground">{eventTitle}</strong>{' '}
          {pass?.functionName ? (
            <span>
              (Activity: <strong>{pass.functionName}</strong>)
            </span>
          ) : null}
          .{' '}
          {effectiveAttendees.length > 1
            ? `${effectiveAttendees.length} official entry passes have`
            : 'An official entry pass has'}{' '}
          been issued below. You can download all passes in a single ticket sheet file.
        </p>

        {/* Market-Standard Digital Entry Pass */}
        <div className="mt-5 print:m-0 print:p-6">
          <EventEntryPass
            passNumber={passNumber}
            eventTitle={eventTitle}
            startsAt={startsAt}
            endsAt={endsAt}
            venueName={venueName}
            city={city}
            fullName={attendeeNames[0] || pass?.fullName || 'Guest Attendee'}
            email={email || pass?.email}
            phone={phone || pass?.phone}
            isPaid={isPaid}
            feeAmount={totalPayableFee}
            registeredAt={pass?.registeredAt}
            functionName={pass?.functionName || selectedFunction || null}
            attendees={effectiveAttendees}
            supportEmail={supportEmail}
            supportPhone={supportPhone}
          />
        </div>

        <div className="border-border mt-6 flex flex-wrap items-center gap-3 border-t pt-6 print:hidden">
          <Button
            type="button"
            onClick={() => handleDownloadPass(passNumber)}
            disabled={isDownloading}
            className="bg-primary text-primary-foreground hover:bg-primary-hover gap-2 rounded-full text-xs font-bold shadow-sm sm:text-sm"
          >
            {downloaded ? (
              <>
                <Check className="size-4 text-white" />
                <span>
                  {effectiveAttendees.length > 1 ? 'All passes downloaded' : 'Pass downloaded'}
                </span>
              </>
            ) : isDownloading ? (
              <>
                <Spinner className="size-4 text-white" />
                <span>Generating Ticket File...</span>
              </>
            ) : (
              <>
                <Download className="size-4" />
                <span>
                  {effectiveAttendees.length > 1
                    ? `Download All ${effectiveAttendees.length} Passes (1 File)`
                    : 'Download Pass'}
                </span>
              </>
            )}
          </Button>
          {isSignedIn ? (
            <Button
              asChild
              className="border-border bg-surface text-foreground hover:bg-background rounded-full border text-xs font-bold sm:text-sm"
            >
              <Link href="/dashboard/events">View in Dashboard</Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary" className="rounded-full text-xs font-bold sm:text-sm">
            <Link href="/events">Explore More Events</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const handleSendOtp = async () => {
    setOtpError(null);
    setOtpSuccessMessage(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setFieldErrors((prev) => ({ ...prev, email: 'Please enter a valid email address first.' }));
      return;
    }

    setIsSendingOtp(true);
    try {
      const primaryName = attendeeNames[0]?.trim() || 'Guest';
      const result = await requestEventRegistrationOtp(eventId, email, primaryName);
      if (result.ok) {
        setIsOtpSent(true);
        setResendCountdown(30);
        setOtpSuccessMessage('A 6-digit verification code has been sent to your email.');
      } else {
        setOtpError(result.error || 'Could not send verification code.');
      }
    } catch {
      setOtpError('Failed to send verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError(null);
    setOtpSuccessMessage(null);

    if (!/^\d{6}$/.test(otpCode.trim())) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const result = await verifyEventRegistrationOtp(eventId, email, otpCode);
      if (result.ok) {
        setIsEmailVerified(true);
        setOtpSuccessMessage('Email verified. Registration is now active.');
        setFieldErrors((prev) => ({ ...prev, email: undefined }));
      } else {
        setOtpError(result.error || 'Invalid or expired verification code.');
      }
    } catch {
      setOtpError('Failed to verify code. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResetEmail = () => {
    setIsEmailVerified(false);
    setIsOtpSent(false);
    setOtpCode('');
    setOtpError(null);
    setOtpSuccessMessage(null);
  };

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};

    // Validate attendee names
    const attendeeErrors: string[] = [];
    let hasAttendeeError = false;
    for (let i = 0; i < passCount; i++) {
      const name = (attendeeNames[i] || '').trim();
      if (!name) {
        attendeeErrors[i] = `Attendee ${i + 1} name is required.`;
        hasAttendeeError = true;
      } else if (name.length < 2) {
        attendeeErrors[i] = `Attendee ${i + 1} name must be at least 2 characters.`;
        hasAttendeeError = true;
      } else {
        attendeeErrors[i] = '';
      }
    }
    if (hasAttendeeError) {
      errors.attendees = attendeeErrors;
    }

    // Function validation if functions are specified
    if (availableFunctions.length > 0 && !selectedFunction) {
      errors.functionName = 'Please choose an activity or function to register.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    } else if (!isEmailVerified) {
      errors.email = 'Please verify your email address with OTP before confirming.';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      errors.phone = 'Mobile number is required.';
    } else if (cleanPhone.length !== 10) {
      errors.phone = 'Please enter a valid 10-digit mobile number.';
    }

    if (!consent) {
      errors.consent = 'You must agree to the Terms of Use and Privacy Policy.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    if (!eventId) {
      setServerState({
        error: 'Registration is currently unavailable for this event. Please try again shortly.',
      });
      return;
    }

    setIsSubmitting(true);
    setServerState({});

    const primaryName = (attendeeNames[0] || '').trim();
    const payloadAttendees = attendeeNames.slice(0, passCount).map((name) => ({
      fullName: name.trim(),
    }));

    try {
      if (isPaid && totalPayableFee && totalPayableFee > 0) {
        // 1. Create registration payment order
        const orderResult = await createEventRegistrationOrder(eventId, {
          email,
          fullName: primaryName,
          phone,
          attendeeCount: passCount,
          functionName: selectedFunction || undefined,
          attendees: payloadAttendees,
        });

        if (!orderResult.ok) {
          setServerState({ error: orderResult.error });
          setIsSubmitting(false);
          return;
        }

        // 2. Load Razorpay Checkout modal
        await loadRazorpayScript();

        // 3. Open Razorpay Checkout modal
        const outcome = await openRazorpayCheckout({
          razorpayKeyId: orderResult.order.keyId,
          razorpayOrderId: orderResult.order.orderId,
          amount: orderResult.order.amount,
          currency: orderResult.order.currency,
          description: `Event Entry (${passCount} passes): ${eventTitle.slice(0, 25)}`,
          donor: {
            name: primaryName,
            email,
            phone,
          },
        });

        if (outcome.kind === 'failed') {
          setServerState({ error: outcome.reason });
          setIsSubmitting(false);
          return;
        }

        if (outcome.kind === 'dismissed') {
          setServerState({
            error: 'Payment was not completed. Your registration is not yet confirmed.',
          });
          setIsSubmitting(false);
          return;
        }

        // 4. outcome.kind === 'paid' -> register with verification signature
        const formData = new FormData();
        formData.append('eventId', eventId);
        formData.append('slug', slug);
        formData.append('fullName', primaryName);
        formData.append('email', email);
        formData.append('phone', phone);
        formData.append('consent', consent ? 'true' : 'false');
        formData.append('attendeeCount', passCount.toString());
        if (selectedFunction) {
          formData.append('functionName', selectedFunction);
        }
        formData.append('attendees', JSON.stringify(payloadAttendees));
        formData.append('razorpayOrderId', outcome.result.razorpayOrderId);
        formData.append('razorpayPaymentId', outcome.result.razorpayPaymentId);
        formData.append('razorpaySignature', outcome.result.razorpaySignature);

        const result = await registerForEvent({}, formData);
        if (result.ok) {
          setIsSuccess(true);
          setServerState(result);
        } else {
          setServerState(result);
        }
      } else {
        const formData = new FormData();
        formData.append('eventId', eventId);
        formData.append('slug', slug);
        formData.append('fullName', primaryName);
        formData.append('email', email);
        formData.append('phone', phone);
        formData.append('consent', consent ? 'true' : 'false');
        formData.append('attendeeCount', passCount.toString());
        if (selectedFunction) {
          formData.append('functionName', selectedFunction);
        }
        formData.append('attendees', JSON.stringify(payloadAttendees));

        const result = await registerForEvent({}, formData);
        if (result.ok) {
          setIsSuccess(true);
          setServerState(result);
        } else {
          setServerState(result);
        }
      }
    } catch {
      setServerState({ error: 'Something went wrong while submitting. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border/80 bg-surface rounded-3xl border p-6 shadow-sm sm:p-8 lg:p-9">
      {/* Header with Eyebrow Badge */}
      <div className="flex items-center gap-2">
        <span className="text-caption bg-accent text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold uppercase tracking-wider">
          <Sparkles className="text-primary size-3" aria-hidden="true" />
          Event Registration
        </span>
      </div>

      <div className="mt-3">
        <h2 className="font-display text-foreground text-2xl font-extrabold tracking-tight sm:text-3xl">
          Reserve your place
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Join us for this meaningful event and be part of a community that cares. You can book up
          to 4 passes for your family or friends with a single registration contact.
        </p>
      </div>

      {/* Account Status / Helper for return donors */}
      {!isSignedIn ? (
        <div className="border-border/80 bg-background/70 text-muted-foreground mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-xs sm:text-sm">
          <div className="text-foreground flex items-center gap-2">
            <span className="bg-success size-2 rounded-full" />
            <span>Open registration • No account required</span>
          </div>
          <div className="text-xs">
            <span>Already a donor? </span>
            <Link
              href={signInHref || `/sign-in?next=/events/${slug}`}
              className="text-primary hover:text-primary font-semibold underline underline-offset-2"
            >
              Sign in to register
            </Link>
          </div>
        </div>
      ) : (
        <div className="border-success/80 bg-success-subtle/60 mt-5 rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-success-subtle text-success flex size-9 shrink-0 items-center justify-center rounded-xl">
                <UserCheck className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-success truncate text-xs font-semibold">
                  Signed in as{' '}
                  <span className="font-bold">{initialProfile?.fullName || 'Verified Donor'}</span>
                </p>
                {initialProfile?.email ? (
                  <p className="text-success truncate text-xs">{initialProfile.email}</p>
                ) : null}
              </div>
            </div>
            <span className="text-caption bg-success-subtle text-success inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 font-bold">
              Account Active
            </span>
          </div>
        </div>
      )}

      {/* Server error banner */}
      {serverState.error ? (
        <Alert ref={resultRef} variant="destructive" className="mt-5 rounded-2xl" role="alert">
          <div className="flex flex-col gap-2">
            <span>{serverState.error}</span>
          </div>
        </Alert>
      ) : null}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
        {/* 1. Activity / Function Selection (if event offers activities, e.g. Champaran Mahotsav: Dance, Singing, Running) */}
        {availableFunctions.length > 0 ? (
          <div className="border-primary/80 bg-accent/40 rounded-2xl border p-4 sm:p-5">
            <Label className="text-foreground text-sm font-bold">
              Select Activity / Function <span className="text-destructive">*</span>
            </Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Choose the program activity or function you wish to register for.
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {availableFunctions.map((fn) => {
                const isSelected = selectedFunction === fn;
                return (
                  <button
                    key={fn}
                    type="button"
                    onClick={() => {
                      setSelectedFunction(fn);
                      if (fieldErrors.functionName) {
                        setFieldErrors((prev) => ({ ...prev, functionName: undefined }));
                      }
                    }}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all sm:text-sm',
                      isSelected
                        ? 'bg-primary text-primary-foreground ring-primary/30 shadow-sm ring-2'
                        : 'border-border bg-surface text-foreground hover:border-primary/30 hover:bg-accent/50 border',
                    )}
                  >
                    {isSelected ? <Check className="size-4 stroke-[3]" /> : null}
                    <span>{fn}</span>
                  </button>
                );
              })}
            </div>
            {fieldErrors.functionName ? (
              <p className="text-destructive mt-2 text-xs">{fieldErrors.functionName}</p>
            ) : null}
          </div>
        ) : null}

        {/* 2. Number of Passes Selector (1 to 4 passes) */}
        <div className="border-border/90 bg-background/50 rounded-2xl border p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label className="text-foreground text-sm font-bold">
                Number of Passes <span className="text-destructive">*</span>
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Book up to 4 passes in a single reservation.
              </p>
            </div>
            <div className="border-border bg-surface flex items-center gap-1.5 rounded-xl border p-1">
              {[1, 2, 3, 4].map((count) => {
                const isSelected = passCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      setPassCount(count);
                      if (fieldErrors.attendees) {
                        setFieldErrors((prev) => ({ ...prev, attendees: undefined }));
                      }
                    }}
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg text-sm font-bold transition-all sm:size-10',
                      isSelected
                        ? 'shadow-xs bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {count}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Attendee Names (Individual details per pass) */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2">
            <Users className="text-primary size-4" />
            <h3 className="text-foreground text-sm font-bold">
              {passCount === 1 ? 'Attendee Details' : `Attendee Names (${passCount} Passes)`}
            </h3>
          </div>

          <div className="space-y-3">
            {Array.from({ length: passCount }).map((_, idx) => (
              <div key={idx}>
                <Label
                  htmlFor={`attendee-name-${idx}`}
                  className="text-foreground text-xs font-semibold"
                >
                  {passCount === 1
                    ? 'Full Name'
                    : `Pass ${idx + 1} Attendee Name ${idx === 0 ? '(Primary Contact)' : ''}`}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1">
                  <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <User className="size-4" aria-hidden="true" />
                  </span>
                  <Input
                    id={`attendee-name-${idx}`}
                    type="text"
                    autoComplete={idx === 0 ? 'name' : undefined}
                    placeholder={
                      idx === 0 ? 'Enter primary attendee name' : `Enter attendee ${idx + 1} name`
                    }
                    value={attendeeNames[idx] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAttendeeNames((prev) => {
                        const next = [...prev];
                        next[idx] = val;
                        return next;
                      });
                      if (fieldErrors.attendees?.[idx]) {
                        setFieldErrors((prev) => {
                          const updated = [...(prev.attendees || [])];
                          updated[idx] = '';
                          return { ...prev, attendees: updated };
                        });
                      }
                    }}
                    className={cn(
                      'shadow-2xs h-11 rounded-xl pl-10 text-sm transition-colors',
                      fieldErrors.attendees?.[idx] &&
                        'border-destructive focus-visible:ring-destructive',
                    )}
                  />
                </div>
                {fieldErrors.attendees?.[idx] ? (
                  <p className="text-destructive mt-1 text-xs">{fieldErrors.attendees[idx]}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Primary Contact Information (1 Email + 1 Phone for all passes) */}
        <div className="border-border/90 bg-background/50 space-y-4 rounded-2xl border p-4 sm:p-5">
          <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
            Booking Contact Information
          </h3>

          {/* Email Address with Send OTP & Validation */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="reg-email" className="text-foreground text-sm font-semibold">
                Email Address <span className="text-destructive">*</span>
              </Label>
              {isEmailVerified ? (
                <span className="text-success inline-flex items-center gap-1 text-xs font-bold">
                  <Check className="size-3.5 stroke-[2.5]" />
                  <span>Verified</span>
                </span>
              ) : null}
            </div>

            <div className="relative mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Mail className="size-4.5" aria-hidden="true" />
                </span>
                <Input
                  id="reg-email"
                  name="email"
                  aria-label="Email Address"
                  type="email"
                  autoComplete="email"
                  disabled={isEmailVerified}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setIsOtpSent(false);
                    setIsEmailVerified(false);
                    setOtpError(null);
                    setOtpSuccessMessage(null);
                    if (fieldErrors.email)
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  className={cn(
                    'shadow-2xs h-11 rounded-xl pl-10 text-sm transition-colors',
                    fieldErrors.email && 'border-destructive focus-visible:ring-destructive',
                    isEmailVerified &&
                      'border-success/30 bg-success-subtle/40 text-foreground font-medium',
                  )}
                />
              </div>

              {/* OTP Action Button */}
              {!isEmailVerified ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isSendingOtp || !email.trim()}
                  onClick={handleSendOtp}
                  className="border-primary/30 bg-accent/60 text-primary hover:bg-accent/70 h-11 shrink-0 rounded-xl border px-4 text-xs font-bold"
                >
                  {isSendingOtp ? 'Sending…' : isOtpSent ? 'Resend OTP' : 'Send OTP'}
                </Button>
              ) : !isSignedIn ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetEmail}
                  className="text-muted-foreground hover:text-foreground h-11 shrink-0 rounded-xl px-3 text-xs font-semibold"
                >
                  Change
                </Button>
              ) : null}
            </div>

            {fieldErrors.email ? (
              <p className="text-destructive mt-1 text-xs">{fieldErrors.email}</p>
            ) : (
              <p className="text-caption text-muted-foreground mt-1">
                {isEmailVerified
                  ? 'Your email is verified. All passes will be delivered here.'
                  : 'Click "Send OTP" to receive a verification code on your email.'}
              </p>
            )}

            {/* OTP Verification Panel */}
            {isOtpSent && !isEmailVerified ? (
              <div className="border-primary/90 bg-accent/40 mt-3 rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground text-xs font-bold">
                    Enter 6-digit Code sent to <strong className="text-foreground">{email}</strong>
                  </span>
                  {resendCountdown > 0 ? (
                    <span className="text-muted-foreground text-xs">
                      Resend in {resendCountdown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                      className="text-primary hover:text-primary text-xs font-bold underline underline-offset-2"
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(clean);
                      if (otpError) setOtpError(null);
                    }}
                    className="shadow-2xs border-primary/30 bg-surface text-foreground focus-visible:ring-primary h-10 w-36 rounded-xl text-center font-mono text-lg font-bold tracking-widest"
                  />
                  <Button
                    type="button"
                    disabled={otpCode.length !== 6 || isVerifyingOtp}
                    onClick={handleVerifyOtp}
                    className="shadow-2xs bg-primary text-primary-foreground hover:bg-primary-hover h-10 rounded-xl px-4 text-xs font-bold"
                  >
                    {isVerifyingOtp ? 'Verifying…' : 'Validate OTP'}
                  </Button>
                </div>

                {otpError ? (
                  <p className="text-destructive mt-2 text-xs font-semibold">{otpError}</p>
                ) : null}
                {otpSuccessMessage ? (
                  <p className="text-success mt-2 text-xs font-semibold">{otpSuccessMessage}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Mobile Number */}
          <div>
            <Label htmlFor="reg-phone" className="text-foreground text-sm font-semibold">
              Mobile Number <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-1.5 flex gap-2">
              <div className="border-border bg-background/70 text-foreground flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold sm:text-sm">
                <Phone className="text-muted-foreground size-3.5" aria-hidden="true" />
                <span>+91</span>
              </div>
              <div className="relative flex-1">
                <Input
                  id="reg-phone"
                  name="phone"
                  aria-label="Mobile Number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone)
                      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  className={cn(
                    'shadow-2xs h-11 rounded-xl text-sm transition-colors',
                    fieldErrors.phone && 'border-destructive focus-visible:ring-destructive',
                  )}
                />
              </div>
            </div>
            {fieldErrors.phone ? (
              <p className="text-destructive mt-1 text-xs">{fieldErrors.phone}</p>
            ) : (
              <p className="text-caption text-muted-foreground mt-1">
                For venue coordination and on-the-day entrance updates.
              </p>
            )}
          </div>
        </div>

        {/* Security & Multi-Pass Notice */}
        <div className="border-info/30 bg-info-subtle/60 flex items-center gap-3.5 rounded-2xl border p-4">
          <div className="bg-info-subtle text-info flex size-9 shrink-0 items-center justify-center rounded-xl">
            <ShieldCheck className="size-5 stroke-[2]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-bold">
              {passCount === 1
                ? 'Individual verified pass'
                : `${passCount} Unique Passes Generated`}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {passCount === 1
                ? 'A unique verification code will be assigned to verify authenticity at the entrance.'
                : 'Each pass receives its own unique entry code and will be downloadable together in a single ticket sheet file.'}
            </p>
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
              className="size-4.5 border-border-strong text-primary focus:ring-primary mt-0.5 rounded-[4px]"
            />
            <span className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
              I agree to the{' '}
              <Link
                href="/terms"
                target="_blank"
                className="text-primary hover:text-primary font-semibold underline underline-offset-2"
              >
                Terms of Use
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy-policy"
                target="_blank"
                className="text-primary hover:text-primary font-semibold underline underline-offset-2"
              >
                Privacy Policy
              </Link>{' '}
              of Sailent Foundation. <span className="text-destructive">*</span>
            </span>
          </label>
          {fieldErrors.consent ? (
            <p className="text-destructive mt-1 text-xs">{fieldErrors.consent}</p>
          ) : null}
        </div>

        {/* Fee & Payment breakdown */}
        {isPaid && feeAmount && feeAmount > 0 ? (
          <div className="border-primary/80 bg-accent/70 flex items-center justify-between rounded-2xl border p-4">
            <div>
              <p className="text-caption text-primary font-bold uppercase tracking-wider">
                Registration Fee ({passCount} {passCount === 1 ? 'Pass' : 'Passes'})
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                ₹{Math.round(feeAmount / 100)} × {passCount} • Secure Razorpay payment
              </p>
            </div>
            <div className="text-right">
              <span className="font-display text-foreground text-xl font-black sm:text-2xl">
                ₹{Math.round((totalPayableFee || 0) / 100)}
              </span>
              <span className="text-muted-foreground block text-[11px] font-medium">
                {passCount} {passCount === 1 ? 'attendee' : 'attendees'}
              </span>
            </div>
          </div>
        ) : (
          <div className="border-border/80 bg-background/70 flex items-center justify-between rounded-2xl border p-3.5 px-4">
            <div>
              <p className="text-caption text-muted-foreground font-bold uppercase tracking-wider">
                Registration Fee ({passCount} {passCount === 1 ? 'Pass' : 'Passes'})
              </p>
              <p className="text-muted-foreground text-xs">Free admission for this event</p>
            </div>
            <span className="bg-success-subtle text-success ring-success/30 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1">
              Free Entry
            </span>
          </div>
        )}

        {/* Confirm Registration Button */}
        <div>
          <Button
            type="submit"
            disabled={isSubmitting || !isEmailVerified}
            className={cn(
              'h-12 w-full rounded-full text-base font-bold shadow-sm transition-all',
              isEmailVerified
                ? 'bg-action text-action-foreground hover:bg-action-hover active:bg-action-active cursor-pointer'
                : 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed',
            )}
          >
            {isSubmitting ? (
              <span>
                {isPaid && totalPayableFee && totalPayableFee > 0
                  ? 'Processing Payment…'
                  : 'Securing your seats…'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span>
                  {isPaid && totalPayableFee && totalPayableFee > 0
                    ? `Pay ₹${Math.round(totalPayableFee / 100)} & Book ${passCount} ${passCount === 1 ? 'Pass' : 'Passes'}`
                    : `Confirm Registration (${passCount} ${passCount === 1 ? 'Pass' : 'Passes'})`}
                </span>
                <ArrowRight className="size-4.5" aria-hidden="true" />
              </span>
            )}
          </Button>
          {!isEmailVerified ? (
            <p className="text-muted-foreground mt-2 text-center text-xs">
              Please send OTP to your email and validate it to activate the registration button.
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
