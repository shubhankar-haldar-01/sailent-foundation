'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { Alert, Button, Card, Input, Label, cn } from '@sailent/ui';

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
      cancelled: { label: 'Event Cancelled', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
      finished: {
        label: 'Event Concluded',
        className: 'bg-slate-100 text-slate-700 ring-slate-200',
      },
      full: { label: 'Event Full', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
      closed: {
        label: 'Registration Closed',
        className: 'bg-rose-50 text-rose-700 ring-rose-200',
      },
    }[state];

    return (
      <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
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
        <h2 className="font-display mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
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
        className="pass-outer-card print:border-none! print:bg-transparent! print:shadow-none! rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8 print:m-0 print:border-0 print:p-0"
      >
        <div className="flex items-center gap-3.5 print:hidden">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50">
            <CheckCircle2 className="size-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-caption inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 px-2.5 py-0.5 font-bold text-emerald-800">
              Admission Confirmed
            </span>
            <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
              You are registered
            </h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600 print:hidden">
          We look forward to seeing you at <strong className="text-slate-900">{eventTitle}</strong>.
          Your reservation confirmation has been registered with our team.
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

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6 print:hidden">
          <Button
            type="button"
            onClick={() => handleDownloadPass(existingPassCode)}
            disabled={isDownloading}
            className="gap-2 rounded-full bg-[#EB6A1F] text-xs font-bold text-white shadow-sm hover:bg-[#D45914] sm:text-sm"
          >
            {downloaded ? (
              <>
                <Check className="size-4 text-white" />
                <span>Pass Downloaded!</span>
              </>
            ) : isDownloading ? (
              <>
                <Loader2 className="size-4 animate-spin text-white" />
                <span>Downloading Pass...</span>
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
              className="rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 sm:text-sm"
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
        className="pass-outer-card print:border-none! print:bg-transparent! print:shadow-none! overflow-hidden rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8 lg:p-9 print:m-0 print:border-0 print:p-0"
      >
        <div className="flex items-center gap-3.5 print:hidden">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50">
            <CheckCircle2 className="size-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-caption inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 px-2.5 py-0.5 font-bold text-emerald-800">
              Registration Successful
            </span>
            <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
              Registration Confirmed!
            </h2>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600 print:hidden">
          Your reservation is secured for <strong className="text-slate-900">{eventTitle}</strong>{' '}
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

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6 print:hidden">
          <Button
            type="button"
            onClick={() => handleDownloadPass(passNumber)}
            disabled={isDownloading}
            className="gap-2 rounded-full bg-[#EB6A1F] text-xs font-bold text-white shadow-sm hover:bg-[#D45914] sm:text-sm"
          >
            {downloaded ? (
              <>
                <Check className="size-4 text-white" />
                <span>
                  {effectiveAttendees.length > 1 ? 'All Passes Downloaded!' : 'Pass Downloaded!'}
                </span>
              </>
            ) : isDownloading ? (
              <>
                <Loader2 className="size-4 animate-spin text-white" />
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
              className="rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 sm:text-sm"
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
        setOtpSuccessMessage('Email verified successfully! Registration is now active.');
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
    <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8 lg:p-9">
      {/* Header with Eyebrow Badge */}
      <div className="flex items-center gap-2">
        <span className="text-caption inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 font-bold uppercase tracking-wider text-[#EB6A1F]">
          <Sparkles className="size-3 text-[#EB6A1F]" aria-hidden="true" />
          Event Registration
        </span>
      </div>

      <div className="mt-3">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Reserve your place
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Join us for this meaningful event and be part of a community that cares. You can book up
          to 4 passes for your family or friends with a single registration contact.
        </p>
      </div>

      {/* Account Status / Helper for return donors */}
      {!isSignedIn ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-xs text-slate-600 sm:text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Open registration • No account required</span>
          </div>
          <div className="text-xs">
            <span>Already a donor? </span>
            <Link
              href={signInHref || `/sign-in?next=/events/${slug}`}
              className="font-semibold text-[#EB6A1F] underline underline-offset-2 hover:text-[#D45914]"
            >
              Sign in to register
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <UserCheck className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-emerald-900">
                  Signed in as{' '}
                  <span className="font-bold">{initialProfile?.fullName || 'Verified Donor'}</span>
                </p>
                {initialProfile?.email ? (
                  <p className="truncate text-xs text-emerald-700">{initialProfile.email}</p>
                ) : null}
              </div>
            </div>
            <span className="text-caption inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
              Account Active
            </span>
          </div>
        </div>
      )}

      {/* Server error banner */}
      {serverState.error ? (
        <Alert variant="destructive" className="mt-5 rounded-2xl" role="alert">
          <div className="flex flex-col gap-2">
            <span>{serverState.error}</span>
          </div>
        </Alert>
      ) : null}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
        {/* 1. Activity / Function Selection (if event offers activities, e.g. Champaran Mahotsav: Dance, Singing, Running) */}
        {availableFunctions.length > 0 ? (
          <div className="rounded-2xl border border-orange-200/80 bg-orange-50/40 p-4 sm:p-5">
            <Label className="text-sm font-bold text-slate-900">
              Select Activity / Function <span className="text-red-500">*</span>
            </Label>
            <p className="mt-0.5 text-xs text-slate-600">
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
                        ? 'bg-[#EB6A1F] text-white shadow-sm ring-2 ring-[#EB6A1F]/30'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50/50',
                    )}
                  >
                    {isSelected ? <Check className="size-4 stroke-[3]" /> : null}
                    <span>{fn}</span>
                  </button>
                );
              })}
            </div>
            {fieldErrors.functionName ? (
              <p className="mt-2 text-xs text-red-600">{fieldErrors.functionName}</p>
            ) : null}
          </div>
        ) : null}

        {/* 2. Number of Passes Selector (1 to 4 passes) */}
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label className="text-sm font-bold text-slate-900">
                Number of Passes <span className="text-red-500">*</span>
              </Label>
              <p className="mt-0.5 text-xs text-slate-600">
                Book up to 4 passes in a single reservation.
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
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
                        ? 'shadow-xs bg-[#EB6A1F] text-white'
                        : 'text-slate-700 hover:bg-slate-100',
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
            <Users className="size-4 text-[#EB6A1F]" />
            <h3 className="text-sm font-bold text-slate-900">
              {passCount === 1 ? 'Attendee Details' : `Attendee Names (${passCount} Passes)`}
            </h3>
          </div>

          <div className="space-y-3">
            {Array.from({ length: passCount }).map((_, idx) => (
              <div key={idx}>
                <Label
                  htmlFor={`attendee-name-${idx}`}
                  className="text-xs font-semibold text-slate-700"
                >
                  {passCount === 1
                    ? 'Full Name'
                    : `Pass ${idx + 1} Attendee Name ${idx === 0 ? '(Primary Contact)' : ''}`}{' '}
                  <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
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
                      fieldErrors.attendees?.[idx] && 'border-red-500 focus-visible:ring-red-400',
                    )}
                  />
                </div>
                {fieldErrors.attendees?.[idx] ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.attendees[idx]}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Primary Contact Information (1 Email + 1 Phone for all passes) */}
        <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Booking Contact Information
          </h3>

          {/* Email Address with Send OTP & Validation */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="reg-email" className="text-sm font-semibold text-slate-800">
                Email Address <span className="text-red-500">*</span>
              </Label>
              {isEmailVerified ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <Check className="size-3.5 stroke-[2.5]" />
                  <span>Verified</span>
                </span>
              ) : null}
            </div>

            <div className="relative mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
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
                    fieldErrors.email && 'border-red-500 focus-visible:ring-red-400',
                    isEmailVerified &&
                      'border-emerald-300 bg-emerald-50/40 font-medium text-slate-800',
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
                  className="h-11 shrink-0 rounded-xl border border-orange-200 bg-orange-50/60 px-4 text-xs font-bold text-[#EB6A1F] hover:bg-orange-100/70"
                >
                  {isSendingOtp ? 'Sending…' : isOtpSent ? 'Resend OTP' : 'Send OTP'}
                </Button>
              ) : !isSignedIn ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetEmail}
                  className="h-11 shrink-0 rounded-xl px-3 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Change
                </Button>
              ) : null}
            </div>

            {fieldErrors.email ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            ) : (
              <p className="text-caption mt-1 text-slate-500">
                {isEmailVerified
                  ? 'Your email is verified. All passes will be delivered here.'
                  : 'Click "Send OTP" to receive a verification code on your email.'}
              </p>
            )}

            {/* OTP Verification Panel */}
            {isOtpSent && !isEmailVerified ? (
              <div className="mt-3 rounded-2xl border border-orange-200/90 bg-orange-50/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Enter 6-digit Code sent to <strong className="text-slate-900">{email}</strong>
                  </span>
                  {resendCountdown > 0 ? (
                    <span className="text-xs text-slate-500">Resend in {resendCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                      className="text-xs font-bold text-[#EB6A1F] underline underline-offset-2 hover:text-[#D45914]"
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
                    className="shadow-2xs h-10 w-36 rounded-xl border-orange-200 bg-white text-center font-mono text-lg font-bold tracking-widest text-slate-900 focus-visible:ring-[#EB6A1F]"
                  />
                  <Button
                    type="button"
                    disabled={otpCode.length !== 6 || isVerifyingOtp}
                    onClick={handleVerifyOtp}
                    className="shadow-2xs h-10 rounded-xl bg-[#EB6A1F] px-4 text-xs font-bold text-white hover:bg-[#D45914]"
                  >
                    {isVerifyingOtp ? 'Verifying…' : 'Validate OTP'}
                  </Button>
                </div>

                {otpError ? (
                  <p className="mt-2 text-xs font-semibold text-red-600">{otpError}</p>
                ) : null}
                {otpSuccessMessage ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">{otpSuccessMessage}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Mobile Number */}
          <div>
            <Label htmlFor="reg-phone" className="text-sm font-semibold text-slate-800">
              Mobile Number <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-1.5 flex gap-2">
              <div className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 sm:text-sm">
                <Phone className="size-3.5 text-slate-400" aria-hidden="true" />
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
                    fieldErrors.phone && 'border-red-500 focus-visible:ring-red-400',
                  )}
                />
              </div>
            </div>
            {fieldErrors.phone ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
            ) : (
              <p className="text-caption mt-1 text-slate-500">
                For venue coordination and on-the-day entrance updates.
              </p>
            )}
          </div>
        </div>

        {/* Security & Multi-Pass Notice */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <ShieldCheck className="size-5 stroke-[2]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">
              {passCount === 1
                ? 'Individual verified pass'
                : `${passCount} Unique Passes Generated`}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
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
              className="size-4.5 mt-0.5 rounded-[4px] border-slate-300 text-[#EB6A1F] focus:ring-[#EB6A1F]"
            />
            <span className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              I agree to the{' '}
              <Link
                href="/terms"
                target="_blank"
                className="font-semibold text-[#EB6A1F] underline underline-offset-2 hover:text-[#D45914]"
              >
                Terms of Use
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy-policy"
                target="_blank"
                className="font-semibold text-[#EB6A1F] underline underline-offset-2 hover:text-[#D45914]"
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

        {/* Fee & Payment breakdown */}
        {isPaid && feeAmount && feeAmount > 0 ? (
          <div className="flex items-center justify-between rounded-2xl border border-orange-200/80 bg-orange-50/70 p-4">
            <div>
              <p className="text-caption font-bold uppercase tracking-wider text-[#EB6A1F]">
                Registration Fee ({passCount} {passCount === 1 ? 'Pass' : 'Passes'})
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                ₹{Math.round(feeAmount / 100)} × {passCount} • Secure Razorpay payment
              </p>
            </div>
            <div className="text-right">
              <span className="font-display text-xl font-black text-slate-900 sm:text-2xl">
                ₹{Math.round((totalPayableFee || 0) / 100)}
              </span>
              <span className="block text-[11px] font-medium text-slate-500">
                {passCount} {passCount === 1 ? 'attendee' : 'attendees'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 px-4">
            <div>
              <p className="text-caption font-bold uppercase tracking-wider text-slate-600">
                Registration Fee ({passCount} {passCount === 1 ? 'Pass' : 'Passes'})
              </p>
              <p className="text-xs text-slate-500">Free admission for this event</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
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
              'h-12 w-full rounded-full text-base font-bold shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EB6A1F]',
              isEmailVerified
                ? 'cursor-pointer bg-[#EB6A1F] text-white hover:bg-[#D45914]'
                : 'cursor-not-allowed bg-slate-200 text-slate-400 hover:bg-slate-200',
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
            <p className="mt-2 text-center text-xs text-slate-500">
              Please send OTP to your email and validate it to activate the registration button.
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
