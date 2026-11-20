'use client';

import * as React from 'react';
import { toast } from '@sailent/ui';

import { friendlyError } from './error-messages';

/**
 * The standard way to run something a person asked for: loading, then a
 * success toast or an error toast (2026-11-19, docs/ui-feedback.md).
 *
 *   const save = useAsyncAction(saveCampaign, { success: 'Campaign saved' });
 *   <Button isLoading={save.pending} onClick={() => save.run(form)}>Save</Button>
 *
 * - A second call while one is running is ignored, so a double click cannot
 *   submit twice.
 * - A server action's `{ ok, error }` result counts as success or failure as
 *   well as a thrown error.
 * - An error toast offers "Try again" when trying again could help, and
 *   repeats the same call.
 * - `loading` shows a loading toast that turns into the outcome, for work
 *   that takes a while (an export, say).
 */

export interface AsyncActionOptions<R> {
  /** The success toast's title, or nothing for no toast. */
  success?: string | ((result: R) => string);
  successDescription?: string;
  /** A loading toast's title, for work that takes more than a moment. */
  loading?: string;
  /** Overrides the mapped error title. */
  errorTitle?: string;
  onSuccess?: (result: R) => void;
  onError?: (error: unknown) => void;
}

/** A server action's `{ ok, error }` shape. */
function failedResult(result: unknown): result is { error: string } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as { error?: unknown }).error === 'string' &&
    (result as { ok?: unknown }).ok !== true
  );
}

export function useAsyncAction<Args extends unknown[], R>(
  action: (...args: Args) => Promise<R>,
  options: AsyncActionOptions<R> = {},
) {
  const [pending, setPending] = React.useState(false);
  const inFlight = React.useRef(false);
  const latest = React.useRef({ action, options });
  latest.current = { action, options };

  const run = React.useCallback(async (...args: Args): Promise<R | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    const { action: current, options: opts } = latest.current;
    const loadingId = opts.loading ? toast.loading(opts.loading) : null;

    const fail = (error: unknown) => {
      const friendly = friendlyError(error);
      const shown = {
        description: friendly.description,
        action: friendly.retryable
          ? { label: 'Try again', onClick: () => void run(...args) }
          : undefined,
      };
      const title = opts.errorTitle ?? friendly.title;
      if (loadingId) toast.update(loadingId, { type: 'error', title, ...shown });
      else toast.error(title, shown);
      opts.onError?.(error);
    };

    try {
      const result = await current(...args);
      if (failedResult(result)) {
        fail(result);
        return result;
      }
      const title =
        typeof opts.success === 'function' ? opts.success(result) : (opts.success ?? null);
      if (title) {
        if (loadingId)
          toast.update(loadingId, {
            type: 'success',
            title,
            description: opts.successDescription,
          });
        else toast.success(title, { description: opts.successDescription });
      } else if (loadingId) {
        toast.dismiss(loadingId);
      }
      opts.onSuccess?.(result);
      return result;
    } catch (error) {
      fail(error);
      return undefined;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);

  return { run, pending };
}
