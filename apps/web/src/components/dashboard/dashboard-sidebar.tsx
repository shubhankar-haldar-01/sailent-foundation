import { LeafSprig, Rays } from '@/components/about/decor';

import { DashboardNav } from './dashboard-nav';
import { DonorAvatar } from './donor-avatar';
import { Panel } from './panel';
import { SignOutButton } from './sign-out-button';

/**
 * The account sidebar (design, 2026-10-08): one white panel with the donor's
 * avatar, name and address, the navigation, a rule and Logout; under it a
 * small inspirational card.
 *
 * ON A PHONE IT IS A STRIP, NOT A SIDEBAR: the identity row and a sideways-
 * scrolling navigation at the top of the page, and Logout at the foot of the
 * page (the layout places it), so the content comes first.
 */
export function DashboardSidebar({ name, email }: { name: string; email: string | null }) {
  return (
    <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <Panel className="min-w-0 p-3 lg:p-4 xl:p-3">
        <div className="flex items-center gap-3 px-2 py-1.5 lg:py-2 xl:py-1.5">
          <DonorAvatar
            name={name}
            className="size-12 text-[0.9375rem] lg:size-14 lg:text-base xl:size-12 xl:text-[0.9375rem]"
          />
          <div className="min-w-0">
            <p className="font-display text-foreground truncate text-[1.0625rem] font-bold">
              {name || 'Your account'}
            </p>
            {email ? (
              <p className="text-caption text-muted-foreground truncate" title={email}>
                {email}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 lg:mt-4 xl:mt-2.5">
          <DashboardNav />
        </div>

        <div className="border-border mt-3 hidden border-t pt-3 lg:block xl:mt-2 xl:pt-2">
          <SignOutButton />
        </div>
      </Panel>

      <InspirationCard />
    </aside>
  );
}

/** "Together we create brighter futures." — secondary to the navigation, desktop only. */
function InspirationCard() {
  return (
    <div
      aria-hidden="true"
      className="bg-(--cta-50) dark:bg-primary-soft relative mt-4 hidden overflow-hidden rounded-2xl px-6 pb-9 pt-10 lg:block xl:mt-3 xl:pb-6 xl:pt-7"
    >
      <Rays className="text-cta-glow absolute right-5 top-3 h-11 w-8 -scale-x-100" />
      <LeafSprig className="absolute -bottom-7 -left-4 h-32 w-auto opacity-80" />
      <LeafSprig flip className="absolute -bottom-8 -right-3 h-28 w-auto opacity-70" />
      <p className="font-display text-foreground relative pl-16 text-[1.375rem] font-semibold leading-snug xl:pl-12 xl:text-[1.25rem]">
        <span className="block">Together</span>
        <span className="block">we create</span>
        <span className="block">brighter</span>
        <span className="block">futures.</span>
      </p>
    </div>
  );
}
