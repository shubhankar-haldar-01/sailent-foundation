'use client';

import * as React from 'react';

import { Badge, Button, Input, Label, formatDate } from '@sailent/ui';

import { FormStatus, SubmitButton } from '@/components/admin/form-shell';
import {
  createVolunteerAssignment,
  recordVolunteerAttendance,
  verifyVolunteerAttendance,
  type ActionState,
} from '@/lib/admin/actions';
import type { AdminVolunteerAssignment, AdminVolunteerAttendance } from '@/lib/admin/api';

/** Give a volunteer work. Only offered when they are active. */
export function NewAssignment({
  volunteerId,
  canAssign,
}: {
  volunteerId: string;
  canAssign: boolean;
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    createVolunteerAssignment,
    {},
  );
  const [open, setOpen] = React.useState(false);

  if (!canAssign) {
    return (
      <p className="text-caption text-muted-foreground">
        {/* The API refuses this as well. Explaining it here means the operator
            does not have to discover the rule from a 409. */}
        Only an active volunteer can be given work. Activate them first.
      </p>
    );
  }

  if (!open) {
    return (
      <>
        <FormStatus state={state} />
        <Button size="sm" onClick={() => setOpen(true)}>
          New assignment
        </Button>
      </>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={volunteerId} />
      <FormStatus state={state} />

      <div className="space-y-1.5">
        <Label htmlFor="role">What will they be doing?</Label>
        <Input id="role" name="role" required autoFocus placeholder="Kit sorting, Ward 12" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startsAt">Starts</Label>
          <Input id="startsAt" name="startsAt" type="datetime-local" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endsAt">Ends</Label>
          <Input id="endsAt" name="endsAt" type="datetime-local" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="location">Where</Label>
          <Input id="location" name="location" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expectedHours">Expected hours</Label>
          <Input id="expectedHours" name="expectedHours" type="number" min={0} max={24} />
          <p className="text-caption text-muted-foreground">
            A plan, not a record. Hours come from attendance.
          </p>
        </div>
      </div>

      <p className="text-caption text-muted-foreground">All times are India Standard Time.</p>

      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending}>Assign</SubmitButton>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Record attendance against one assignment.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * MINUTES, NOT HOURS, and the field says so.
 *
 * Somebody who worked ninety minutes should not have to decide whether that is
 * "1" or "1.5". A decimal here becomes a rounding argument later, on a number
 * that ends up printed on a certificate an employer reads.
 *
 * "Verify at the same time" is a CHECKBOX, defaulting to off. Recording says
 * this happened; verifying says the organisation stands behind it, and only
 * verified minutes reach a certificate. An organiser marking a register they
 * personally supervised can do both at once — but it stays a choice.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function RecordAttendance({
  volunteerId,
  assignment,
}: {
  volunteerId: string;
  assignment: AdminVolunteerAssignment;
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    recordVolunteerAttendance,
    {},
  );
  const [open, setOpen] = React.useState(false);

  if (!open) {
    return (
      <>
        <FormStatus state={state} />
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Record attendance
        </Button>
      </>
    );
  }

  return (
    <form action={action} className="border-border mt-3 space-y-3 rounded-md border p-3">
      <input type="hidden" name="id" value={volunteerId} />
      <input type="hidden" name="assignmentId" value={assignment.id} />
      <FormStatus state={state} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`date-${assignment.id}`}>Date</Label>
          <Input
            id={`date-${assignment.id}`}
            name="date"
            type="date"
            required
            defaultValue={assignment.startsAt.slice(0, 10)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`minutes-${assignment.id}`}>Minutes worked</Label>
          <Input
            id={`minutes-${assignment.id}`}
            name="durationMinutes"
            type="number"
            min={1}
            max={1440}
            required
            placeholder="240"
          />
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="verified" className="size-4" />
        <span className="text-body-sm">Verify at the same time — I supervised this</span>
      </label>
      <p className="text-caption text-muted-foreground">
        Only verified hours count towards a certificate. Recording it again for the same day
        corrects the figure rather than adding to it.
      </p>

      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending}>Save</SubmitButton>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Verify or withdraw verification from recorded attendance. */
export function VerifyAttendance({
  volunteerId,
  attendance,
}: {
  volunteerId: string;
  attendance: AdminVolunteerAttendance[];
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    verifyVolunteerAttendance,
    {},
  );

  const unverified = attendance.filter((row) => !row.verifiedAt);

  if (attendance.length === 0) {
    return <p className="text-caption text-muted-foreground">Nothing has been recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      <FormStatus state={state} />

      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={volunteerId} />

        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  <span className="sr-only">Select</span>
                </th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  Date
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Minutes
                </th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  Verified
                </th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((row) => (
                <tr key={row.id} className="border-border border-t">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      name="attendanceId"
                      value={row.id}
                      defaultChecked={!row.verifiedAt}
                      className="size-4"
                      aria-label={`Select ${row.date}`}
                    />
                  </td>
                  <td className="px-3 py-2">{formatDate(row.date)}</td>
                  <td data-numeric="" className="px-3 py-2 text-right tabular-nums">
                    {row.durationMinutes}
                  </td>
                  <td className="px-3 py-2">
                    {row.verifiedAt ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="warning">Not yet</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pending={pending}>
            Verify selected{unverified.length > 0 ? ` (${unverified.length} waiting)` : ''}
          </SubmitButton>
          {/* Withdrawing verification is the same route with a flag. It is
              here because a figure verified in error has to be correctable —
              certificates already issued keep their frozen hours. */}
          <Button type="submit" name="unverify" value="true" variant="ghost" size="sm">
            Withdraw verification instead
          </Button>
        </div>
      </form>
    </div>
  );
}
