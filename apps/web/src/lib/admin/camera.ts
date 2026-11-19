/**
 * What to tell the gate desk when the camera does not start.
 *
 * The scanner library hands back whatever the browser said — an Error, a
 * DOMException or a plain string — and "NotAllowedError: Permission denied"
 * tells an operator nothing about what to do. This turns it into the one
 * thing to try next.
 *
 * A page that is not a secure context (plain http on any address other than
 * localhost, e.g. a phone opening the laptop's network address) has no camera
 * at all, whatever the person allows. It is checked first because no
 * permission prompt will ever fix it.
 */
export function cameraProblem(error: unknown, secureContext: boolean, userAgent = ''): string {
  if (!secureContext) {
    return 'The camera only works on a secure page. Open this page with https://, or on this computer at localhost.';
  }
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/NotAllowed|Permission|denied|dismissed|SecurityError/i.test(text)) {
    // On an iPhone the switch is in Safari's settings, not in a page prompt.
    if (/iPhone|iPad|iPod/.test(userAgent)) {
      return 'Camera access was refused. On iPhone: Settings → Safari → Camera → Ask (or tap aA → Website Settings → Camera → Allow), then reload this page.';
    }
    return 'Camera access was refused. Allow the camera for this site in the browser settings, then tap Enable Camera.';
  }
  if (/NotFound|not found|Overconstrained|DevicesNotFound|no camera/i.test(text)) {
    return 'No camera was found on this device. Type the pass details below instead.';
  }
  if (/NotReadable|Could not start|TrackStart|in use/i.test(text)) {
    return 'The camera is busy in another app or tab. Close it, then tap Enable Camera.';
  }
  return 'The camera could not start. Type the pass details below instead.';
}

/** The part of html5-qrcode's scanner that stopping needs. */
export interface StoppableScanner {
  isScanning: boolean;
  stop(): Promise<void>;
}

export interface ScannerStopper {
  /** Stop the camera; a stop already under way is shared. Never throws. */
  stop(): Promise<void>;
  /** Resolves once any stop under way has finished. */
  settled(): Promise<void>;
}

/**
 * Stops a scanner safely, however many times it is asked.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * html5-qrcode allows ONE start or stop at a time, and a second request while
 * one is under way THROWS — synchronously, so a `.catch()` on the call never
 * sees it ("Cannot transition to a new state, already under transition").
 * Leaving the gate page asked twice (the camera effect's cleanup, then the
 * unmount cleanup), and the second throw, from a cleanup, took down the next
 * page ("Something went wrong").
 *
 * So every stop goes through one of these: a stop already under way is
 * returned rather than repeated, and nothing is ever thrown.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function createScannerStopper(scanner: () => StoppableScanner | null): ScannerStopper {
  let inFlight: Promise<void> | null = null;
  return {
    stop() {
      if (inFlight) return inFlight;
      const current = scanner();
      if (!current?.isScanning) return Promise.resolve();
      inFlight = (async () => {
        try {
          await current.stop();
        } catch {
          // Already stopping or stopped: nothing left to do.
        }
      })().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    settled() {
      return inFlight ?? Promise.resolve();
    },
  };
}

export interface RepeatScanGuard {
  /** True when `code` is the pass just handled, still in front of the camera. */
  seenAgain(code: string, now?: number): boolean;
  /** Record that `code` is being handled now. */
  handled(code: string, now?: number): void;
}

/**
 * One look-up per pass presented, however long it is held up.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * The camera reads the pass in front of it many times a second, for as long
 * as it is held there. Looked up again a moment after it was admitted, it
 * came back "ALREADY ADMITTED" — about the person just let in — with an alert
 * sound, which reads at the gate like a duplicate pass.
 *
 * So the pass just handled is ignored while it stays in view: each repeat
 * read refreshes the timer, and it counts as presented again only after it
 * has been out of view for `quietMs`. A DIFFERENT pass is never held back,
 * and typing a pass into the box is not affected.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function createRepeatScanGuard(quietMs = 4000): RepeatScanGuard {
  let last: { code: string; seenAt: number } | null = null;
  return {
    seenAgain(code, now = Date.now()) {
      if (last && last.code === code && now - last.seenAt < quietMs) {
        last.seenAt = now;
        return true;
      }
      return false;
    },
    handled(code, now = Date.now()) {
      last = { code, seenAt: now };
    },
  };
}
