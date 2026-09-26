/**
 * Campaign and product progress.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE implementation, computed server-side and shared with the client, because
 * a progress figure that differs between the API and the page is the kind of
 * discrepancy a donor screenshots.
 *
 * Two rules govern everything here:
 *
 *   1. Money is INTEGER PAISE (decision A2). Nothing in this file divides
 *      money by anything except to produce a percentage for display, and the
 *      percentage is never fed back into a monetary value.
 *
 *   2. The figures are REPORTED, never adjusted. `percent` is capped at 100
 *      for the bar, because a bar past its own end is a rendering bug — but
 *      `rawPercent` carries the true number, and `amountRaised` is passed
 *      through untouched. Trimming a real total so a bar looks tidy is
 *      falsifying a financial record.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface CampaignProgress {
  /** Paise. */
  goal: number;
  /** Paise. */
  raised: number;
  /** Paise still needed. Zero once the goal is met — never negative. */
  remaining: number;
  /** 0–100, for the progress bar. */
  percent: number;
  /** The true percentage, which may exceed 100. */
  rawPercent: number;
  /** Whether the campaign has passed its goal. */
  goalReached: boolean;
  /** Paise received beyond the goal. Zero when the goal is not yet met. */
  surplus: number;
}

/**
 * Progress against a fundraising goal.
 *
 * A campaign with no goal (`goal <= 0`) has no meaningful percentage — an
 * open-ended appeal is a legitimate thing to run — so it reports 0% and the UI
 * shows the amount raised without a bar rather than dividing by zero.
 */
export function campaignProgress(goal: number, raised: number): CampaignProgress {
  const safeGoal = Math.max(0, Math.trunc(goal));
  const safeRaised = Math.max(0, Math.trunc(raised));

  if (safeGoal <= 0) {
    return {
      goal: 0,
      raised: safeRaised,
      remaining: 0,
      percent: 0,
      rawPercent: 0,
      goalReached: false,
      surplus: 0,
    };
  }

  // Integer arithmetic until the final division, so no intermediate value is
  // ever a float that could drift.
  const rawPercent = Math.round((safeRaised / safeGoal) * 100);

  return {
    goal: safeGoal,
    raised: safeRaised,
    remaining: Math.max(0, safeGoal - safeRaised),
    percent: Math.min(100, rawPercent),
    rawPercent,
    goalReached: safeRaised >= safeGoal,
    surplus: Math.max(0, safeRaised - safeGoal),
  };
}

export interface QuantityProgress {
  target: number | null;
  fulfilled: number;
  remaining: number | null;
  percent: number;
  rawPercent: number;
  targetReached: boolean;
}

/**
 * Progress against a unit target — "320 of 500 school kits provided".
 *
 * A null target means open-ended: keep giving, there is no cap. That renders
 * as a count without a bar.
 */
export function quantityProgress(target: number | null, fulfilled: number): QuantityProgress {
  const safeFulfilled = Math.max(0, Math.trunc(fulfilled));

  if (target === null || target <= 0) {
    return {
      target: null,
      fulfilled: safeFulfilled,
      remaining: null,
      percent: 0,
      rawPercent: 0,
      targetReached: false,
    };
  }

  const safeTarget = Math.trunc(target);
  const rawPercent = Math.round((safeFulfilled / safeTarget) * 100);

  return {
    target: safeTarget,
    fulfilled: safeFulfilled,
    remaining: Math.max(0, safeTarget - safeFulfilled),
    percent: Math.min(100, rawPercent),
    rawPercent,
    targetReached: safeFulfilled >= safeTarget,
  };
}

/**
 * Whole days until a deadline, from the START of today.
 *
 * Counting from midnight rather than from `now` is what stops the figure
 * ticking down mid-session and showing two different numbers on two pages
 * loaded a minute apart. Returns null when there is no deadline — decision
 * A14's sibling rule: no manufactured urgency, so a campaign without a real
 * end date does not get a countdown.
 */
export function daysRemaining(
  endDate: Date | string | null,
  now: Date = new Date(),
): number | null {
  if (!endDate) return null;

  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  if (Number.isNaN(end.getTime())) return null;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  return Math.max(0, Math.round((endDay.getTime() - startOfToday.getTime()) / 86_400_000));
}
