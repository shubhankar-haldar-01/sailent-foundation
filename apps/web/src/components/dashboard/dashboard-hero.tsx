import { LeafSpray, Rays } from '@/components/about/decor';

/**
 * The welcome banner (design, 2026-10-08): the greeting on a warm cream
 * ground with soft peach shapes, leaves and a few orange strokes on the
 * right. NO PHOTOGRAPH — the artwork is the whole of the right-hand side.
 *
 * The heading carries both lines, so its accessible name is the greeting
 * with the name in it; the wave is decoration and is hidden from readers.
 * On a phone the artwork is cut back to a single leaf so the text has the
 * width.
 */
export function DashboardHero({ firstName }: { firstName: string | null }) {
  return (
    <section
      aria-labelledby="dashboard-greeting"
      className="bg-(--cta-50) dark:bg-primary-soft relative overflow-hidden rounded-2xl px-6 py-8 sm:px-10 sm:py-10 lg:px-12 xl:px-10 xl:py-5"
    >
      {/* Soft shapes: a deeper peach sweep across the right, a pale one low on the left. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 860 240"
        preserveAspectRatio="none"
        className="fill-(--cta-100)/55 dark:fill-cta-glow/10 pointer-events-none absolute inset-0 size-full"
      >
        <path d="M520 0 C 600 40, 640 120, 760 150 C 820 165, 850 200, 860 240 L 860 0 Z" />
        <path d="M0 240 C 40 190, 120 180, 200 210 C 240 225, 270 240, 300 240 Z" />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 860 240"
        preserveAspectRatio="none"
        className="fill-(--cta-100)/35 dark:fill-cta-glow/5 pointer-events-none absolute inset-0 size-full"
      >
        <path d="M380 0 C 470 20, 500 90, 560 130 C 620 170, 700 180, 760 240 L 300 240 C 330 150, 340 60, 380 0 Z" />
      </svg>

      {/* Leaves and strokes, right-hand side only. */}
      <LeafSpray className="absolute -bottom-6 right-[26%] hidden h-48 w-auto rotate-[22deg] sm:block xl:-bottom-8 xl:right-[13%] xl:h-32" />
      <LeafSpray className="absolute -right-6 bottom-4 h-36 w-auto -scale-x-100 opacity-90 sm:h-48 xl:bottom-0 xl:h-40" />
      <Rays className="text-cta-glow absolute right-[9%] top-4 hidden h-12 w-9 sm:block" />
      <LeafSpray className="absolute -left-10 bottom-[-20%] hidden h-32 w-auto opacity-60 lg:block" />

      <div className="relative max-w-[32rem] xl:max-w-[37rem]">
        <h1 id="dashboard-greeting" className="text-foreground">
          <span className="text-body-lg block font-normal sm:text-[1.3125rem] xl:text-[1.1875rem] xl:leading-snug">
            Good to see you again,
          </span>
          <span className="font-display mt-1 block text-[2.125rem] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[2.75rem] xl:mt-0.5 xl:text-[2.25rem]">
            {firstName ?? 'Welcome back'}
            <span aria-hidden="true"> 👋</span>
          </span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-[22rem] text-[1rem] leading-relaxed sm:text-[1.0625rem] xl:mt-2 xl:max-w-none xl:text-[1rem] xl:leading-normal">
          Your compassion is creating real change. Here&rsquo;s a snapshot of your impact.
        </p>
      </div>
    </section>
  );
}
