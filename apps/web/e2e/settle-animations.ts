import type { Page } from '@playwright/test';

/**
 * Wait until the page has stopped animating, so an audit reads the page
 * people read rather than a frame of its entrance.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY A LOOP, NOT ONE SNAPSHOT.
 *
 * Campaign cards fade and rise in, and their progress bars fill, over the
 * first second or so. Axe measures contrast from computed colours, so a scan
 * taken mid-fade reads every card's text at partial opacity and reports it as
 * low contrast — the Donate button measured #c46027 instead of its real
 * #ba4503.
 *
 * Awaiting `document.getAnimations()` ONCE was not enough in WebKit under a
 * loaded machine: animations registered after that snapshot were never
 * awaited, and the scan caught them at 90% opacity — about one run in fifty
 * on the tablet project. So this keeps checking until no finite animation is
 * still running for two frames in a row. Looping ones (a loading skeleton's
 * pulse) never finish and are left out, or it would wait forever; ten seconds
 * is the backstop.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const unsettled = () =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity &&
            animation.playState !== 'finished',
        );
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const deadline = Date.now() + 10_000;
    let quietFrames = 0;
    while (quietFrames < 2 && Date.now() < deadline) {
      const running = unsettled();
      if (running.length > 0) {
        quietFrames = 0;
        await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
      } else {
        quietFrames += 1;
      }
      await nextFrame();
    }
  });
}
