'use client';

import * as React from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from '@sailent/ui';
import { emailSchema, phoneSchema } from '@sailent/validation';

import {
  submitVolunteerApplication,
  type VolunteerApplicationState,
} from '@/lib/volunteers/actions';

/**
 * Volunteer application — UI ONLY.
 *
 * Field groups mirror the Phase 0 volunteer architecture exactly, so Phase 6
 * maps this onto `volunteers`, `volunteer_profiles` and
 * `volunteer_applications` without redesigning the form:
 *
 *   1. Personal details        → volunteers
 *   2. Skills and experience   → volunteer_profiles
 *   3. Interests               → volunteer_profiles.interests
 *   4. Availability            → volunteer_profiles.availability
 *   5. Emergency contact       → volunteers (SENSITIVE)
 *   6. Review and consent      → volunteer_applications.form_data
 *
 * Multi-step because the form is long, and a long form presented as one page
 * is abandoned. Step state is local; resumability by link arrives with the API.
 */

const STEPS = [
  'Personal details',
  'Skills and experience',
  'Interests',
  'Availability',
  'Emergency contact',
  'Review',
] as const;

const SKILL_OPTIONS = [
  'Teaching or tutoring',
  'Medical or nursing',
  'Translation',
  'Photography',
  'Design',
  'Accounting',
  'Data entry',
  'Logistics',
  'Community outreach',
  'Driving',
];

const INTEREST_OPTIONS = [
  'Education',
  'Healthcare',
  'Child Welfare',
  'Women Empowerment',
  'Livelihood',
  'Environment',
  'Animal Welfare',
];

const DAY_OPTIONS = ['Weekdays', 'Weekends', 'Either'];

export function VolunteerApplicationForm() {
  const [step, setStep] = React.useState(0);
  const [skills, setSkills] = React.useState<string[]>([]);
  const [interests, setInterests] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [state, setState] = React.useState<VolunteerApplicationState>({});
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  /**
   * Answers from the steps that are no longer on screen.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * ONLY THE CURRENT STEP IS MOUNTED. Everything else is unmounted, so its
   * inputs are gone from the DOM — and `new FormData(form)` on the last step
   * therefore sees ONLY the last step.
   *
   * This form submitted `{ availability: {} }` and nothing else until the
   * accumulation below was added: no name, no email, no phone. The API
   * refused it, correctly, and the applicant saw "the submitted data is not
   * valid" about data they had typed.
   *
   * A ref rather than state: it is written on every step change and read once
   * at the end, and nothing renders from it. State would re-render the form
   * for no reason.
   * ══════════════════════════════════════════════════════════════════════════
   */
  const answers = React.useRef<Record<string, string>>({});

  /** Fold the mounted step's fields into the accumulated answers. */
  const collect = (form: HTMLFormElement) => {
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value === 'string') answers.current[key] = value;
    }
  };
  const submitted = state.ok === true;

  // Move focus to the new step heading, or a keyboard user is stranded.
  React.useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  const toggle = (list: string[], setList: (next: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const validateStep = (form: HTMLFormElement): boolean => {
    const data = new FormData(form);
    const next: Record<string, string> = {};

    if (step === 0) {
      if (!String(data.get('fullName') ?? '').trim()) next.fullName = 'Enter your full name';
      const email = emailSchema.safeParse(data.get('email'));
      if (!email.success) next.email = email.error.issues[0]?.message ?? 'Enter a valid email';
      const phone = phoneSchema.safeParse(data.get('phone'));
      if (!phone.success)
        next.phone = phone.error.issues[0]?.message ?? 'Enter a valid mobile number';
    }

    if (step === 4) {
      if (!String(data.get('emergencyName') ?? '').trim())
        next.emergencyName = 'Enter an emergency contact name';
      const emergencyPhone = phoneSchema.safeParse(data.get('emergencyPhone'));
      if (!emergencyPhone.success)
        next.emergencyPhone =
          emergencyPhone.error.issues[0]?.message ?? 'Enter a valid mobile number';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /**
   * Advance, or on the last step actually submit.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * THE CHECKBOX GROUPS ARE CARRIED IN REACT STATE, NOT IN THE FORM.
   *
   * `skills` and `interests` are rendered as controlled checkboxes across two
   * earlier steps, and only the CURRENT step is mounted — so by the time
   * somebody reaches the last one, the inputs holding those answers are gone
   * from the DOM and `new FormData(form)` cannot see them.
   *
   * They are appended from state here. Without this the API received an
   * application with no skills and no interests on every submission, which is
   * most of what the form is for.
   * ══════════════════════════════════════════════════════════════════════════
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStep(event.currentTarget)) return;
    if (step < STEPS.length - 1) {
      // Before this step unmounts and its values disappear with it.
      collect(event.currentTarget);
      setStep(step + 1);
      return;
    }

    collect(event.currentTarget);

    const data = new FormData();
    for (const [key, value] of Object.entries(answers.current)) data.set(key, value);
    // These two live in React state, not in any mounted input.
    data.set('skills', skills.join(','));
    data.set('interests', interests.join(','));

    setPending(true);
    const result = await submitVolunteerApplication({}, data);
    setPending(false);
    setState(result);

    // A field error from the server belongs beside its field, like the local
    // ones — not only in the banner at the top.
    if (result.fieldErrors) setErrors(result.fieldErrors);
  };

  if (submitted) {
    return (
      <Card className="border-success/30 bg-success-subtle p-8 text-center">
        <Check className="text-success mx-auto size-8" aria-hidden="true" />
        <h2 className="text-h3 mt-4 font-semibold">Thank you — we have your application</h2>
        <p className="text-body text-muted-foreground mx-auto mt-2 max-w-prose">
          {/*
            No timeframe is promised. "Reviewed within two weeks" is a promise a
            small organisation cannot keep during a flood, and breaking it is
            worse than never having made it.
          */}
          Somebody will read it and write to you once it has been considered. If we take it forward
          you will be given a permanent volunteer number.
        </p>
        <p className="text-caption text-muted-foreground mt-4">
          We have emailed you an acknowledgement. There is nothing you need to do in the meantime.
        </p>
      </Card>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <Card className="p-6 md:p-8">
      <div className="mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-caption text-muted-foreground font-medium">
            Step <span data-numeric="">{step + 1}</span> of{' '}
            <span data-numeric="">{STEPS.length}</span>
          </p>
          <p className="text-caption text-muted-foreground">{STEPS[step]}</p>
        </div>
        <Progress
          value={progress}
          label={`Application progress: step ${step + 1} of ${STEPS.length}`}
          size="sm"
          className="mt-2"
        />
      </div>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-h3 font-semibold focus-visible:outline-none"
      >
        {STEPS[step]}
      </h2>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        {/* A refusal from the server — a duplicate application, a cooling
            period, an unreachable API. Field-level problems also render beside
            their own field; this is for the ones that belong to the whole
            submission. */}
        {state.error ? (
          <Alert variant="destructive" role="alert">
            {state.error}
          </Alert>
        ) : null}
        {step === 0 ? (
          <>
            <TextField
              name="fullName"
              label="Full name"
              required
              error={errors.fullName}
              autoComplete="name"
            />
            <TextField
              name="email"
              label="Email"
              type="email"
              required
              error={errors.email}
              autoComplete="email"
            />
            <TextField
              name="phone"
              label="Mobile number"
              type="tel"
              required
              error={errors.phone}
              autoComplete="tel"
              hint="We use this to contact you about assignments."
            />
            <TextField name="city" label="City or district" autoComplete="address-level2" />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <fieldset>
              <legend className="text-body-sm font-medium">What can you help with?</legend>
              <p className="text-caption text-muted-foreground mt-1">
                Most field work needs reliability rather than credentials. Select anything that
                applies.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SKILL_OPTIONS.map((skill) => (
                  <CheckboxRow
                    key={skill}
                    label={skill}
                    checked={skills.includes(skill)}
                    onChange={() => toggle(skills, setSkills, skill)}
                  />
                ))}
              </div>
            </fieldset>
            <div>
              <Label htmlFor="experience">Relevant experience</Label>
              <Textarea
                id="experience"
                name="experience"
                rows={4}
                className="mt-1.5"
                placeholder="Optional. Anything you think is relevant."
              />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <fieldset>
            <legend className="text-body-sm font-medium">Which programs interest you?</legend>
            <p className="text-caption text-muted-foreground mt-1">
              We try to match assignments to interest, though field needs vary by season.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {INTEREST_OPTIONS.map((interest) => (
                <CheckboxRow
                  key={interest}
                  label={interest}
                  checked={interests.includes(interest)}
                  onChange={() => toggle(interests, setInterests, interest)}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === 3 ? (
          <>
            <div>
              <Label htmlFor="days">Which days suit you?</Label>
              <Select name="days" defaultValue="Either">
                <SelectTrigger id="days" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="mode">Field or remote?</Label>
              <Select name="mode" defaultValue="Field">
                <SelectTrigger id="mode" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Field">Field work — travel to program districts</SelectItem>
                  <SelectItem value="Remote">Remote — translation, design, research</SelectItem>
                  <SelectItem value="Both">Either</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="bg-muted text-body-sm text-muted-foreground rounded-md p-3">
              We ask for a minimum of one day a month for six months. We would rather have someone
              reliable once a month than someone enthusiastic for three weeks.
            </p>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <p className="text-body-sm text-muted-foreground">
              Field work involves travel to rural districts. We keep an emergency contact for every
              volunteer, and it is never shared outside the organization.
            </p>
            <TextField
              name="emergencyName"
              label="Emergency contact name"
              required
              error={errors.emergencyName}
            />
            <TextField
              name="emergencyPhone"
              label="Emergency contact number"
              type="tel"
              required
              error={errors.emergencyPhone}
            />
            <TextField name="emergencyRelation" label="Relationship to you" />
          </>
        ) : null}

        {step === 5 ? (
          <>
            <dl className="border-border bg-surface-sunken text-body-sm space-y-3 rounded-lg border p-4">
              <ReviewRow
                label="Skills selected"
                value={skills.length > 0 ? skills.join(', ') : 'None selected'}
              />
              <ReviewRow
                label="Program interests"
                value={interests.length > 0 ? interests.join(', ') : 'No preference'}
              />
            </dl>
            <CheckboxRow
              label="I have read and agree to the child protection and safeguarding policy."
              checked
              onChange={() => undefined}
              required
            />
            <CheckboxRow
              label="I understand the minimum commitment is one day a month for six months."
              checked
              onChange={() => undefined}
              required
            />
            <p className="text-caption text-muted-foreground">
              We will use these details only to consider your application and to reach you about
              volunteering.
            </p>
          </>
        ) : null}

        <div className="border-border flex items-center justify-between gap-3 border-t pt-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
          >
            <ChevronLeft aria-hidden="true" />
            Back
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Sending…' : step === STEPS.length - 1 ? 'Submit application' : 'Continue'}
            {step < STEPS.length - 1 ? <ChevronRight aria-hidden="true" /> : null}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function TextField({
  name,
  label,
  type = 'text',
  required,
  error,
  hint,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  autoComplete?: string;
}) {
  const id = React.useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        hasError={!!error}
        aria-describedby={describedBy || undefined}
        className="mt-1.5"
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-caption text-muted-foreground mt-1">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption text-destructive mt-1">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
  required,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  required?: boolean;
}) {
  const id = React.useId();
  return (
    <div className={cn('flex items-start gap-2.5')}>
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <Label htmlFor={id} className="text-body-sm font-normal leading-snug" required={required}>
        {label}
      </Label>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium sm:text-right">{value}</dd>
    </div>
  );
}
