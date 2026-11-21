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
      containerClass: 'border-success/80 bg-success-subtle',
      dotClass: 'bg-success',
      labelClass: 'text-success',
      textClass: 'text-success',
    },
    full: {
      label: 'Event full',
      text: 'Every place has been taken. Places may open if someone cancels.',
      containerClass: 'border-warning/80 bg-warning-subtle/80',
      dotClass: 'bg-warning',
      labelClass: 'text-warning-foreground',
      textClass: 'text-warning-foreground',
    },
    closed: {
      label: 'Registration closed',
      text: 'Registration for this event is not open.',
      containerClass: 'border-destructive/80 bg-destructive-subtle/80',
      dotClass: 'bg-destructive',
      labelClass: 'text-destructive',
      textClass: 'text-destructive',
    },
    cancelled: {
      label: 'Cancelled',
      text: 'This event has been cancelled and will not take place.',
      containerClass: 'border-destructive/80 bg-destructive-subtle/80',
      dotClass: 'bg-destructive',
      labelClass: 'text-destructive',
      textClass: 'text-destructive',
    },
    finished: {
      label: 'Past event',
      text: 'This event has concluded. Please check other upcoming events.',
      containerClass: 'border-border bg-muted/80',
      dotClass: 'bg-muted-foreground',
      labelClass: 'text-foreground',
      textClass: 'text-muted-foreground',
    },
  };
  const status = STATUS[availability];
  const hasHelp = Boolean(supportEmail || (supportPhone && supportPhoneHref));

  return (
    <Card className="border-border/80 bg-surface overflow-hidden rounded-3xl border p-6 shadow-sm transition-shadow hover:shadow-md sm:p-7">
      {/* Event Thumbnail with Category Badge in Bottom Right */}
      <div className="border-border bg-background relative overflow-hidden rounded-2xl border">
        <MediaFrame
          media={event.cover}
          aspect="video"
          priority={false}
          className="aspect-[16/10] w-full object-cover"
        />
        {categoryName ? (
          <div className="absolute bottom-3 right-3">
            <span className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold shadow-md">
              <Users className="size-3.5 text-white" aria-hidden="true" />
              {categoryName}
            </span>
          </div>
        ) : null}
      </div>

      {/* Title and Short Description */}
      <div className="mt-5">
        <h3 className="font-display text-foreground text-xl font-extrabold leading-snug sm:text-2xl">
          {event.title}
        </h3>
        {event.summary ? (
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{event.summary}</p>
        ) : null}
      </div>

      {/* Details list with peach/orange rounded icon boxes */}
      <div className="border-border mt-6 space-y-4 border-t pt-5 text-sm">
        {/* Date */}
        <div className="flex items-start gap-3.5">
          <div className="border-primary/70 bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border">
            <Calendar className="size-4.5 stroke-[2]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[0.6875rem] font-bold uppercase tracking-wider">
              DATE
            </p>
            <p className="text-foreground mt-0.5 text-sm font-bold" data-numeric="">
              {dateFormatted} <span className="text-muted-foreground font-normal">({dayName})</span>
            </p>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-start gap-3.5">
          <div className="border-primary/70 bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border">
            <Clock className="size-4.5 stroke-[2]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[0.6875rem] font-bold uppercase tracking-wider">
              TIME
            </p>
            <p className="text-foreground mt-0.5 text-sm font-bold" data-numeric="">
              {timeStr}
            </p>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-3.5">
          <div className="border-primary/70 bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border">
            <MapPin className="size-4.5 stroke-[2]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[0.6875rem] font-bold uppercase tracking-wider">
              LOCATION
            </p>
            <p className="text-foreground mt-0.5 text-sm font-bold">
              {venue}{' '}
              {locationSub ? (
                <span className="text-muted-foreground font-normal">({locationSub})</span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Fee / Pricing */}
        <div className="flex items-start gap-3.5">
          <div className="border-primary/70 bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border">
            <Ticket className="size-4.5 stroke-[2]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[0.6875rem] font-bold uppercase tracking-wider">
              REGISTRATION FEE
            </p>
            <p className="text-foreground mt-0.5 text-sm font-bold">
              {event.isPaid && event.feeAmount ? (
                <span>
                  ₹{Math.round(event.feeAmount / 100)}{' '}
                  <span className="text-muted-foreground text-xs font-normal">
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
            <div className="border-primary/70 bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border">
              <Users className="size-4.5 stroke-[2]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[0.6875rem] font-bold uppercase tracking-wider">
                CATEGORY
              </p>
              <p className="text-foreground mt-0.5 text-sm font-bold">{categoryName}</p>
            </div>
          </div>
        ) : null}

        {/* Activities / Functions */}
        {event.functions && event.functions.length > 0 ? (
          <div className="flex items-start gap-3.5">
            <div className="border-primary/70 bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border">
              <Sparkles className="size-4.5 stroke-[2]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[0.6875rem] font-bold uppercase tracking-wider">
                ACTIVITIES / FUNCTIONS
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {event.functions.map((fn) => (
                  <span
                    key={fn}
                    className="bg-accent text-primary ring-primary/80 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1"
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
          'border-border mt-6 grid gap-4 border-t pt-5',
          hasHelp ? 'grid-cols-1 sm:grid-cols-[1.1fr_0.9fr]' : 'grid-cols-1',
        )}
      >
        {/* Need Help */}
        {hasHelp ? (
          <div className="space-y-1.5">
            <div className="text-foreground flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Headphones className="text-muted-foreground size-3.5" aria-hidden="true" />
              <span>Need Help?</span>
            </div>
            <div className="text-muted-foreground mt-1.5 space-y-1.5 text-xs sm:text-[13px]">
              {supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="hover:text-primary flex items-center gap-1.5 transition-colors"
                >
                  <Mail className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{supportEmail}</span>
                </a>
              ) : null}
              {supportPhone && supportPhoneHref ? (
                <a
                  href={supportPhoneHref}
                  className="hover:text-primary flex items-center gap-1.5 transition-colors"
                >
                  <Phone className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                  <span>{supportPhone}</span>
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Share this event */}
        <div className={cn(hasHelp && 'sm:border-border sm:border-l sm:pl-4')}>
          <h4 className="text-foreground text-xs font-bold uppercase tracking-wider">
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
              className="shadow-xs border-border bg-muted text-muted-foreground hover:border-primary hover:text-primary flex size-8 items-center justify-center rounded-full border transition-transform hover:scale-105"
            >
              {copied ? (
                <Check className="text-success size-3.5" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
          {copied ? (
            <p className="text-success mt-1 text-[0.625rem] font-semibold">Copied to clipboard!</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
