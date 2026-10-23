'use client';

import * as React from 'react';
import { Calendar, Check, Clock, Copy, Headphones, Mail, MapPin, Phone, Users } from 'lucide-react';
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

  const venue = event.isOnline
    ? 'Online'
    : event.venueName || event.address || 'Venue to be confirmed';
  const locationSub = event.isOnline
    ? 'Joining link sent after registration'
    : event.city || 'India';

  const handleCopy = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getShareUrl = (platform: 'facebook' | 'x' | 'linkedin' | 'whatsapp') => {
    const url = encodeURIComponent(shareUrl);
    const title = encodeURIComponent(`Register for ${event.title} with Sailent Foundation`);

    switch (platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      case 'x':
        return `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${title}%20${url}`;
    }
  };

  const STATUS: Record<CardAction['kind'], { label: string; text: string }> = {
    register: {
      label: 'Registration open',
      text: `${seatsLeft != null && seatsLeft > 0 ? `${seatsLeft} places left` : 'Places available'} · One registration reserves one seat.`,
    },
    full: {
      label: 'Event full',
      text: 'Every place has been taken. Places may open if someone cancels.',
    },
    closed: { label: 'Registration closed', text: 'Registration for this event is not open.' },
    cancelled: {
      label: 'Cancelled',
      text: 'This event has been cancelled and will not take place.',
    },
    finished: {
      label: 'Past event',
      text: 'This event has concluded. Please check other upcoming events.',
    },
  };
  const status = STATUS[availability];
  const hasHelp = Boolean(supportEmail || (supportPhone && supportPhoneHref));

  return (
    <Card className="card-interactive overflow-hidden rounded-3xl p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
      {/* Event Thumbnail with Category Badge in Bottom Right */}
      <div className="relative overflow-hidden rounded-2xl">
        <MediaFrame
          media={event.cover}
          aspect="video"
          priority={false}
          className="aspect-[16/10] w-full object-cover"
        />
        {categoryName ? (
          <div className="absolute bottom-3 right-3">
            <span className="text-primary-foreground inline-flex items-center gap-1.5 rounded-full bg-[#EB6A1F] px-3.5 py-1 text-xs font-bold shadow-md">
              <Users className="size-3.5 text-white" aria-hidden="true" />
              {categoryName}
            </span>
          </div>
        ) : null}
      </div>

      {/* Title and Short Description */}
      <div className="mt-6">
        <h3 className="font-display text-xl font-extrabold leading-snug text-[#0A2540] sm:text-2xl">
          {event.title}
        </h3>
        {event.summary ? <p className="mt-1.5 text-sm text-slate-500">{event.summary}</p> : null}
      </div>

      {/* Details list with peach/orange rounded icon boxes */}
      <div className="mt-6 space-y-4 border-t border-slate-100 pt-6 text-sm">
        {/* Date */}
        <div className="flex items-center gap-3.5">
          <div className="text-primary flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E6]">
            <Calendar className="size-4.5 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-600">
              DATE
            </p>
            <p className="text-sm font-bold text-[#0A2540]" data-numeric="">
              {dateFormatted} <span className="font-normal text-slate-500">({dayName})</span>
            </p>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-center gap-3.5">
          <div className="text-primary flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E6]">
            <Clock className="size-4.5 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-600">
              TIME
            </p>
            <p className="text-sm font-bold text-[#0A2540]" data-numeric="">
              {timeStr}
            </p>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-3.5">
          <div className="text-primary flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E6]">
            <MapPin className="size-4.5 stroke-[2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-600">
              LOCATION
            </p>
            <p className="text-sm font-bold text-[#0A2540]">
              {venue}{' '}
              {locationSub ? (
                <span className="font-normal text-slate-500">({locationSub})</span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Category */}
        {categoryName ? (
          <div className="flex items-center gap-3.5">
            <div className="text-primary flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E6]">
              <Users className="size-4.5 stroke-[2]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-600">
                CATEGORY
              </p>
              <p className="text-sm font-bold text-[#0A2540]">{categoryName}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Registration Status section matching reference */}
      <div className="sm:p-4.5 mt-6 rounded-2xl border border-emerald-100 bg-[#EAF7EE] p-4">
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="text-sm font-bold text-emerald-900">{status.label}</span>
        </div>
        <p className="mt-1 text-xs text-emerald-800 sm:text-sm">{status.text}</p>
      </div>

      {/* Need Help? & Share section in 2-column layout matching reference */}
      <div
        className={cn(
          'mt-6 grid gap-3 border-t border-slate-100 pt-6',
          hasHelp ? 'grid-cols-[1.18fr_0.82fr]' : 'grid-cols-1',
        )}
      >
        {/* Need Help — only for the contact details the organisation has entered */}
        {hasHelp ? (
          <div className="space-y-1.5">
            <div className="font-display flex items-center gap-1.5 text-sm font-bold text-[#0A2540]">
              <Headphones className="size-4 text-slate-700" aria-hidden="true" />
              <span>Need Help?</span>
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-slate-600 sm:text-[13px]">
              {supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="hover:text-primary flex items-center gap-1.5 transition-colors"
                >
                  <Mail className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="truncate">{supportEmail}</span>
                </a>
              ) : null}
              {supportPhone && supportPhoneHref ? (
                <a
                  href={supportPhoneHref}
                  className="hover:text-primary flex items-center gap-1.5 transition-colors"
                >
                  <Phone className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span>{supportPhone}</span>
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Share this event */}
        <div className={cn(hasHelp && 'border-l border-slate-100 pl-3 sm:pl-4')}>
          <h4 className="font-display text-sm font-bold text-[#0A2540]">Share this event</h4>
          <div className="mt-2.5 flex items-center gap-1.5">
            {/* Facebook */}
            <a
              href={getShareUrl('facebook')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on Facebook"
              className="size-7.5 shadow-xs flex items-center justify-center rounded-full bg-[#1877F2] text-white transition-colors hover:bg-[#166FE5]"
            >
              <svg className="size-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
            </a>

            {/* X / Twitter */}
            <a
              href={getShareUrl('x')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on X"
              className="size-7.5 shadow-xs flex items-center justify-center rounded-full border border-slate-200/60 bg-[#F1F5F9] text-slate-800 transition-colors hover:bg-slate-200"
            >
              <svg className="size-3 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            {/* LinkedIn */}
            <a
              href={getShareUrl('linkedin')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on LinkedIn"
              className="size-7.5 shadow-xs flex items-center justify-center rounded-full bg-[#0A66C2] text-white transition-colors hover:bg-[#084e96]"
            >
              <svg className="size-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>

            {/* WhatsApp */}
            <a
              href={getShareUrl('whatsapp')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on WhatsApp"
              className="size-7.5 shadow-xs flex items-center justify-center rounded-full bg-[#25D366] text-white transition-colors hover:bg-[#20ba5a]"
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
              className="size-7.5 shadow-xs hover:text-primary flex items-center justify-center rounded-full border border-slate-200/60 bg-[#F1F5F9] text-slate-600 transition-colors hover:border-[#EB6A1F]"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
          {copied ? (
            <p className="mt-1 text-[0.625rem] font-medium text-emerald-600">Copied!</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
