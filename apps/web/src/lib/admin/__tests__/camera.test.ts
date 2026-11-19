import { describe, expect, it, vi } from 'vitest';

import { cameraProblem, createRepeatScanGuard, createScannerStopper } from '../camera';

/** What the gate desk is told when the camera does not start. */
describe('cameraProblem', () => {
  it('says the page must be secure, whatever the error, when it is plain http', () => {
    expect(
      cameraProblem(new Error('Camera streaming not supported by the browser.'), false),
    ).toMatch(/only works on a secure page/);
    expect(cameraProblem('NotAllowedError: Permission denied', false)).toMatch(/secure page/);
  });

  it('turns a refusal into how to allow it', () => {
    const refused = new DOMException('Permission denied', 'NotAllowedError');
    expect(cameraProblem(refused, true)).toMatch(/Camera access was refused/);
    expect(cameraProblem('NotAllowedError: Permission dismissed', true)).toMatch(/refused/);
  });

  it('on an iPhone, points to Safari’s camera setting', () => {
    const refused = new DOMException('Permission denied', 'NotAllowedError');
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    expect(cameraProblem(refused, true, iphone)).toMatch(/Settings → Safari → Camera/);
    expect(cameraProblem(refused, true, 'Mozilla/5.0 (Macintosh)')).not.toMatch(/Safari/);
  });

  it('names a missing camera and a busy one', () => {
    expect(
      cameraProblem(new DOMException('Requested device not found', 'NotFoundError'), true),
    ).toMatch(/No camera was found/);
    expect(
      cameraProblem(new DOMException('Could not start video source', 'NotReadableError'), true),
    ).toMatch(/busy in another app/);
  });

  it('falls back to manual entry for anything else', () => {
    expect(cameraProblem(new Error('something odd'), true)).toBe(
      'The camera could not start. Type the pass details below instead.',
    );
  });
});

/** A scanner that behaves like html5-qrcode: one transition at a time, and a
 *  second request THROWS synchronously. */
function libraryLikeScanner() {
  const state = { isScanning: true, busy: false };
  const stop = vi.fn(() => {
    if (state.busy) throw 'Cannot transition to a new state, already under transition';
    state.busy = true;
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        state.isScanning = false;
        state.busy = false;
        resolve();
      }, 10),
    );
  });
  return {
    scanner: {
      get isScanning() {
        return state.isScanning;
      },
      stop,
    },
    stop,
  };
}

describe('createScannerStopper', () => {
  it('asked twice while stopping, stops once and throws nothing', async () => {
    const { scanner, stop } = libraryLikeScanner();
    const stopper = createScannerStopper(() => scanner);

    const first = stopper.stop();
    const second = stopper.stop();

    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(scanner.isScanning).toBe(false);
  });

  it('swallows the library throwing, synchronously or not', async () => {
    const throwsNow = {
      isScanning: true,
      stop: () => {
        throw 'Cannot stop, scanner is not running or paused.';
      },
    };
    await expect(createScannerStopper(() => throwsNow).stop()).resolves.toBeUndefined();
    const rejects = { isScanning: true, stop: () => Promise.reject(new Error('gone')) };
    await expect(createScannerStopper(() => rejects).stop()).resolves.toBeUndefined();
  });

  it('does nothing when nothing is scanning', async () => {
    const stop = vi.fn();
    await createScannerStopper(() => ({ isScanning: false, stop })).stop();
    await createScannerStopper(() => null).stop();
    expect(stop).not.toHaveBeenCalled();
  });

  it('settled() waits for a stop under way, and a later stop stops again', async () => {
    const { scanner, stop } = libraryLikeScanner();
    const stopper = createScannerStopper(() => scanner);

    void stopper.stop();
    await stopper.settled();
    expect(scanner.isScanning).toBe(false);

    await stopper.stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('createRepeatScanGuard', () => {
  it('ignores the pass just handled while it stays in view, however long', () => {
    const guard = createRepeatScanGuard(4000);
    guard.handled('SF-EVT-AAAA0001', 0);

    // Read again and again for ten seconds: each read refreshes the timer.
    for (let t = 500; t <= 10_000; t += 500) {
      expect(guard.seenAgain('SF-EVT-AAAA0001', t)).toBe(true);
    }
  });

  it('takes the same pass again once it has been out of view for the quiet time', () => {
    const guard = createRepeatScanGuard(4000);
    guard.handled('SF-EVT-AAAA0001', 0);
    expect(guard.seenAgain('SF-EVT-AAAA0001', 4500)).toBe(false);
  });

  it('never holds back a different pass', () => {
    const guard = createRepeatScanGuard(4000);
    guard.handled('SF-EVT-AAAA0001', 0);
    expect(guard.seenAgain('SF-EVT-BBBB0002', 100)).toBe(false);
  });
});
