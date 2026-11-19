'use client';

import * as React from 'react';
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Headphones,
  Mail,
  MapPin,
  Phone,
  Ticket,
  Users,
  Sparkles,
} from 'lucide-react';
import { Card, cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { SailentEvent } from '@/lib/mock/types';

import type { CardAction } from './events-query';

interface EventSummaryCardProps {
  event: SailentEvent;
  /** The programme's area; an event without a programme shows none. */
  categoryName?: string | null;
  /** The organisation's own contact details; a row is shown only for what it has. */
  supportEmail?: string | null;
  supportPhone?: string | null;
  /** A complete `tel:` link. */
  supportPhoneHref?: string | null;
  seatsLeft?: number | null;
  /** The shared rule's answer for this event (`cardAction`), as its card on /events gives. */
  availability: CardAction['kind'];
  /** The event page's canonical address, so the share links render the same on server and client. */
  shareUrl: string;
}

export function EventSummaryCard({
  event,
  categoryName = null,
  supportEmail = null,
  supportPhone = null,
  supportPhoneHref = null,
  seatsLeft,
  availability,
  shareUrl,
}: EventSummaryCardProps) {
  const [copied, setCopied] = React.useState(false);

  const startDate = new Date(event.startsAt);
  const dateFormatted = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(startDate);
  const dayName = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    timeZone: 'Asia/Kolkata',
  }).format(startDate);

  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
  const startTime = timeFormatter.format(startDate);
  const endTime = event.endsAt ? timeFormatter.format(new Date(event.endsAt)) : null;
  const timeStr = endTime ? `${startTime} – ${endTime}` : startTime;

  const venue = event.venueName || event.address || 'Venue to be confirmed';
  const locationSub = event.city || 'India';

  const handleCopy = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getShareUrl = (platform: 'facebook' | 'whatsapp') => {
    const url = encodeURIComponent(shareUrl);
    const title = encodeURIComponent(`Register for ${event.title} with Sailent Foundation`);

    switch (platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${title}%20${url}`;
    }
  };

  const STATUS: Record<
    CardAction['kind'],
    {
      label: string;
      text: string;
      containerClass: string;
      dotClass: string;
      labelClass: string;
      textClass: string;
    }
  > = {
    register: {
      label: 'Registration open',
      text: `${seatsLeft != null && seatsLeft > 0 ? `${seatsLeft} places left` : 'Places available'} · One registration reserves one seat.`,
      containerClass: 'border-emerald-200/80 bg-[#EAF7EE]',
      dotClass: 'bg-emerald-500',
      labelClass: 'text-emerald-950',
      textClass: 'text-emerald-800',
    },
    full: {
      label: 'Event full',
      text: 'Every place has been taken. Places may open if someone cancels.',
      containerClass: 'border-amber-200/80 bg-amber-50/80',
      dotClass: 'bg-amber-500',
      labelClass: 'text-amber-950',
      textClass: 'text-amber-800',
    },
    closed: {
      label: 'Registration closed',
      text: 'Registration for this event is not open.',
      containerClass: 'border-rose-200/80 bg-rose-50/80',
      dotClass: 'bg-rose-500',
      labelClass: 'text-rose-950',
      textClass: 'text-rose-800',
    },
    cancelled: {
      label: 'Cancelled',
      text: 'This event has been cancelled and will not take place.',
      containerClass: 'border-rose-200/80 bg-rose-50/80',
      dotClass: 'bg-rose-500',
      labelClass: 'text-rose-950',
      textClass: 'text-rose-800',
    },
    finished: {
      label: 'Past event',
      text: 'This event has concluded. Please check other upcoming events.',
      containerClass: 'border-slate-200 bg-slate-100/80',
      dotClass: 'bg-slate-400',
      labelClass: 'text-slate-800',
      textClass: 'text-slate-600',
    },
  };
  const status = STATUS[availability];
  const hasHelp = Boolean(supportEmail || (supportPhone && supportPhoneHref));

  return (
    <Card className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-7">
      {/* Event Thumbnail with Category Badge in Bottom Right */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
        <MediaFrame
          media={event.cover}
          aspect="video"
          priority={false}
          className="aspect-[16/10] w-full object-cover"
        />
        {categoryName ? (
          <div className="absolute bottom-3 right-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EB6A1F] px-3.5 py-1 text-xs font-bold text-white shadow-md">
              <Users className="size-3.5 text-white" aria-hidden="true" />
              {categoryName}
            </span>
          </div>
        ) : null}
      </div>

      {/* Title and Short Description */}
      <div className="mt-5">
        <h3 className="font-display text-xl font-extrabold leading-snug text-slate-900 sm:text-2xl">
          {event.title}
        </h3>
        {event.summary ? (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{event.summary}</p>
        ) : null}
      </div>

      {/* Details list with peach/orange rounded icon boxes */}
      <div className="mt-6 space-y-4 border-t border-slate-100 pt-5 text-sm">
        {/* Date */}
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-orange-100/70 bg-orange-50 text-[#EB6A1F]">
            <Calendar className="size-4.5 stroke-[2]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
              DATE
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900" data-numeric="">
              {dateFormatted} <span className="font-normal text-slate-500">({dayName})</span>
            </p>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-orange-100/70 bg-orange-50 text-[#EB6A1F]">
            <Clock className="size-4.5 stroke-[2]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
              TIME
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900" data-numeric="">
              {timeStr}
            </p>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-orange-100/70 bg-orange-50 text-[#EB6A1F]">
            <MapPin className="size-4.5 stroke-[2]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
              LOCATION
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {venue}{' '}
              {locationSub ? (
                <span className="font-normal text-slate-500">({locationSub})</span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Fee / Pricing */}
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-orange-100/70 bg-orange-50 text-[#EB6A1F]">
            <Ticket className="size-4.5 stroke-[2]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
              REGISTRATION FEE
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {event.isPaid && event.feeAmount ? (
                <span>
                  ₹{Math.round(event.feeAmount / 100)}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    per person (Online payment)
                  </span>
                </span>
              ) : (
                <span>Free Entry</span>
              )}
            </p>
          </div>
        </div>

        {/* Category */}
        {categoryName ? (
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-orange-100/70 bg-orange-50 text-[#EB6A1F]">
              <Users className="size-4.5 stroke-[2]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
                CATEGORY
              </p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">{categoryName}</p>
            </div>
          </div>
        ) : null}

        {/* Activities / Functions */}
        {event.functions && event.functions.length > 0 ? (
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-orange-100/70 bg-orange-50 text-[#EB6A1F]">
              <Sparkles className="size-4.5 stroke-[2]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
                ACTIVITIES / FUNCTIONS
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {event.functions.map((fn) => (
                  <span
                    key={fn}
                    className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-xs font-semibold text-[#EB6A1F] ring-1 ring-orange-200/80"
                  >
                    {fn}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Registration Status section */}
      <div
        className={cn(
          'sm:p-4.5 mt-6 rounded-2xl border p-4 transition-colors',
          status.containerClass,
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn('size-2.5 shrink-0 rounded-full', status.dotClass)}
            aria-hidden="true"
          />
          <span className={cn('text-sm font-bold', status.labelClass)}>{status.label}</span>
        </div>
        <p className={cn('mt-1 text-xs sm:text-sm', status.textClass)}>{status.text}</p>
      </div>

      {/* Need Help? & Share section */}
      <div
        className={cn(
          'mt-6 grid gap-4 border-t border-slate-100 pt-5',
          hasHelp ? 'grid-cols-1 sm:grid-cols-[1.1fr_0.9fr]' : 'grid-cols-1',
        )}
      >
        {/* Need Help */}
        {hasHelp ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Headphones className="size-3.5 text-slate-500" aria-hidden="true" />
              <span>Need Help?</span>
            </div>
            <div className="mt-1.5 space-y-1.5 text-xs text-slate-600 sm:text-[13px]">
              {supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="flex items-center gap-1.5 transition-colors hover:text-[#EB6A1F]"
                >
                  <Mail className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="truncate">{supportEmail}</span>
                </a>
              ) : null}
              {supportPhone && supportPhoneHref ? (
                <a
                  href={supportPhoneHref}
                  className="flex items-center gap-1.5 transition-colors hover:text-[#EB6A1F]"
                >
                  <Phone className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span>{supportPhone}</span>
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Share this event */}
        <div className={cn(hasHelp && 'sm:border-l sm:border-slate-100 sm:pl-4')}>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Share this event
          </h4>
          <div className="mt-2 flex items-center gap-2">
            {/* Facebook */}
            <a
              href={getShareUrl('facebook')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on Facebook"
              className="shadow-xs flex size-8 items-center justify-center rounded-full bg-[#1877F2] text-white transition-transform hover:scale-105 hover:bg-[#166FE5]"
            >
              <svg className="size-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
            </a>

            {/* WhatsApp */}
            <a
              href={getShareUrl('whatsapp')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on WhatsApp"
              className="shadow-xs flex size-8 items-center justify-center rounded-full bg-[#25D366] text-white transition-transform hover:scale-105 hover:bg-[#20ba5a]"
            >
              <svg className="size-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.772.84 2.791.84 3.18 0 5.767-2.586 5.768-5.766.001-3.18-2.585-5.826-5.768-5.826zm3.377 8.21c-.14.394-.712.75-1.021.799-.28.045-.646.064-1.844-.431-1.428-.59-2.355-2.029-2.426-2.124-.07-.095-.572-.76-.572-1.45 0-.69.362-1.03.49-1.171.129-.141.282-.176.376-.176.094 0 .188.002.27.006.088.005.206-.033.322.247.12.289.41 1.002.446 1.074.035.072.059.156.012.25-.047.094-.07.153-.141.236-.07.082-.149.184-.212.247-.07.07-.143.146-.061.287.082.141.365.602.784.975.54.481.996.63 1.137.7.141.07.223.059.306-.035.082-.094.353-.411.447-.552.094-.141.188-.118.317-.07.129.047.822.388.963.458.141.07.235.106.27.165.035.059.035.342-.106.736z" />
              </svg>
            </a>

            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy Link"
              className="shadow-xs flex size-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition-transform hover:scale-105 hover:border-[#EB6A1F] hover:text-[#EB6A1F]"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
          {copied ? (
            <p className="mt-1 text-[0.625rem] font-semibold text-emerald-600">
              Copied to clipboard!
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
