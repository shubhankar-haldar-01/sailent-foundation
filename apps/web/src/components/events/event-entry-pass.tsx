'use client';

import * as React from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

import { cn } from '@sailent/ui';

export interface EventEntryPassProps {
  passNumber: string;
  eventTitle: string;
  startsAt: string;
  endsAt?: string | null;
  venueName?: string | null;
  city?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  isPaid?: boolean;
  feeAmount?: number | null;
  registeredAt?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  functionName?: string | null;
  attendees?: { fullName: string; passNumber?: string }[] | null;
  className?: string;
}

/**
 * Standard ISO QR Code generator (Error Correction Level M).
 * Generates official finder patterns, alignment, timing rows, and real data payload.
 */
function PassQrCode({ value, className }: { value: string; className?: string }) {
  const qr = React.useMemo(() => {
    try {
      return QRCode.create(value, { errorCorrectionLevel: 'M' });
    } catch {
      return null;
    }
  }, [value]);

  const size = qr ? qr.modules.size : 21;
  const rects: React.ReactNode[] = [];
  if (qr) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (qr.modules.get(r, c)) {
          rects.push(
            <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="currentColor" />,
          );
        }
      }
    }
  }

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="shadow-2xs relative rounded-lg border border-slate-200/90 bg-white p-2 print:border-slate-300 print:shadow-none">
        {/* Optical corner reticle brackets */}
        <span className="border-t-1.5 border-l-1.5 pointer-events-none absolute left-1 top-1 size-1.5 border-[#EB6A1F]" />
        <span className="border-t-1.5 border-r-1.5 pointer-events-none absolute right-1 top-1 size-1.5 border-[#EB6A1F]" />
        <span className="border-b-1.5 border-l-1.5 pointer-events-none absolute bottom-1 left-1 size-1.5 border-[#EB6A1F]" />
        <span className="border-r-1.5 border-b-1.5 pointer-events-none absolute bottom-1 right-1 size-1.5 border-[#EB6A1F]" />
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="sm:size-22 size-20 text-slate-900"
          shapeRendering="crispEdges"
          aria-label={`QR verification code for pass ${value}`}
        >
          {rects}
        </svg>
      </div>
      <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-slate-500 print:text-slate-700">
        Scan at Entrance
      </span>
    </div>
  );
}

/**
 * Official circular verification seal stamp.
 */
function OfficialSeal({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-18 relative flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[#EB6A1F]/80 bg-orange-50/60 p-1 text-[#EB6A1F] sm:size-20 print:border-[#EB6A1F] print:bg-white',
        className,
      )}
    >
      <div className="flex size-full flex-col items-center justify-center rounded-full border border-orange-200/90 text-center">
        <CheckCircle2 className="size-4 stroke-[2.5] text-[#EB6A1F]" />
        <span className="mt-0.5 text-[7.5px] font-black uppercase tracking-wider text-[#EB6A1F]">
          VERIFIED
        </span>
        <span className="text-[6px] font-bold uppercase tracking-tight text-slate-700">
          SAILENT PASS
        </span>
      </div>
    </div>
  );
}

/**
 * Market-standard Official Event Entry Pass.
 * Engineered for single-page print layout and premium on-screen appearance.
 * Supports multi-pass switching when multiple passes are booked in one reservation.
 */
export function EventEntryPass({
  passNumber,
  eventTitle,
  startsAt,
  endsAt,
  venueName,
  city,
  fullName,
  email,
  phone,
  isPaid = false,
  feeAmount = null,
  registeredAt,
  supportEmail = 'contact@sailent.org',
  supportPhone = '+91 94707 98254',
  functionName,
  attendees,
  className,
}: EventEntryPassProps) {
  const [copied, setCopied] = React.useState(false);
  const [activePassIndex, setActivePassIndex] = React.useState(0);

  // Build full attendee pass list
  const attendeeList = React.useMemo(() => {
    if (attendees && attendees.length > 0) {
      return attendees.map((att, idx) => ({
        fullName: att.fullName?.trim() || (idx === 0 ? fullName : `Attendee ${idx + 1}`),
        passNumber:
          att.passNumber || (attendees.length > 1 ? `${passNumber}-${idx + 1}` : passNumber),
        seatIndex: idx + 1,
      }));
    }
    return [
      {
        fullName: fullName || 'Guest Attendee',
        passNumber,
        seatIndex: 1,
      },
    ];
  }, [attendees, fullName, passNumber]);

  const totalPasses = attendeeList.length;
  const fallbackPass = {
    fullName: fullName || 'Guest Attendee',
    passNumber,
    seatIndex: 1,
  };
  const activePass = attendeeList[activePassIndex] ?? attendeeList[0] ?? fallbackPass;
  const currentPassNumber = activePass.passNumber;

  const copyPassCode = () => {
    navigator.clipboard?.writeText(currentPassNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(startsAt));

  const startTimeStr = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(startsAt));

  const endTimeStr = endsAt
    ? new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }).format(new Date(endsAt))
    : null;

  const timeRange = endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr;

  const issueDateStr = registeredAt
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(registeredAt))
    : new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date());

  return (
    <div className="flex flex-col gap-3">
      {/* Multi-Pass Selector Tabs (if more than 1 pass booked) */}
      {totalPasses > 1 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-orange-200/80 bg-orange-50/50 p-2.5 print:hidden">
          <span className="text-xs font-bold text-slate-700">Viewing Pass:</span>
          {attendeeList.map((att, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActivePassIndex(idx)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all',
                activePassIndex === idx
                  ? 'shadow-xs bg-[#EB6A1F] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              <span>
                Pass {idx + 1}: {att.fullName}
              </span>
            </button>
          ))}
          <span className="ml-auto text-[11px] font-medium text-slate-500">
            Total {totalPasses} Passes Booked
          </span>
        </div>
      ) : null}

      <div
        id="printable-event-pass"
        className={cn(
          'relative overflow-hidden rounded-2xl border-2 border-slate-300 bg-white text-slate-900 shadow-sm sm:rounded-3xl',
          'print:m-0 print:mx-auto print:w-full print:max-w-[760px] print:rounded-2xl print:border-2 print:border-slate-800 print:p-0 print:shadow-none',
          'break-inside-avoid print:break-inside-avoid',
          className,
        )}
      >
        {/* Top Banner: NGO Branding & Official Document Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-slate-200/90 bg-slate-50/70 p-5 sm:p-6 print:border-slate-400 print:bg-white print:p-4">
          <div className="flex items-center gap-3.5">
            <Image
              src="/images/sailent-logo.png"
              alt="Sailent Foundation"
              width={180}
              height={46}
              priority
              className="h-8 w-auto object-contain sm:h-9"
            />
            <div className="hidden border-l border-slate-300 pl-3 sm:block print:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                Sailent Foundation
              </p>
              <p className="text-[9px] font-semibold text-slate-500">
                Section 12A &amp; 80G Registered NGO
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 print:bg-white print:ring-emerald-500">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span>CONFIRMED ADMISSION</span>
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Official Event Entry Pass
            </span>
          </div>
        </div>

        {/* Ticket Cutout Line Effect with Perforations */}
        <div className="relative border-b border-dashed border-slate-300 bg-white px-5 py-4 sm:px-6 print:border-slate-400 print:py-3">
          {/* Left and Right Notches */}
          <div
            aria-hidden="true"
            className="absolute -left-3 top-1/2 size-5 -translate-y-1/2 rounded-full border-r-2 border-slate-300 bg-[#F8FAFC] print:hidden"
          />
          <div
            aria-hidden="true"
            className="absolute -right-3 top-1/2 size-5 -translate-y-1/2 rounded-full border-l-2 border-slate-300 bg-[#F8FAFC] print:hidden"
          />

          {/* Pass ID Hero Bar */}
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50/90 via-orange-50/50 to-amber-50/40 p-3.5 sm:flex-row sm:items-center sm:p-4 print:border-orange-300 print:bg-orange-50/40">
            <div>
              <div className="text-caption flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-600">
                <Sparkles className="size-3.5 text-[#EB6A1F]" />
                <span>Unique Pass ID / Entry Code</span>
              </div>
              <p className="mt-0.5 font-mono text-xl font-black tracking-widest text-[#EB6A1F] sm:text-2xl print:text-black">
                {currentPassNumber}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-orange-200 sm:text-xs print:ring-slate-300">
                {totalPasses > 1
                  ? `Pass ${activePass.seatIndex} of ${totalPasses}`
                  : '1 Seat Reserved'}
              </span>
              <button
                type="button"
                onClick={copyPassCode}
                className="shadow-2xs inline-flex h-8 items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-[#EB6A1F] print:hidden"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Body: Event & Attendee Details Grid + Security Check-In Column */}
        <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 lg:grid-cols-12 lg:gap-6 print:grid-cols-12 print:gap-4 print:p-4">
          {/* Left Column (8 cols): Event, Attendee, Venue, Fee info */}
          <div className="space-y-4 lg:col-span-8 print:col-span-8">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-caption font-bold uppercase tracking-wider text-[#EB6A1F]">
                  Event Title
                </span>
                {functionName ? (
                  <span className="inline-flex items-center rounded-md bg-orange-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#EB6A1F]">
                    Activity: {functionName}
                  </span>
                ) : null}
              </div>
              <h2 className="font-display mt-0.5 text-lg font-bold text-slate-900 sm:text-xl print:text-lg">
                {eventTitle}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2">
              {/* Date & Time */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 print:border-slate-300 print:bg-white">
                <div className="text-caption flex items-center gap-1.5 font-semibold text-slate-600">
                  <Calendar className="size-3.5 text-[#EB6A1F]" />
                  <span>Date &amp; Schedule</span>
                </div>
                <p className="mt-1 font-bold text-slate-900">{formattedDate}</p>
                <p className="flex items-center gap-1 text-xs text-slate-600">
                  <Clock className="size-3 text-slate-400" />
                  <span>{timeRange} (IST)</span>
                </p>
              </div>

              {/* Venue & Location */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 print:border-slate-300 print:bg-white">
                <div className="text-caption flex items-center gap-1.5 font-semibold text-slate-600">
                  <MapPin className="size-3.5 text-[#EB6A1F]" />
                  <span>Venue &amp; Location</span>
                </div>
                <p className="mt-1 font-bold text-slate-900">
                  {venueName || city || 'Venue to be confirmed'}
                </p>
                <p className="text-xs text-slate-600">
                  {city ? `${city}, India` : 'Physical Event'}
                </p>
              </div>

              {/* Attendee Name */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 print:border-slate-300 print:bg-white">
                <div className="text-caption flex items-center gap-1.5 font-semibold text-slate-600">
                  <User className="size-3.5 text-[#EB6A1F]" />
                  <span>Registered Attendee</span>
                </div>
                <p className="mt-1 font-bold text-slate-900">{activePass.fullName}</p>
                <p className="text-xs text-slate-600">
                  {functionName
                    ? `${functionName} • Seat ${activePass.seatIndex} of ${totalPasses}`
                    : email || phone || `Seat ${activePass.seatIndex} of ${totalPasses}`}
                </p>
              </div>

              {/* Fee & Payment Status */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 print:border-slate-300 print:bg-white">
                <div className="text-caption flex items-center gap-1.5 font-semibold text-slate-600">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  <span>Admission Fee</span>
                </div>
                <p className="mt-1 font-bold text-slate-900">
                  {isPaid && feeAmount ? `Paid ₹${Math.round(feeAmount / 100)}` : 'Free Entry Pass'}
                </p>
                <p className="text-xs font-semibold text-emerald-700">
                  {isPaid ? 'Payment Verified (Online)' : 'Complimentary NGO Entry'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Security Verification Box (QR + Seal + Pass ID) */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-center lg:col-span-4 print:col-span-4 print:border-slate-300 print:bg-white print:p-2.5">
            {/* Upper Tier: QR Code on left & Official Seal + Valid Badge on right */}
            <div className="flex items-center justify-around gap-2">
              <PassQrCode value={currentPassNumber} />
              <div className="flex flex-col items-center gap-2">
                <OfficialSeal />
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-700 print:border-emerald-300">
                  <Check className="size-2.5 stroke-[3]" />
                  VALID ENTRY
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="my-2.5 border-t border-dashed border-slate-200 print:border-slate-300" />

            {/* Lower Tier: the pass ID, typed in at the gate if the QR cannot be read */}
            <div className="flex flex-col items-center">
              <span className="font-mono text-xs font-bold tracking-[0.25em] text-slate-800 sm:text-sm print:text-black">
                {currentPassNumber}
              </span>
              <span className="mt-1 text-[7.5px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500">
                Pass ID • Non-Transferable
              </span>
            </div>
          </div>
        </div>

        {/* Mandatory Check-in Guidelines & Industry-Standard Entry Rules */}
        <div className="border-t border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 print:border-slate-300 print:bg-white print:p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
            <AlertCircle className="size-3.5 text-[#EB6A1F]" />
            <span>Important Check-in Guidelines &amp; Entry Terms</span>
          </div>
          <ol className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] leading-relaxed text-slate-600 sm:grid-cols-2 print:grid-cols-2 print:text-[10px]">
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-slate-800">1.</span>
              <span>
                <strong>Photo ID Required:</strong> Please carry a valid Govt. photo ID matching the
                attendee name.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-slate-800">2.</span>
              <span>
                <strong>Non-Transferable:</strong> Admits exactly 1 person and cannot be exchanged,
                transferred, or resold.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-slate-800">3.</span>
              <span>
                <strong>Check-in Desk:</strong> Present this physical printout or display the
                digital pass on your phone at entry.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-slate-800">4.</span>
              <span>
                <strong>Reporting Time:</strong> Gates open 30 minutes prior to start. Right of
                admission is reserved by Sailent Foundation.
              </span>
            </li>
          </ol>
        </div>

        {/* Footer Strip: NGO Statutory Details & Verification Hash */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 text-[10px] text-slate-500 print:rounded-b-2xl print:border-slate-300 print:px-4 print:py-2.5">
          <div>
            <span className="font-semibold text-slate-700">Sailent Foundation</span> • Support:{' '}
            <span className="font-mono text-slate-700">{supportEmail}</span>
            {supportPhone ? (
              <>
                {' '}
                | <span className="font-mono text-slate-700">{supportPhone}</span>
              </>
            ) : null}
          </div>
          <div>
            <span>Issued on {issueDateStr} • Computer-generated valid entry document</span>
          </div>
        </div>
      </div>
    </div>
  );
}
