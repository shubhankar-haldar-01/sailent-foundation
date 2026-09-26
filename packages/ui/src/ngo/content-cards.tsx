import * as React from 'react';
import { CalendarDays, Download, FileText, MapPin, Users } from 'lucide-react';

import { cn } from '../lib/cn';
import { formatDate, formatNumber } from '../lib/format';
import { Badge } from '../primitives/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../primitives/card';
import { Avatar, AvatarFallback, AvatarImage } from '../primitives/avatar';
import { Button } from '../primitives/button';
import type {
  DocumentCardModel,
  EventCardModel,
  ProgramCardModel,
  StoryCardModel,
  TeamMemberModel,
  TestimonialModel,
  VolunteerCardModel,
} from './types';

type LinkLike = React.ComponentType<{
  href: string;
  className?: string;
  children: React.ReactNode;
}>;

const DefaultLink: LinkLike = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

const linkClass =
  'rounded-sm after:absolute after:inset-0 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

function CoverImage({
  image,
  aspect = 'aspect-video',
}: {
  image: { url: string; alt: string } | null;
  aspect?: string;
}) {
  if (!image) return null;
  return (
    <div className={cn('bg-muted relative overflow-hidden', aspect)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={image.alt} className="size-full object-cover" loading="lazy" />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ProgramCard({
  program,
  LinkComponent = DefaultLink,
  className,
}: {
  program: ProgramCardModel;
  LinkComponent?: LinkLike;
  className?: string;
}) {
  const Link = LinkComponent;
  return (
    <Card interactive className={cn('group relative flex flex-col overflow-hidden', className)}>
      <CoverImage image={program.coverImage} />
      <CardHeader>
        <CardTitle>
          <Link href={`/programs/${program.slug}`} className={linkClass}>
            {program.name}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-body-sm text-muted-foreground line-clamp-3">
          {program.shortDescription}
        </p>
        {program.activeCampaignCount > 0 ? (
          <p className="text-caption text-muted-foreground mt-auto">
            <span data-numeric="">{program.activeCampaignCount}</span> active{' '}
            {program.activeCampaignCount === 1 ? 'campaign' : 'campaigns'}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function StoryCard({
  story,
  LinkComponent = DefaultLink,
  className,
}: {
  story: StoryCardModel;
  LinkComponent?: LinkLike;
  className?: string;
}) {
  const Link = LinkComponent;
  return (
    <Card interactive className={cn('group relative flex flex-col overflow-hidden', className)}>
      <CoverImage image={story.coverImage} aspect="aspect-4/3" />
      <CardContent className="flex flex-1 flex-col gap-2 p-5">
        {story.programName ? (
          <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground uppercase">
            {story.programName}
          </p>
        ) : null}
        <h3 className="text-h4 font-semibold leading-snug">
          <Link href={`/stories/${story.slug}`} className={cn(linkClass, 'line-clamp-2')}>
            {story.title}
          </Link>
        </h3>
        <p className="text-body-sm text-muted-foreground line-clamp-3">{story.summary}</p>
        {story.location ? (
          <p className="text-caption text-muted-foreground mt-auto flex items-center gap-1 pt-2">
            <MapPin className="size-3" aria-hidden="true" />
            {story.location}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function EventCard({
  event,
  LinkComponent = DefaultLink,
  className,
}: {
  event: EventCardModel;
  LinkComponent?: LinkLike;
  className?: string;
}) {
  const Link = LinkComponent;
  const isFull = event.capacity !== null && event.registeredCount >= event.capacity;

  return (
    <Card interactive className={cn('group relative flex flex-col overflow-hidden', className)}>
      <CoverImage image={event.coverImage} />
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary flex items-center gap-1.5 uppercase">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          <time dateTime={event.startsAt}>{formatDate(event.startsAt)}</time>
        </p>

        <h3 className="text-h4 font-semibold leading-snug">
          <Link href={`/events/${event.slug}`} className={cn(linkClass, 'line-clamp-2')}>
            {event.title}
          </Link>
        </h3>

        <p className="text-body-sm text-muted-foreground line-clamp-2">{event.summary}</p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <span className="text-caption text-muted-foreground flex items-center gap-1">
            <MapPin className="size-3" aria-hidden="true" />
            {event.isOnline ? 'Online' : (event.venueName ?? event.city ?? 'Venue to be announced')}
          </span>
          {isFull ? (
            <Badge variant="warning">Waitlist only</Badge>
          ) : event.status === 'registration_open' ? (
            <Badge variant="success">Registration open</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function TeamMemberCard({
  member,
  className,
}: {
  member: TeamMemberModel;
  className?: string;
}) {
  const initials = member.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={cn('flex flex-col items-start gap-3', className)}>
      <Avatar size="xl" className="size-24">
        {member.photo ? <AvatarImage src={member.photo.url} alt={member.photo.alt} /> : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-body font-semibold">{member.name}</p>
        <p className="text-body-sm text-muted-foreground">{member.designation}</p>
        {member.department ? (
          <p className="text-caption text-muted-foreground">{member.department}</p>
        ) : null}
      </div>
      {member.bio ? <p className="text-body-sm text-muted-foreground">{member.bio}</p> : null}
      {member.socialLinks?.length ? (
        <ul className="flex gap-3">
          {member.socialLinks.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                rel="noopener noreferrer"
                target="_blank"
                className="text-caption text-muted-foreground hover:text-foreground focus-visible:outline-ring rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function VolunteerCard({
  volunteer,
  className,
}: {
  volunteer: VolunteerCardModel;
  className?: string;
}) {
  const initials = volunteer.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card className={cn('flex items-center gap-4 p-4', className)}>
      <Avatar size="lg">
        {volunteer.photo ? (
          <AvatarImage src={volunteer.photo.url} alt={volunteer.photo.alt} />
        ) : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-body truncate font-medium">{volunteer.name}</p>
        {/* The permanent identifier assigned at approval (decision A13). */}
        <p data-numeric="" className="text-caption text-muted-foreground font-mono">
          {volunteer.volunteerId}
        </p>
        {volunteer.role ? (
          <p className="text-caption text-muted-foreground truncate">{volunteer.role}</p>
        ) : null}
      </div>
      {/* Verified hours only. Unverified hours never appear on anything a volunteer can show an employer. */}
      {volunteer.verifiedHours > 0 ? (
        <div className="shrink-0 text-right">
          <p data-numeric="" className="text-body font-semibold">
            {formatNumber(volunteer.verifiedHours)}
          </p>
          <p className="text-caption text-muted-foreground">hours</p>
        </div>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function DocumentCard({
  document,
  onDownload,
  className,
}: {
  document: DocumentCardModel;
  onDownload?: (id: string) => void;
  className?: string;
}) {
  const sizeMb = (document.sizeBytes / (1024 * 1024)).toFixed(1);

  return (
    <Card className={cn('flex items-start gap-4 p-4', className)}>
      <FileText className="text-muted-foreground mt-0.5 size-8 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium">{document.title}</p>
        {document.description ? (
          <p className="text-body-sm text-muted-foreground mt-0.5">{document.description}</p>
        ) : null}
        <p className="text-caption text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2">
          {document.financialYear ? <span>FY {document.financialYear}</span> : null}
          <span aria-hidden="true">·</span>
          <span className="uppercase">{document.fileName.split('.').pop()}</span>
          <span aria-hidden="true">·</span>
          <span data-numeric="">{sizeMb} MB</span>
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        onClick={() => onDownload?.(document.id)}
      >
        <Download aria-hidden="true" />
        Download
        <span className="sr-only"> {document.title}</span>
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function Testimonial({
  testimonial,
  className,
}: {
  testimonial: TestimonialModel;
  className?: string;
}) {
  const initials = testimonial.authorName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <figure className={cn('flex flex-col gap-4', className)}>
      <blockquote className="text-body-lg text-foreground leading-relaxed">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="flex items-center gap-3">
        <Avatar size="md">
          {testimonial.photo ? (
            <AvatarImage src={testimonial.photo.url} alt={testimonial.photo.alt} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-body-sm font-medium">{testimonial.authorName}</p>
          {testimonial.authorRole ? (
            <p className="text-caption text-muted-foreground">{testimonial.authorRole}</p>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------

export function MediaGallery({
  items,
  className,
}: {
  items: { url: string; alt: string; caption?: string }[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <ul className={cn('grid grid-cols-2 gap-3 md:grid-cols-3', className)}>
      {items.map((item) => (
        <li key={item.url}>
          <figure className="space-y-1.5">
            <div className="aspect-4/3 bg-muted relative overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.alt}
                className="size-full object-cover"
                loading="lazy"
              />
            </div>
            {item.caption ? (
              <figcaption className="text-caption text-muted-foreground">{item.caption}</figcaption>
            ) : null}
          </figure>
        </li>
      ))}
    </ul>
  );
}

export { Users as VolunteerIcon };
