'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@sailent/ui';
import { CONTACT_MESSAGE_MIN, emailSchema } from '@sailent/validation';

import { submitContactMessage } from '@/lib/communications/actions';

import { Honeypot } from './honeypot';

/**
 * The contact form (Phase 13: real).
 *
 * The message is STORED by the API before anything else and emailed to the
 * organisation's contact address; staff see it in Admin → Messages until they
 * mark it handled, so a provider outage cannot lose it. The browser checks the
 * fields first for quick feedback; the API checks them again.
 */
export function ContactForm() {
  const ids = {
    name: React.useId(),
    email: React.useId(),
    subject: React.useId(),
    message: React.useId(),
  };
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Record<string, string> = {};

    if (!String(data.get('name') ?? '').trim()) next.name = 'Enter your name';
    const email = emailSchema.safeParse(data.get('email'));
    if (!email.success) next.email = email.error.issues[0]?.message ?? 'Enter a valid email';
    if (String(data.get('message') ?? '').trim().length < CONTACT_MESSAGE_MIN)
      next.message = 'Please tell us a little more — at least a sentence';

    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      const result = await submitContactMessage(data);
      if (result.ok) {
        setSubmitted(true);
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error ?? 'Your message was not sent. Try again.');
    });
  };

  if (submitted) {
    return (
      <Card className="border-success/30 bg-success-subtle p-6">
        <p role="status" className="text-body-sm flex items-start gap-2">
          <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Message sent.</span> Thank you — we aim to reply within
            three working days, to the email address you gave.
          </span>
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 md:p-8">
      <h2 className="text-h3 font-semibold">Send us a message</h2>
      <form onSubmit={handleSubmit} noValidate className="relative mt-6 space-y-5">
        <Honeypot />
        {formError ? (
          <p role="alert" className="text-body-sm text-destructive">
            {formError}
          </p>
        ) : null}
        <div>
          <Label htmlFor={ids.name} required>
            Your name
          </Label>
          <Input
            id={ids.name}
            name="name"
            autoComplete="name"
            hasError={!!errors.name}
            aria-describedby={errors.name ? `${ids.name}-error` : undefined}
            className="mt-1.5"
          />
          {errors.name ? (
            <p id={`${ids.name}-error`} role="alert" className="text-caption text-destructive mt-1">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor={ids.email} required>
            Email
          </Label>
          <Input
            id={ids.email}
            name="email"
            type="email"
            autoComplete="email"
            hasError={!!errors.email}
            aria-describedby={errors.email ? `${ids.email}-error` : undefined}
            className="mt-1.5"
          />
          {errors.email ? (
            <p
              id={`${ids.email}-error`}
              role="alert"
              className="text-caption text-destructive mt-1"
            >
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor={ids.subject}>What is this about?</Label>
          <Select name="subject" defaultValue="general">
            <SelectTrigger id={ids.subject} className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General enquiry</SelectItem>
              <SelectItem value="donation">A donation or receipt</SelectItem>
              <SelectItem value="volunteering">Volunteering</SelectItem>
              <SelectItem value="partnership">Partnership or CSR</SelectItem>
              <SelectItem value="documents">Requesting a document</SelectItem>
              <SelectItem value="media">Press or media</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={ids.message} required>
            Message
          </Label>
          <Textarea
            id={ids.message}
            name="message"
            rows={6}
            hasError={!!errors.message}
            aria-describedby={errors.message ? `${ids.message}-error` : undefined}
            className="mt-1.5"
          />
          {errors.message ? (
            <p
              id={`${ids.message}-error`}
              role="alert"
              className="text-caption text-destructive mt-1"
            >
              {errors.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? 'Sending…' : 'Send message'}
        </Button>
        <p className="text-caption text-muted-foreground">
          We use your name and email only to reply to this message.
        </p>
      </form>
    </Card>
  );
}
