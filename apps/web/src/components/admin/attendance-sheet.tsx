'use client';

import * as React from 'react';

import { FormStatus, SubmitButton } from '@/components/admin/form-shell';
import { recordAttendance, type ActionState } from '@/lib/admin/actions';
import type { AdminEventRegistration } from '@/lib/admin/api';

/**
 * The attendance register.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * RADIO BUTTONS PER PERSON, AND A THIRD OPTION THAT MEANS "DON'T CHANGE THIS".
 *
 * Two checkboxes would let somebody be marked present and absent at once, which
 * the API refuses — correctly, but only after the whole sheet has been filled
 * in and submitted. Radios make the contradiction unrepresentable.
 *
 * The third option matters as much as the other two. A register submitted with
 * everybody defaulted to "absent" would mark a hundred people as no-shows
 * because an organiser saved early, and `no_show` is a claim about a person,
 * not an absence of data. So a row left alone sends nothing at all.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This is used at a venue, on a phone, by somebody standing up. It is a plain
 * form with large targets and no drag, no swipe and no autosave.
 */
export function AttendanceSheet({
  eventId,
  registrations,
}: {
  eventId: string;
  registrations: AdminEventRegistration[];
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    recordAttendance,
    {},
  );

  const markable = registrations.filter((entry) => entry.status !== 'cancelled');

  if (markable.length === 0) {
    return (
      <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-8 text-center">
        Nobody is registered for this event yet.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={eventId} />
      <FormStatus state={state} />

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="text-body-sm w-full">
          <caption className="sr-only">
            Attendance register. Leave a row unmarked to leave its record unchanged.
          </caption>
          <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Attendee
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Recorded
              </th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">
                Came
              </th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">
                Did not
              </th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">
                Leave
              </th>
            </tr>
          </thead>
          <tbody>
            {markable.map((entry) => (
              <tr key={entry.id} className="border-border border-t">
                <td className="px-4 py-3">
                  <span className="font-medium">{entry.fullName}</span>
                  {entry.attendeeCount > 1 ? (
                    <span className="text-muted-foreground"> · {entry.attendeeCount} places</span>
                  ) : null}
                  <p className="text-caption text-muted-foreground">{entry.phone}</p>
                </td>
                <td className="text-muted-foreground px-4 py-3 capitalize">
                  {entry.status.replace('_', ' ')}
                </td>
                {/*
                  The three radios in a row share the name `mark-<id>`, so they
                  are one choice. The two marking options carry the STATUS as
                  their value; the third carries none, so a row left on it
                  submits nothing and the action never mentions it.
                */}
                <td className="px-4 py-3 text-center">
                  <input
                    type="radio"
                    name={`mark-${entry.id}`}
                    value="attended"
                    defaultChecked={entry.status === 'attended'}
                    className="size-5"
                    aria-label={`${entry.fullName} attended`}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="radio"
                    name={`mark-${entry.id}`}
                    value="no_show"
                    defaultChecked={entry.status === 'no_show'}
                    className="size-5"
                    aria-label={`${entry.fullName} did not attend`}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="radio"
                    name={`mark-${entry.id}`}
                    defaultChecked={entry.status !== 'attended' && entry.status !== 'no_show'}
                    className="size-5"
                    aria-label={`Leave ${entry.fullName} unchanged`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubmitButton pending={pending}>Save the register</SubmitButton>
    </form>
  );
}
